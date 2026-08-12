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
import { generateSyncPhrase, deriveRoomIdFromPhrase } from "./syncPhrase.js";
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

// Violet on purpose, and deliberately NOT one of the three LIST_COLOR_PRESETS
// (blue / pink / yellow). This placeholder is a list you're VISITING, and the
// free tier caps you at three of your own — so borrowing lists[0]'s colour, as
// this used to, guaranteed a visited list looked like a duplicate of one you
// already had. A colour outside the rotation says "this one isn't yours".
const VISITOR_LIST_COLORS = {
  color: "violet",
  primaryColor: "#a970ea",
  accentColor: "#c9a3f2",
  glowColor: "rgba(169, 112, 234, 0.3)",
};

function createPlaceholderList(listId, seedList = null, roomId = null) {
  return {
    id: listId,
    name: seedList?.name || "Live List",
    color: seedList?.color || VISITOR_LIST_COLORS.color,
    primaryColor: seedList?.primaryColor || VISITOR_LIST_COLORS.primaryColor,
    accentColor: seedList?.accentColor || VISITOR_LIST_COLORS.accentColor,
    glowColor: seedList?.glowColor || VISITOR_LIST_COLORS.glowColor,
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
export async function makeLive(listId, password = null, desiredRoomId = null) {
  const listData = getListSnapshot(listId);

  if (!listData) {
    throw new Error(`List ${listId} not found`);
  }

  // Rejoin before creating. Without this, a second call mints a fresh room and
  // hands out its link while the sender stays wired to the old one — two rooms
  // for one list, and the recipient never hears about the new address.
  const existingRoom = getRoomId(listId);
  if (existingRoom && !desiredRoomId) {
    await connectToLive(listId, existingRoom, password);
    return {
      roomId: existingRoom,
      shareUrl: generateShareUrl(existingRoom, password),
    };
  }

  const { roomId } = await createLiveList(listData, password, desiredRoomId);
  await connectToLive(listId, roomId, password);

  return {
    roomId,
    shareUrl: generateShareUrl(roomId, password),
  };
}

// ── Carry a list to another device with four words ──────────────────────
// Both halves lean entirely on the live-list rig that already works: sync is
// just a live room whose id came from a phrase instead of a random uuid.

export async function startPhraseSync(listId) {
  const phrase = generateSyncPhrase();
  const roomId = await deriveRoomIdFromPhrase(phrase);
  if (!roomId) throw new Error("Could not build a sync phrase.");

  await makeLive(listId, null, roomId);
  return { phrase, roomId };
}

export async function joinByPhrase(phrase) {
  const roomId = await deriveRoomIdFromPhrase(phrase);
  if (!roomId) return { success: false, reason: "invalid" };

  const listId = `live_${roomId}`;
  try {
    await connectToLive(listId, roomId, null);
    return { success: true, listId, roomId };
  } catch (error) {
    // A wrong phrase is an unremarkable typo, not a fault worth shouting about.
    return { success: false, reason: "not-found", error };
  }
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
    // Reuse only if it's the SAME room. Returning a connection pointed at a
    // different room reports success while leaving the caller wired to the old
    // one — the quiet half of how one list ends up split across two rooms.
    if (existingConnection.roomId === roomId) {
      return existingConnection.readyPromise || Promise.resolve();
    }
    disconnectFromLive(listId);
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
          const roster = Array.isArray(users) ? users : [];
          presenceStore.setUsers(roster);

          // Presence is authoritative for who's here. Sweep activity
          // indicators from anyone who left so a dropped connection can't
          // leave a ghost "still typing/recording" badge hanging around
          // until its TTL expires (voice badges live up to 45s).
          const presentIds = new Set(roster.map((user) => user.id));
          for (const user of get(typingStore)) {
            if (!presentIds.has(user.id)) typingStore.stopTyping(user.id);
          }
          const activity = get(activityStore);
          for (const entry of [
            ...activity.drafts,
            ...activity.focuses,
            ...activity.voices,
          ]) {
            if (!presentIds.has(entry.id)) activityStore.clearUser(entry.id);
          }
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
    disconnectFromLive(listId, { discardGuestList: true });
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

/**
 * @param {string} listId
 * @param {{discardGuestList?: boolean}} [options] - discardGuestList removes the
 *   placeholder that connectToLive created for a room you were only VISITING.
 *   Guarded on the `live_` prefix so it can never touch a list you actually own.
 */
export function disconnectFromLive(listId, options = {}) {
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

  // A guest's list is a VIEW of someone else's, minted by connectToLive as a
  // placeholder. Nothing ever removed it, so every visit deposited a permanent
  // list in the visitor's carousel — and because the placeholder copies the
  // colour of lists[0], it arrived looking like a duplicate of a list they
  // already had. Two yellow lists, one of them a ghost.
  //
  // The `live_` guard matters: an owner's live list has its own real id, and a
  // room-change rebuild disconnects mid-flight expecting to reconnect. Neither
  // must ever be deleted here.
  if (
    options.discardGuestList &&
    typeof listId === "string" &&
    listId.startsWith("live_")
  ) {
    listsStore.deleteList(listId);
  }
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

/**
 * Rejoin the room a list was already in, after a reload.
 *
 * `activeConnections` is an in-memory Map, so a refresh wipes every live
 * session while the list itself still carries `liveRoomId`/`isLive` in
 * localStorage. Nothing read those fields back, so both sides came back
 * looking un-live — and tapping "Go live" again called makeLive(), which
 * mints a BRAND NEW room id. That is why two people who were sharing a list
 * an hour ago end up in different rooms.
 *
 * Safe to call on every mount: connectToLive() no-ops when a connection
 * already exists, and a dead room closes with a terminal code that clears
 * the stale live flags rather than reconnecting forever.
 *
 * @param {string} listId
 * @returns {Promise<boolean>} true when a rejoin was attempted
 */
export async function resumeLive(listId) {
  if (!listId || activeConnections.has(listId)) return false;
  if (!isPartyKitAvailable()) return false;

  const list = getListSnapshot(listId);
  const roomId = list?.liveRoomId;
  if (!list?.isLive || !roomId) return false;

  try {
    await connectToLive(listId, roomId);
    return true;
  } catch (error) {
    // The room is gone (expired/not found). Your OWN list drops its stale
    // live flags and goes back to plain local. A guest copy (live_* id,
    // upserted when you opened someone's share link) is just a husk once its
    // room dies — delete it, or every share link ever opened piles up as a
    // dead clone of the owner's list in the carousel.
    if (error?.code === "room_expired" || error?.code === "room_not_found") {
      if (listId.startsWith("live_")) {
        listsStore.deleteList(listId);
      } else {
        listsStore.upsertList(
          { ...list, liveRoomId: null, isLive: false },
          listId,
        );
      }
      announceLiveNotice(error.message || "That live room has popped.");
    }
    return false;
  }
}

export function isLive(listId) {
  if (activeConnections.has(listId)) return true;
  // Persisted truth: a reload empties activeConnections, but the list still
  // belongs to its room until resumeLive() proves otherwise.
  const list = getListSnapshot(listId);
  return Boolean(list?.isLive && list?.liveRoomId);
}

export function getLiveListCount() {
  return activeConnections.size;
}

export function isLiveCollaborationAvailable() {
  return isPartyKitAvailable();
}

export function getRoomId(listId) {
  return (
    activeConnections.get(listId)?.roomId ||
    getListSnapshot(listId)?.liveRoomId ||
    null
  );
}

export function getShareUrl(listId, password = null) {
  const roomId = getRoomId(listId);
  if (!roomId) return null;
  return generateShareUrl(roomId, password);
}
