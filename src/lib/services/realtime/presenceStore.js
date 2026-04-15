/**
 * Presence Store
 *
 * Tracks who's currently online in a live list using Svelte 5 runes.
 */

import { writable } from 'svelte/store';

/**
 * @typedef {Object} PresenceUser
 * @property {string} id - Connection ID
 * @property {string} avatar - Avatar name (e.g., "Misty Fox")
 * @property {number} joinedAt - Timestamp when user joined
 */

/**
 * Create a presence store for a specific list
 * @returns {Object} Presence store with subscribe method and update functions
 */
export function createPresenceStore() {
  const { subscribe, set, update } = writable(/** @type {PresenceUser[]} */ ([]));

  return {
    subscribe,

    /**
     * Set the full list of online users
     * @param {PresenceUser[]} users
     */
    setUsers(users) {
      set(users);
    },

    /**
     * Add a user to presence
     * @param {PresenceUser} user
     */
    addUser(user) {
      update(users => {
        // Don't add duplicates
        if (users.some(u => u.id === user.id)) {
          return users;
        }
        return [...users, user];
      });
    },

    /**
     * Remove a user from presence
     * @param {string} userId
     */
    removeUser(userId) {
      update(users => users.filter(u => u.id !== userId));
    },

    /**
     * Clear all users
     */
    clear() {
      set([]);
    }
  };
}

/**
 * Global store mapping listId -> presence store
 */
const presenceStores = new Map();

/**
 * Get or create a presence store for a specific list
 * @param {string} listId - The list ID
 * @returns {ReturnType<typeof createPresenceStore>}
 */
export function getPresenceStore(listId) {
  if (!presenceStores.has(listId)) {
    presenceStores.set(listId, createPresenceStore());
  }
  return presenceStores.get(listId);
}

/**
 * Clean up a presence store
 * @param {string} listId
 */
export function cleanupPresenceStore(listId) {
  const store = presenceStores.get(listId);
  if (store) {
    store.clear();
    presenceStores.delete(listId);
  }
}
