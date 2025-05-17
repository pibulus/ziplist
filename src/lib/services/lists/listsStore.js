import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { StorageUtils } from '../infrastructure/storageUtils';
import { STORAGE_KEYS } from '$lib/constants';

// Default list structure
const DEFAULT_LIST = {
  id: 'default',
  name: 'Default List',
  items: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Current schema version
const CURRENT_VERSION = 1;

// Initialize the lists store
function createListsStore() {
  // Create the main store with default empty state
  const { subscribe, set, update } = writable({
    lists: [],
    activeListId: null,
    version: CURRENT_VERSION
  });

  // Initialize from localStorage or with defaults
  function initialize() {
    if (!browser) return;

    try {
      // Read directly from localStorage for debugging
      const rawListsJSON = localStorage.getItem(STORAGE_KEYS.LISTS);
      console.log('Raw lists JSON from localStorage:', rawListsJSON);
      
      // Check for existing stored lists
      let storedLists = null;
      try {
        if (rawListsJSON) {
          storedLists = JSON.parse(rawListsJSON);
          console.log('Parsed stored lists:', storedLists);
        }
      } catch (parseError) {
        console.error('Error parsing lists JSON:', parseError);
      }
      
      const storedActiveListId = localStorage.getItem(STORAGE_KEYS.ACTIVE_LIST_ID);
      console.log('Stored active list ID:', storedActiveListId);
      
      const storedVersionRaw = localStorage.getItem(STORAGE_KEYS.LISTS_VERSION);
      console.log('Stored version raw:', storedVersionRaw);
      const storedVersion = storedVersionRaw ? parseInt(storedVersionRaw, 10) : 0;

      // Initialize with stored data or defaults
      if (storedLists && storedLists.length > 0) {
        // Handle version migration if needed
        if (storedVersion < CURRENT_VERSION) {
          // Future migration logic would go here
          StorageUtils.setNumberItem(STORAGE_KEYS.LISTS_VERSION, CURRENT_VERSION);
        }

        // Set the store with stored lists
        set({
          lists: storedLists,
          activeListId: storedActiveListId || storedLists[0].id,
          version: CURRENT_VERSION
        });
      } else {
        // Initialize with a default list
        const defaultList = { ...DEFAULT_LIST };
        set({
          lists: [defaultList],
          activeListId: defaultList.id,
          version: CURRENT_VERSION
        });
        
        // Save to localStorage
        persistToStorage();
      }
      
      // Set up periodic cleanup of completed items
      setupAutoCleanup();
      
    } catch (error) {
      console.error('Error initializing lists from storage:', error);
      // Fallback to defaults on error
      const defaultList = { ...DEFAULT_LIST };
      set({
        lists: [defaultList],
        activeListId: defaultList.id,
        version: CURRENT_VERSION
      });
    }
  }

  // Persist current state to localStorage
  function persistToStorage() {
    if (!browser) return;

    try {
      const state = get({ subscribe });
      // Ensure we're actually getting data from the store
      console.log('Persisting lists to storage:', state.lists);
      
      // Explicitly stringify to debug
      const listsJSON = JSON.stringify(state.lists);
      console.log('Lists JSON:', listsJSON);
      
      // Use direct localStorage call for debugging
      localStorage.setItem(STORAGE_KEYS.LISTS, listsJSON);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, state.activeListId || '');
      localStorage.setItem(STORAGE_KEYS.LISTS_VERSION, String(state.version));
      
      // Verify it was stored properly
      console.log('Verification - Lists in localStorage:', localStorage.getItem(STORAGE_KEYS.LISTS));
    } catch (error) {
      console.error('Error persisting lists to storage:', error);
    }
  }

  // Generate a new unique ID for a list
  function generateListId() {
    return `list_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  // Add a new list
  function addList(name = 'New List') {
    update(state => {
      const newList = {
        id: generateListId(),
        name: name,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const newState = {
        ...state,
        lists: [...state.lists, newList],
        activeListId: newList.id // Auto-select the new list
      };
      
      return newState;
    });
    
    persistToStorage();
  }

  // Delete a list by ID
  function deleteList(listId) {
    update(state => {
      const listIndex = state.lists.findIndex(list => list.id === listId);
      if (listIndex === -1) return state;
      
      // Create a new array without the deleted list
      const newLists = [...state.lists];
      newLists.splice(listIndex, 1);
      
      // Ensure we have at least one list
      let activeListId = state.activeListId;
      if (newLists.length === 0) {
        const defaultList = { ...DEFAULT_LIST };
        newLists.push(defaultList);
        activeListId = defaultList.id;
      } else if (state.activeListId === listId) {
        // If we deleted the active list, select the first list
        activeListId = newLists[0].id;
      }
      
      return {
        ...state,
        lists: newLists,
        activeListId
      };
    });
    
    persistToStorage();
  }

  // Set the active list
  function setActiveList(listId) {
    update(state => {
      // Make sure the ID exists in our lists
      const listExists = state.lists.some(list => list.id === listId);
      if (!listExists) return state;
      
      return {
        ...state,
        activeListId: listId
      };
    });
    
    persistToStorage();
  }

  // Add an item to a specific list (or active list by default)
  function addItem(text, listId = null) {
    if (!text.trim()) return;
    
    update(state => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map(list => {
          if (list.id === targetListId) {
            return {
              ...list,
              items: [
                ...list.items,
                { id: Date.now(), text, checked: false }
              ],
              updatedAt: new Date().toISOString()
            };
          }
          return list;
        })
      };
    });
    
    persistToStorage();
  }

  // Add multiple items to a list (or active list)
  function addItems(items, listId = null) {
    if (!items || !items.length) return;
    
    update(state => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map(list => {
          if (list.id === targetListId) {
            // Map text strings to item objects
            const newItems = items.map((text, index) => ({
              id: Date.now() + Math.floor(Math.random() * 1000) + index,
              text,
              checked: false,
              order: list.items.length + index // Add order field to maintain sort order
            }));
            
            return {
              ...list,
              items: [...list.items, ...newItems],
              updatedAt: new Date().toISOString()
            };
          }
          return list;
        })
      };
    });
    
    persistToStorage();
  }

  // Toggle an item's checked state
  function toggleItem(itemId, listId = null) {
    update(state => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map(list => {
          if (list.id === targetListId) {
            return {
              ...list,
              items: list.items.map(item => {
                if (item.id === itemId) {
                  const now = new Date().toISOString();
                  return { 
                    ...item, 
                    checked: !item.checked,
                    // Add completedAt timestamp when checked, remove it when unchecked
                    completedAt: !item.checked ? now : undefined
                  };
                }
                return item;
              }),
              updatedAt: new Date().toISOString()
            };
          }
          return list;
        })
      };
    });

    persistToStorage();
    
    // If the item was checked, schedule cleanup of old completed items
    cleanupCompletedItems();
  }

  // Edit an item's text
  function editItem(itemId, newText, listId = null) {
    if (!newText || !newText.trim()) return;

    update(state => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map(list => {
          if (list.id === targetListId) {
            return {
              ...list,
              items: list.items.map(item =>
                item.id === itemId
                  ? { ...item, text: newText.trim() }
                  : item
              ),
              updatedAt: new Date().toISOString()
            };
          }
          return list;
        })
      };
    });

    persistToStorage();
  }

  // Remove an item from a list
  function removeItem(itemId, listId = null) {
    update(state => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map(list => {
          if (list.id === targetListId) {
            return {
              ...list,
              items: list.items.filter(item => item.id !== itemId),
              updatedAt: new Date().toISOString()
            };
          }
          return list;
        })
      };
    });
    
    persistToStorage();
  }

  // Clear all items from a list
  function clearList(listId = null) {
    update(state => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map(list => {
          if (list.id === targetListId) {
            return {
              ...list,
              items: [],
              updatedAt: new Date().toISOString()
            };
          }
          return list;
        })
      };
    });
    
    persistToStorage();
  }

  // Rename a list
  function renameList(newName, listId = null) {
    if (!newName.trim()) return;
    
    update(state => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map(list => {
          if (list.id === targetListId) {
            return {
              ...list,
              name: newName.trim(),
              updatedAt: new Date().toISOString()
            };
          }
          return list;
        })
      };
    });
    
    persistToStorage();
  }
  
  // Reorder items in a list
  function reorderItems(reorderedItems, listId = null) {
    update(state => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map(list => {
          if (list.id === targetListId) {
            // Update order field for each item based on its new position
            const updatedItems = reorderedItems.map((item, index) => ({
              ...item,
              order: index
            }));
            
            return {
              ...list,
              items: updatedItems,
              updatedAt: new Date().toISOString()
            };
          }
          return list;
        })
      };
    });
    
    persistToStorage();
  }

  // Initialize when created
  initialize();

  return {
    subscribe,
    initialize,
    addList,
    deleteList,
    setActiveList,
    addItem,
    addItems,
    toggleItem,
    editItem,
    removeItem,
    clearList,
    renameList,
    reorderItems,
    persistToStorage
  };
}

// Cleanup function for removing old completed items
function cleanupCompletedItems() {
  if (!browser) return;
  
  setTimeout(() => {
    update(state => {
      // 12 hours in milliseconds
      const EXPIRATION_TIME = 12 * 60 * 60 * 1000;
      const now = new Date();
      
      return {
        ...state,
        lists: state.lists.map(list => {
          // Filter out completed items older than 12 hours
          const filteredItems = list.items.filter(item => {
            // Keep all unchecked items
            if (!item.checked) return true;
            
            // Keep checked items with no completedAt timestamp (legacy items)
            if (!item.completedAt) return true;
            
            // Check if the item was completed more than 12 hours ago
            const completedAt = new Date(item.completedAt);
            const ageMs = now - completedAt;
            
            // Keep it if it's newer than the expiration time
            return ageMs < EXPIRATION_TIME;
          });
          
          // Only update the list if items were removed
          if (filteredItems.length !== list.items.length) {
            return {
              ...list,
              items: filteredItems,
              updatedAt: new Date().toISOString()
            };
          }
          return list;
        })
      };
    });
    
    persistToStorage();
  }, 1000); // Small delay to give the UI time to update
}

// Set up periodic cleanup of completed items (every hour)
function setupAutoCleanup() {
  if (!browser) return;
  
  // Run cleanup immediately on load
  cleanupCompletedItems();
  
  // Set interval to run cleanup every hour
  const cleanupInterval = setInterval(() => {
    cleanupCompletedItems();
  }, 60 * 60 * 1000); // Every hour
  
  // Clean up interval on window unload
  window.addEventListener('beforeunload', () => {
    clearInterval(cleanupInterval);
  });
}

// Create the store instance
export const listsStore = createListsStore();

// Derived store for the currently active list
export const activeList = derived(
  listsStore,
  $listsStore => {
    if (!$listsStore.activeListId) return null;
    return $listsStore.lists.find(list => list.id === $listsStore.activeListId) || null;
  }
);

// Derived store for the items in the active list
export const activeListItems = derived(
  activeList,
  $activeList => $activeList ? $activeList.items : []
);