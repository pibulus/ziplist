import { listsStore, activeList, activeListItems } from './listsStore';
import { listParser } from '$lib/services/listParser';
import { get } from 'svelte/store';

/**
 * Lists Service
 * 
 * Provides a high-level interface for interacting with lists
 * and processing voice commands to manipulate lists.
 */
export class ListsService {
  constructor() {
    // Initialize the store
    if (typeof window !== 'undefined') {
      // Wait for next tick to ensure browser environment is fully ready
      setTimeout(() => {
        console.log('Initializing lists store from listsService constructor');
        listsStore.initialize();
      }, 0);
    }
  }

  /**
   * Process a transcription result and update lists accordingly
   * @param {Object} transcriptionResult - The result from transcription service
   */
  processTranscription(transcriptionResult) {
    if (!transcriptionResult) return;

    const { items, commands } = transcriptionResult;
    
    // Process commands first
    if (commands && commands.length > 0) {
      for (const command of commands) {
        this._processCommand(command);
      }
    }
    
    // Add any parsed items to the active list
    if (items && items.length > 0) {
      this._addItemsToActiveList(items);
    }
  }

  /**
   * Process a specific list command
   * @param {Object} command - Command object from listParser
   * @private
   */
  _processCommand(command) {
    if (!command || !command.command) return;
    
    switch (command.command) {
      case 'CREATE_LIST':
        // Extract list name from parameters or use default
        const listName = command.params && command.params.length > 0 
          ? command.params[0] 
          : 'New List';
        this.createList(listName);
        break;
        
      case 'CLEAR_LIST':
        this.clearActiveList();
        break;
        
      case 'REMOVE_LAST_ITEM':
        this.removeLastItem();
        break;
        
      case 'ADD_ITEM':
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
  createList(name = 'New List') {
    listsStore.addList(name);
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
  _addItemsToActiveList(items) {
    listsStore.addItems(items);
  }
  
  /**
   * Add a single item to the active list
   * @param {string} text - Item text
   */
  addItem(text) {
    if (!text) return;
    listsStore.addItem(text);
  }
  
  /**
   * Toggle the checked state of an item
   * @param {number|string} itemId - ID of the item to toggle
   */
  toggleItem(itemId) {
    listsStore.toggleItem(itemId);
  }

  /**
   * Edit an item's text
   * @param {number|string} itemId - ID of the item to edit
   * @param {string} newText - New text for the item
   */
  editItem(itemId, newText) {
    listsStore.editItem(itemId, newText);
  }
  
  /**
   * Remove an item from the active list
   * @param {number|string} itemId - ID of the item to remove
   */
  removeItem(itemId) {
    listsStore.removeItem(itemId);
  }
  
  /**
   * Remove the last item from the active list
   */
  removeLastItem() {
    const items = get(activeListItems);
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      listsStore.removeItem(lastItem.id);
    }
  }
  
  /**
   * Clear all items from the active list
   */
  clearActiveList() {
    listsStore.clearList();
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
   */
  reorderItems(reorderedItems) {
    listsStore.reorderItems(reorderedItems);
  }
}

// Export a singleton instance
export const listsService = new ListsService();