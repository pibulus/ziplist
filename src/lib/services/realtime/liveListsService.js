/**
 * Live Lists Service
 *
 * Layers live collaboration on top of the existing listsStore.
 * Manages PartyKit connections and syncs changes bidirectionally.
 */

import { listsStore } from '../lists/listsStore.js';
import {
  connectToLiveList,
  sendUpdate,
  disconnectFromLiveList
} from './partyService.js';
import { getPresenceStore, cleanupPresenceStore } from './presenceStore.js';
import { getTypingStore, cleanupTypingStore } from './typingStore.js';
import { get } from 'svelte/store';

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
 * Initialize Live Mode by Default
 * Subscribes to the listsStore and automatically connects to the active list.
 */
export function initLiveMode() {
  let currentListId = null;

  listsStore.subscribe(state => {
    const newListId = state.activeListId;

    // If the active list has changed
    if (newListId && newListId !== currentListId) {
      // Disconnect from previous list if exists
      if (currentListId) {
        disconnectFromLive(currentListId);
      }

      currentListId = newListId;

      // Connect to the new list
      // We use the listId as the roomId for simplicity in "Live by Default" mode
      connectToLive(newListId, newListId);
    }
  });
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
    // console.warn(`[LiveListsService] Already connected to list ${listId}`);
    return;
  }

  console.log(`[LiveListsService] Connecting to list ${listId} (Room: ${roomId})`);

  // Get presence and typing stores for this list
  const presenceStore = getPresenceStore(listId);
  const typingStore = getTypingStore(listId);

  // Connect to PartyKit room
  const socket = connectToLiveList(
    roomId,
    {
      /**
       * Called when we receive initial list state from server
       */
      onInit: (serverListData) => {
        console.log('[LiveListsService] Received initial state from server', serverListData);

        if (serverListData) {
          // Server has data -> Server Wins (Update local)
          isSyncingRemoteChange = true;

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
        } else {
          // Server has NO data -> Client Wins (Upload local)
          console.log('[LiveListsService] Server is empty, uploading local data');
          const state = get(listsStore);
          const localList = state.lists.find(l => l.id === listId);
          
          if (localList) {
            // Send full update to initialize server
            sendUpdate(socket, 'list_update', localList);
          }
        }
      },

      /**
       * Called when remote changes arrive
       */
      onUpdate: (message) => {
        // console.log('[LiveListsService] Received update from', message.sender?.avatar, message.type);

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

          case 'typing_start':
            if (message.sender) {
              typingStore.startTyping(message.sender);
            }
            break;

          case 'typing_stop':
            if (message.sender) {
              typingStore.stopTyping(message.sender.id);
            }
            break;
        }

        listsStore.persistToStorage();
        isSyncingRemoteChange = false;
      },

      /**
       * Called when presence updates
       */
      onPresence: (users) => {
        // console.log('[LiveListsService] Presence update:', users.map(u => u.avatar).join(', '));
        presenceStore.setUsers(users);
      },

      onConnect: () => {
        console.log('[LiveListsService] Connected to room', roomId);
      },

      onDisconnect: () => {
        console.log('[LiveListsService] Disconnected from room', roomId);
        presenceStore.setUsers([]); // Clear presence on disconnect
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
    // Optimization: Only send if something actually changed? 
    // For now, listsStore updates trigger this.
    
    // NOTE: Ideally we would intercept specific actions (addItem, etc) to send granular updates.
    // But since we are observing the store, we only have the new state.
    // Sending 'list_update' is the safest fallback.
    // To send granular updates ('item_add', etc), we would need to hook into the store actions directly
    // or diff the state here.
    
    // For this prototype, we will send 'list_update' which overwrites server state.
    // This is "Last Write Wins" at the list level.
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

  // Clean up presence and typing
  cleanupPresenceStore(listId);
  cleanupTypingStore(listId);

  // Clean up subscription
  if (connection.unsubscribe) {
    connection.unsubscribe();
  }

  // Remove from active connections
  activeConnections.delete(listId);

  console.log('[LiveListsService] Disconnected from list', listId);
}

/**
 * Broadcast typing start event
 * @param {string} listId
 */
export function broadcastTypingStart(listId) {
  const connection = activeConnections.get(listId);
  if (!connection) return;

  sendUpdate(connection.socket, 'typing_start', {});
}

/**
 * Broadcast typing stop event
 * @param {string} listId
 */
export function broadcastTypingStop(listId) {
  const connection = activeConnections.get(listId);
  if (!connection) return;

  sendUpdate(connection.socket, 'typing_stop', {});
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
  // For Live by Default, the room ID is the list ID
  // And the share URL is just the app URL with the list ID (if we had routing)
  // Or we can stick to the /live/ route for sharing specifically?
  // User said "remove /live route".
  // So share URL should probably just be the main app URL?
  // But how do we open a specific list?
  // We probably need a query param like ?list=ID
  
  if (typeof window === 'undefined') return '';
  
  // New Share URL format: /?list=listId
  const baseUrl = `${window.location.origin}/?list=${listId}`;
  return password ? `${baseUrl}&pwd=${encodeURIComponent(password)}` : baseUrl;
}
