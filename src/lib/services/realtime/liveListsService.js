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
import { LIVE_MESSAGE_TYPES } from "./liveListProtocol.js";

const activeConnections = new Map();
const remoteSyncingLists = new Set();

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

  const readyPromise = new Promise((resolve, reject) => {
    settleReady = resolve;
    failReady = reject;
  });

  connection.readyPromise = readyPromise;

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
        withRemoteSync(listId, () => {
          switch (message.type) {
            case LIVE_MESSAGE_TYPES.LIST_UPDATE:
              upsertLiveList(listId, roomId, message.data);
              break;

            case LIVE_MESSAGE_TYPES.TYPING_START:
              if (message.sender) {
                typingStore.startTyping(message.sender);
              }
              break;

            case LIVE_MESSAGE_TYPES.TYPING_STOP:
              if (message.sender) {
                typingStore.stopTyping(message.sender.id);
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
          failReady(new Error(getJoinError(event)));
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
  activeConnections.set(listId, connection);

  try {
    await readyPromise;
    setupLocalChangeSync(listId, socket);
  } catch (error) {
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
