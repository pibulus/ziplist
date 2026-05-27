import { listsStore, activeList, getItemDedupeKey } from "./listsStore";
import { get } from "svelte/store";

/**
 * Lists Service
 *
 * Provides a high-level interface for interacting with lists
 * and processing voice commands to manipulate lists.
 */
export class ListsService {
  constructor() {
    // Initialize the store
    if (typeof window !== "undefined") {
      // Wait for next tick to ensure browser environment is fully ready
      setTimeout(() => {
        listsStore.initialize();
      }, 0);
    }
  }

  _announceListNotice(result) {
    if (
      typeof window !== "undefined" &&
      result?.message &&
      (result.ok ||
        result.reason?.startsWith("max-") ||
        result.skippedCount > 0)
    ) {
      window.dispatchEvent(
        new CustomEvent("ziplist-list-notice", {
          detail: {
            message: result.message,
            success: !!result.ok,
          },
        }),
      );
    }
  }

  /**
   * Process a transcription result and update lists accordingly
   * @param {Object} transcriptionResult - The result from transcription service
   */
  processTranscription(transcriptionResult) {
    if (!transcriptionResult) return;

    const { items, commands, complete, targetListId } = transcriptionResult;

    // Process commands first
    if (commands && commands.length > 0) {
      for (const command of commands) {
        this._processCommand(command, targetListId);
      }
    }

    // Tick off items the user said they've completed
    if (complete && complete.length > 0) {
      this._completeItemsByText(complete, targetListId);
    }

    // Add any new items to the active list
    if (items && items.length > 0) {
      this._addItemsToActiveList(items, targetListId);
    }
  }

  /**
   * Mark items as complete by matching their text against the active list.
   * Uses case-insensitive exact match then falls back to substring match.
   * @param {string[]} completedTexts - Item texts Gemini identified as done
   * @param {string} [listId] - Optional target list ID
   * @private
   */
  _completeItemsByText(completedTexts, listId = null) {
    const state = get(listsStore);
    const targetListId = listId || state.activeListId;
    const activeList = state.lists.find((l) => l.id === targetListId);
    if (!activeList) return;

    const normalize = (text) => getItemDedupeKey(text);
    const completedItemIds = new Set();

    for (const completedText of completedTexts) {
      const needle = normalize(completedText);
      if (!needle) continue;

      const uncheckedItems = activeList.items.filter(
        (item) => !item.checked && !completedItemIds.has(item.id),
      );
      const exactMatch = uncheckedItems.find(
        (item) => normalize(item.text) === needle,
      );
      const substringMatches = uncheckedItems.filter((item) => {
        const haystack = normalize(item.text);
        return haystack.includes(needle) || needle.includes(haystack);
      });
      const substringMatch =
        substringMatches.length === 1 ? substringMatches[0] : null;
      const match = exactMatch || substringMatch;

      if (match) {
        completedItemIds.add(match.id);
        listsStore.toggleItem(match.id, targetListId);
      }
    }
  }

  /**
   * Process a specific list command
   * @param {Object} command - Command object from listParser
   * @private
   */
  _processCommand(command, targetListId = null) {
    if (!command || !command.command) return;

    switch (command.command) {
      case "CREATE_LIST": {
        // Extract list name from parameters or use default
        const listName =
          command.params && command.params.length > 0 ? command.params[0] : "";
        this._announceListNotice(this.createList(listName));
        break;
      }

      case "CLEAR_LIST":
        this.clearActiveList(targetListId);
        break;

      case "REMOVE_LAST_ITEM":
        this.removeLastItem(targetListId);
        break;

      case "ADD_ITEM":
        // This is handled by the item processing directly
        break;

      // Add future command handlers here
    }
  }

  /**
   * Get all available lists
   * @returns {Array} Array of list objects
   */
  getAllLists() {
    return get(listsStore).lists;
  }

  /**
   * Create a new list
   * @param {string} name - Name for the new list
   */
  createList(name = "") {
    return listsStore.addList(name);
  }

  /**
   * Add a predefined list (used for importing shared lists)
   * @param {Object} list - Complete list object to add
   * @returns {string} The ID of the newly added list
   */
  addList(list) {
    if (!list || !list.name) {
      throw new Error("Invalid list object");
    }

    // Create a new list with the properties from the shared list
    const name = list.name;
    const createResult = listsStore.addList(name);
    if (!createResult.ok) {
      throw new Error(createResult.message || "Could not import list");
    }

    // Get the newly created list
    const state = get(listsStore);
    const newListId = createResult.listId || state.activeListId;

    // Add all the items
    if (list.items && list.items.length > 0) {
      // Format for adding multiple items
      const itemTexts = list.items.map((item) => item.text);
      listsStore.addItems(itemTexts, newListId);

      // Now toggle the checked items
      const updatedState = get(listsStore);
      const updatedList = updatedState.lists.find((l) => l.id === newListId);

      if (updatedList) {
        list.items.forEach((sourceItem, index) => {
          if (sourceItem.checked && updatedList.items[index]) {
            listsStore.toggleItem(updatedList.items[index].id, newListId);
          }
        });
      }
    }

    return newListId;
  }

  /**
   * Set a list as the active list
   * @param {string} listId - ID of the list to activate
   */
  setActiveList(listId) {
    listsStore.setActiveList(listId);
  }

  /**
   * Get the currently active list
   * @returns {Object|null} The active list object or null
   */
  getActiveList() {
    return get(activeList);
  }

  /**
   * Add multiple items to the active list
   * @param {Array<string>} items - Array of item text strings
   * @private
   */
  _addItemsToActiveList(items, listId = null) {
    const result = listsStore.addItems(items, listId);
    this._announceListNotice(result);
    return result;
  }

  /**
   * Add a single item to the active list
   * @param {string} text - Item text
   * @param {string} [listId] - Optional list ID
   */
  addItem(text, listId = null) {
    if (!text) return false;
    return listsStore.addItem(text, listId);
  }

  /**
   * Toggle the checked state of an item
   * @param {number|string} itemId - ID of the item to toggle
   * @param {string} [listId] - Optional list ID
   */
  toggleItem(itemId, listId = null) {
    listsStore.toggleItem(itemId, listId);
  }

  /**
   * Edit an item's text
   * @param {number|string} itemId - ID of the item to edit
   * @param {string} newText - New text for the item
   * @param {string} [listId] - Optional list ID
   */
  editItem(itemId, newText, listId = null) {
    listsStore.editItem(itemId, newText, listId);
  }

  /**
   * Remove an item from the active list
   * @param {number|string} itemId - ID of the item to remove
   * @param {string} [listId] - Optional list ID
   */
  removeItem(itemId, listId = null) {
    listsStore.removeItem(itemId, listId);
  }

  /**
   * Move an item from one list to another
   * @param {number|string} itemId - ID of the item to move
   * @param {string} fromListId - Source list ID
   * @param {string} toListId - Destination list ID
   */
  moveItem(itemId, fromListId, toListId) {
    return listsStore.moveItem(itemId, fromListId, toListId);
  }

  /**
   * Remove the last item from the active list
   */
  removeLastItem(listId = null) {
    const state = get(listsStore);
    const targetListId = listId || state.activeListId;
    const targetList = state.lists.find((list) => list.id === targetListId);
    const items = targetList?.items || [];
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      listsStore.removeItem(lastItem.id, targetListId);
    }
  }

  /**
   * Clear all items from the active list
   * @param {string} [listId] - Optional list ID
   */
  clearActiveList(listId = null) {
    listsStore.clearList(listId);
  }

  /**
   * Delete a list by ID
   * @param {string} listId - ID of the list to delete
   */
  deleteList(listId) {
    listsStore.deleteList(listId);
  }

  /**
   * Rename the active list
   * @param {string} newName - New name for the list
   */
  renameActiveList(newName) {
    listsStore.renameList(newName);
  }

  /**
   * Reorder items in the active list
   * @param {Array} reorderedItems - Array of items in their new order
   * @param {string} [listId] - Optional list ID
   */
  reorderItems(reorderedItems, listId = null) {
    listsStore.reorderItems(reorderedItems, listId);
  }
}

// Export a singleton instance
export const listsService = new ListsService();
