/**
 * Live Lists Service
 *
 * Layers live collaboration on top of the existing listsStore.
 * Manages PartyKit connections and syncs changes bidirectionally.
 */

import { listsStore } from '../lists/listsStore.js';
import {
  createLiveList,
  connectToLiveList,
  sendUpdate,
  disconnectFromLiveList,
  generateShareUrl
} from './partyService.js';
import { getPresenceStore, cleanupPresenceStore } from './presenceStore.js';

/**
 * Active PartySocket connections
 * Map of listId -> socket
 */
const activeConnections = new Map();

/**
 * Flag to prevent sync loops (when we apply remote changes, don't broadcast them back)
 */
let isSyncingRemoteChange = false;

/**
 * Make a list "live" by creating a PartyKit room and connecting to it
 * @param {string} listId - The list ID to make live
 * @param {string} [password] - Optional password for the room
 * @returns {Promise<{roomId: string, shareUrl: string}>}
 */
export async function makeLive(listId, password = null) {
  // Get the list data from the store
  const state = listsStore;
  let listData = null;

  state.subscribe(s => {
    listData = s.lists.find(l => l.id === listId);
  })();

  if (!listData) {
    throw new Error(`List ${listId} not found`);
  }

  // Create the PartyKit room
  const { roomId } = await createLiveList(listData, password);

  // Connect to the room
  await connectToLive(listId, roomId, password);

  // Generate share URL
  const shareUrl = generateShareUrl(roomId, password);

  return { roomId, shareUrl };
}

/**
 * Connect to an existing live list room
 * @param {string} listId - The local list ID
 * @param {string} roomId - The PartyKit room ID
 * @param {string} [password] - Optional password
 * @returns {Promise<void>}
 */
export async function connectToLive(listId, roomId, password = null) {
  // Don't connect twice to the same room
  if (activeConnections.has(listId)) {
    console.warn(`[LiveListsService] Already connected to list ${listId}`);
    return;
  }

  // Get presence store for this list
  const presenceStore = getPresenceStore(listId);

  // Connect to PartyKit room
  const socket = connectToLiveList(
    roomId,
    {
      /**
       * Called when we receive initial list state from server
       */
      onInit: (serverListData) => {
        console.log('[LiveListsService] Received initial state from server', serverListData);

        // Apply server state to local store (merge strategy: server wins)
        isSyncingRemoteChange = true;

        // Update the list in the store
        listsStore.update(state => {
          return {
            ...state,
            lists: state.lists.map(list => {
              if (list.id === listId) {
                return {
                  ...list,
                  ...serverListData,
                  id: listId // Keep local ID
                };
              }
              return list;
            })
          };
        });

        listsStore.persistToStorage();
        isSyncingRemoteChange = false;
      },

      /**
       * Called when remote changes arrive
       */
      onUpdate: (message) => {
        console.log('[LiveListsService] Received update from', message.sender?.avatar, message.type);

        isSyncingRemoteChange = true;

        switch (message.type) {
          case 'list_update':
            // Full list update
            listsStore.update(state => {
              return {
                ...state,
                lists: state.lists.map(list => {
                  if (list.id === listId) {
                    return {
                      ...list,
                      ...message.data,
                      id: listId
                    };
                  }
                  return list;
                })
              };
            });
            break;

          case 'item_add':
            listsStore.addItem(message.data.text, listId);
            break;

          case 'item_toggle':
            listsStore.toggleItem(message.data.id, listId);
            break;

          case 'item_update':
            listsStore.editItem(message.data.id, message.data.text, listId);
            break;

          case 'item_delete':
            listsStore.removeItem(message.data.id, listId);
            break;
        }

        listsStore.persistToStorage();
        isSyncingRemoteChange = false;
      },

      /**
       * Called when presence updates
       */
      onPresence: (users) => {
        console.log('[LiveListsService] Presence update:', users.map(u => u.avatar).join(', '));
        presenceStore.setUsers(users);
      },

      onConnect: () => {
        console.log('[LiveListsService] Connected to room', roomId);
      },

      onDisconnect: () => {
        console.log('[LiveListsService] Disconnected from room', roomId);
      }
    },
    password
  );

  // Store the connection
  activeConnections.set(listId, { socket, roomId });

  // Set up local change broadcasting
  setupLocalChangeSync(listId, socket);
}

/**
 * Set up a listener to broadcast local changes to PartyKit
 */
function setupLocalChangeSync(listId, socket) {
  // Subscribe to list changes
  const unsubscribe = listsStore.subscribe(state => {
    // Don't broadcast if we're applying a remote change (avoid loops)
    if (isSyncingRemoteChange) return;

    // Find the list
    const list = state.lists.find(l => l.id === listId);
    if (!list) return;

    // Broadcast the full list state
    // In a production app, you'd want to send only diffs, but for simplicity we send everything
    sendUpdate(socket, 'list_update', list);
  });

  // Store the unsubscribe function for cleanup
  const connection = activeConnections.get(listId);
  if (connection) {
    connection.unsubscribe = unsubscribe;
  }
}

/**
 * Disconnect from a live list
 * @param {string} listId - The list ID to disconnect
 */
export function disconnectFromLive(listId) {
  const connection = activeConnections.get(listId);
  if (!connection) return;

  // Disconnect from PartyKit
  disconnectFromLiveList(connection.socket);

  // Clean up presence
  cleanupPresenceStore(listId);

  // Clean up subscription
  if (connection.unsubscribe) {
    connection.unsubscribe();
  }

  // Remove from active connections
  activeConnections.delete(listId);

  console.log('[LiveListsService] Disconnected from list', listId);
}

/**
 * Check if a list is currently live
 * @param {string} listId
 * @returns {boolean}
 */
export function isLive(listId) {
  return activeConnections.has(listId);
}

/**
 * Get the room ID for a live list
 * @param {string} listId
 * @returns {string | null}
 */
export function getRoomId(listId) {
  const connection = activeConnections.get(listId);
  return connection?.roomId || null;
}

/**
 * Get the share URL for a live list
 * @param {string} listId
 * @param {string} [password]
 * @returns {string | null}
 */
export function getShareUrl(listId, password = null) {
  const roomId = getRoomId(listId);
  if (!roomId) return null;
  return generateShareUrl(roomId, password);
}
