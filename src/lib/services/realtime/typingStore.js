/**
 * Typing Indicator Store
 *
 * Tracks who's currently typing/adding items in live lists.
 */

import { writable } from 'svelte/store';

/**
 * @typedef {Object} TypingUser
 * @property {string} id - Connection ID
 * @property {string} avatar - Avatar name (e.g., "Misty Fox")
 * @property {number} startedAt - Timestamp when typing started
 */

/**
 * Create a typing indicator store for a specific list
 * @returns {Object} Typing store with subscribe method and update functions
 */
export function createTypingStore() {
  const { subscribe, set, update } = writable(/** @type {TypingUser[]} */ ([]));

  // Auto-cleanup: Remove typing indicators after 5 seconds of inactivity
  let cleanupInterval;

  function startAutoCleanup() {
    if (cleanupInterval) clearInterval(cleanupInterval);

    cleanupInterval = setInterval(() => {
      update(users => {
        const now = Date.now();
        return users.filter(user => now - user.startedAt < 5000);
      });
    }, 1000);
  }

  startAutoCleanup();

  return {
    subscribe,

    /**
     * User started typing
     * @param {TypingUser} user
     */
    startTyping(user) {
      update(users => {
        // Remove existing entry for this user
        const filtered = users.filter(u => u.id !== user.id);
        // Add new entry with current timestamp
        return [...filtered, { ...user, startedAt: Date.now() }];
      });
    },

    /**
     * User stopped typing
     * @param {string} userId
     */
    stopTyping(userId) {
      update(users => users.filter(u => u.id !== userId));
    },

    /**
     * Clear all typing indicators
     */
    clear() {
      set([]);
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
    }
  };
}

/**
 * Global store mapping listId -> typing store
 */
const typingStores = new Map();

/**
 * Get or create a typing store for a specific list
 * @param {string} listId - The list ID
 * @returns {ReturnType<typeof createTypingStore>}
 */
export function getTypingStore(listId) {
  if (!typingStores.has(listId)) {
    typingStores.set(listId, createTypingStore());
  }
  return typingStores.get(listId);
}

/**
 * Clean up a typing store
 * @param {string} listId
 */
export function cleanupTypingStore(listId) {
  const store = typingStores.get(listId);
  if (store) {
    store.clear();
    typingStores.delete(listId);
  }
}
