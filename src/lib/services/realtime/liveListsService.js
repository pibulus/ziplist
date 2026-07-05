/**
 * Live Lists Service
 *
 * Layers PartyKit live collaboration on top of the existing listsStore.
 * ZipList syncs compact full-list snapshots; that keeps the protocol simple
 * and portable while the product list sizes stay intentionally small.
 */

import { get } from "svelte/store";
import { listsStore } from "../lists/listsStore.js";
import {
  createLiveList,
  connectToLiveList,
  sendUpdate,
  disconnectFromLiveList,
  generateShareUrl,
  isLiveCollaborationAvailable as isPartyKitAvailable,
} from "./partyService.js";
import { getPresenceStore, cleanupPresenceStore } from "./presenceStore.js";
import { getTypingStore, cleanupTypingStore } from "./typingStore.js";
import {
  LIVE_CLOSE_CODES,
  LIVE_LIST_LIMITS,
  LIVE_MESSAGE_TYPES,
  sanitizeLiveListData,
} from "./liveListProtocol.js";
import {
  getLiveActivityStore,
  cleanupLiveActivityStore,
} from "./liveActivityStore.js";

const activeConnections = new Map();
const remoteSyncingLists = new Set();
const LIVE_JOIN_TIMEOUT_MS = 12000;

// Server-initiated closes that mean the room is gone for good. Without this,
// partysocket reconnects forever against a room that keeps closing it — the
// user thinks they're still collaborating while nothing syncs.
const TERMINAL_CLOSE_CODES = new Set([
  LIVE_CLOSE_CODES.ROOM_NOT_FOUND,
  LIVE_CLOSE_CODES.ROOM_EXPIRED,
  1008, // policy violation (wrong/changed password)
]);

function announceLiveNotice(message, success = false) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("ziplist-list-notice", {
      detail: { message, success },
    }),
  );
}

function getSenderWithId(sender) {
  return sender &&
    typeof sender === "object" &&
    typeof sender.id === "string" &&
    sender.id
    ? sender
    : null;
}

function createPlaceholderList(listId, seedList = null, roomId = null) {
  const fallbackList = get(listsStore).lists[0] ?? {};

  return {
    id: listId,
    name: seedList?.name || "Live List",
    color: seedList?.color || fallbackList.color || "blue",
    primaryColor:
      seedList?.primaryColor || fallbackList.primaryColor || "#00d4ff",
    accentColor: seedList?.accentColor || fallbackList.accentColor || "#4dd0e1",
    glowColor:
      seedList?.glowColor || fallbackList.glowColor || "rgba(0, 212, 255, 0.3)",
    items: Array.isArray(seedList?.items) ? seedList.items : [],
    createdAt: seedList?.createdAt || new Date().toISOString(),
    updatedAt: seedList?.updatedAt || new Date().toISOString(),
    liveRoomId: roomId,
    isLive: true,
  };
}

function getListSnapshot(listId) {
  return get(listsStore).lists.find((list) => list.id === listId) || null;
}

function getTimestamp(value) {
  const timestamp = Date.parse(value || "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isLocalSnapshotNewer(localList, serverList) {
  return (
    getTimestamp(localList?.updatedAt) > getTimestamp(serverList?.updatedAt)
  );
}

function withRemoteSync(listId, callback) {
  remoteSyncingLists.add(listId);
  try {
    callback();
  } finally {
    remoteSyncingLists.delete(listId);
  }
}

function upsertLiveList(listId, roomId, listData) {
  if (!listData) return;

  listsStore.upsertList(
    {
      ...listData,
      id: listId,
      liveRoomId: roomId,
      isLive: true,
    },
    listId,
  );
}

function sendListSnapshot(listId, socket) {
  const list = getListSnapshot(listId);
  if (!list) return false;
  return sendUpdate(socket, LIVE_MESSAGE_TYPES.LIST_UPDATE, list);
}

function getJoinError(event) {
  return (
    event?.reason ||
    "Could not join that live list. Check the link and try again."
  );
}

function createJoinError(event) {
  const error = new Error(getJoinError(event));

  if (event?.code === LIVE_CLOSE_CODES.ROOM_EXPIRED) {
    error.code = "room_expired";
    error.message = "This live room has popped.";
  } else if (event?.code === LIVE_CLOSE_CODES.ROOM_NOT_FOUND) {
    error.code = "room_not_found";
  }

  return error;
}

/**
 * Make a list live by creating a PartyKit room and connecting to it.
 * @param {string} listId
 * @param {string} [password]
 * @returns {Promise<{roomId: string, shareUrl: string}>}
 */
export async function makeLive(listId, password = null) {
  const listData = getListSnapshot(listId);

  if (!listData) {
    throw new Error(`List ${listId} not found`);
  }

  const { roomId } = await createLiveList(listData, password);
  await connectToLive(listId, roomId, password);

  return {
    roomId,
    shareUrl: generateShareUrl(roomId, password),
  };
}

/**
 * Connect a local list record to an existing live room.
 * Resolves only after the room sends its initial list state.
 * @param {string} listId
 * @param {string} roomId
 * @param {string} [password]
 * @returns {Promise<void>}
 */
export async function connectToLive(listId, roomId, password = null) {
  const existingConnection = activeConnections.get(listId);
  if (existingConnection) {
    return existingConnection.readyPromise || Promise.resolve();
  }

  if (!getListSnapshot(listId)) {
    listsStore.upsertList(createPlaceholderList(listId, null, roomId), listId);
  }

  const presenceStore = getPresenceStore(listId);
  const typingStore = getTypingStore(listId);
  const activityStore = getLiveActivityStore(listId);
  const connection = {
    socket: null,
    roomId,
    unsubscribe: null,
    initialized: false,
    readyPromise: null,
  };

  let socket;
  let settleReady;
  let failReady;
  let readySettled = false;
  let readyTimeoutId;

  function finishReady(callback) {
    if (readySettled) return;

    readySettled = true;
    clearTimeout(readyTimeoutId);
    callback();
  }

  const readyPromise = new Promise((resolve, reject) => {
    settleReady = () => finishReady(resolve);
    failReady = (error) => finishReady(() => reject(error));
  });

  // Safety valve: if socket creation throws synchronously below, nothing ever
  // awaits this promise — keep its rejection from becoming unhandled. Real
  // awaiters still receive the rejection.
  readyPromise.catch(() => {});

  connection.readyPromise = readyPromise;

  // Register before any async work so a second connect call during the join
  // window reuses this connection instead of opening a duplicate socket.
  activeConnections.set(listId, connection);
  readyTimeoutId = setTimeout(() => {
    failReady(
      new Error(
        "Live list took too long to respond. Check the link and retry.",
      ),
    );
  }, LIVE_JOIN_TIMEOUT_MS);

  try {
    socket = connectToLiveList(
      roomId,
      {
        onInit: (serverListData) => {
          if (!serverListData) {
            failReady(new Error("Live list not found."));
            return;
          }

          const localList = getListSnapshot(listId);
          const shouldPushLocal =
            connection.initialized &&
            isLocalSnapshotNewer(localList, serverListData);

          if (shouldPushLocal) {
            sendListSnapshot(listId, socket);
          } else {
            withRemoteSync(listId, () => {
              upsertLiveList(listId, roomId, serverListData);
            });
          }

          connection.initialized = true;
          settleReady();
        },

        onUpdate: (message) => {
          // The server sanitizes before broadcasting, but don't trust the wire
          // shape blindly — re-validate list payloads and require a well-formed
          // sender before dereferencing it.
          const sender = getSenderWithId(message.sender);

          withRemoteSync(listId, () => {
            switch (message.type) {
              case LIVE_MESSAGE_TYPES.LIST_UPDATE: {
                const safeData = sanitizeLiveListData(message.data);
                if (safeData) {
                  upsertLiveList(listId, roomId, safeData);
                }
                break;
              }

              case LIVE_MESSAGE_TYPES.TYPING_START:
                if (sender) {
                  typingStore.startTyping(sender);
                }
                break;

              case LIVE_MESSAGE_TYPES.TYPING_STOP:
                if (sender) {
                  typingStore.stopTyping(sender.id);
                }
                break;

              case LIVE_MESSAGE_TYPES.DRAFT_UPDATE:
                if (sender) {
                  activityStore.updateDraft(sender, message.data);
                }
                break;

              case LIVE_MESSAGE_TYPES.DRAFT_CLEAR:
                if (sender) {
                  activityStore.clearDraft(sender.id);
                }
                break;

              case LIVE_MESSAGE_TYPES.ITEM_FOCUS:
                if (sender) {
                  activityStore.setItemFocus(sender, message.data);
                }
                break;

              case LIVE_MESSAGE_TYPES.VOICE_ACTIVITY:
                if (sender) {
                  activityStore.setVoiceActivity(sender, message.data);
                }
                break;
            }
          });
        },

        onPresence: (users) => {
          presenceStore.setUsers(Array.isArray(users) ? users : []);
        },

        onDisconnect: (event) => {
          if (!connection.initialized) {
            failReady(createJoinError(event));
            return;
          }

          // The room can die mid-session (expiry, eviction, changed password).
          // Stop the reconnect loop and tell the user instead of silently
          // retrying against a room that keeps closing us.
          if (TERMINAL_CLOSE_CODES.has(event?.code)) {
            announceLiveNotice(
              event?.code === LIVE_CLOSE_CODES.ROOM_EXPIRED
                ? "This live room has popped — sharing has ended."
                : "Live sharing ended for this list.",
            );
            disconnectFromLive(listId);
          }
        },

        onError: () => {
          if (!connection.initialized) {
            failReady(
              new Error("Could not connect to that live list. Try again soon."),
            );
          }
        },
      },
      password,
    );

    connection.socket = socket;

    await readyPromise;
    setupLocalChangeSync(listId, socket);
  } catch (error) {
    // Settles the ready promise if socket creation threw before any socket
    // event could — otherwise the join timeout would fire into nothing.
    failReady(error);
    disconnectFromLive(listId);
    throw error;
  }
}

function setupLocalChangeSync(listId, socket) {
  const connection = activeConnections.get(listId);
  if (!connection || connection.unsubscribe) return;

  connection.unsubscribe = listsStore.subscribe((state) => {
    if (remoteSyncingLists.has(listId)) return;

    const list = state.lists.find((candidate) => candidate.id === listId);
    if (!list) return;

    // The room truncates snapshots past MAX_ITEMS without telling anyone —
    // warn once so items don't just quietly stop reaching collaborators.
    if (
      (list.items?.length || 0) > LIVE_LIST_LIMITS.MAX_ITEMS &&
      !connection.warnedAboutItemCap
    ) {
      connection.warnedAboutItemCap = true;
      announceLiveNotice(
        `Live share syncs the first ${LIVE_LIST_LIMITS.MAX_ITEMS} items — extras stay on this device.`,
      );
    }

    sendUpdate(socket, LIVE_MESSAGE_TYPES.LIST_UPDATE, list);
  });
}

export function disconnectFromLive(listId) {
  const connection = activeConnections.get(listId);
  if (!connection) return;

  if (connection.unsubscribe) {
    connection.unsubscribe();
  }

  disconnectFromLiveList(connection.socket);
  cleanupPresenceStore(listId);
  cleanupTypingStore(listId);
  cleanupLiveActivityStore(listId);
  activeConnections.delete(listId);
}

export function broadcastTypingStart(listId) {
  const connection = activeConnections.get(listId);
  if (!connection) return;

  sendUpdate(connection.socket, LIVE_MESSAGE_TYPES.TYPING_START, {});
}

export function broadcastTypingStop(listId) {
  const connection = activeConnections.get(listId);
  if (!connection) return;

  sendUpdate(connection.socket, LIVE_MESSAGE_TYPES.TYPING_STOP, {});
}

export function broadcastDraftUpdate(listId, data = {}) {
  const connection = activeConnections.get(listId);
  if (!connection) return;

  sendUpdate(connection.socket, LIVE_MESSAGE_TYPES.DRAFT_UPDATE, data);
}

export function broadcastDraftClear(listId) {
  const connection = activeConnections.get(listId);
  if (!connection) return;

  sendUpdate(connection.socket, LIVE_MESSAGE_TYPES.DRAFT_CLEAR, {});
}

export function broadcastItemFocus(listId, itemId = null) {
  const connection = activeConnections.get(listId);
  if (!connection) return;

  sendUpdate(connection.socket, LIVE_MESSAGE_TYPES.ITEM_FOCUS, { itemId });
}

export function broadcastVoiceActivity(listId, data = {}) {
  const connection = activeConnections.get(listId);
  if (!connection) return;

  sendUpdate(connection.socket, LIVE_MESSAGE_TYPES.VOICE_ACTIVITY, data);
}

export function isLive(listId) {
  return activeConnections.has(listId);
}

export function isLiveCollaborationAvailable() {
  return isPartyKitAvailable();
}

export function getRoomId(listId) {
  return activeConnections.get(listId)?.roomId || null;
}

export function getShareUrl(listId, password = null) {
  const roomId = getRoomId(listId);
  if (!roomId) return null;
  return generateShareUrl(roomId, password);
}
