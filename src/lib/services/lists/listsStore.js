import { writable, derived, get } from "svelte/store";
import { browser } from "$app/environment";
import { STORAGE_KEYS } from "$lib/constants";

const LIST_COLOR_PRESETS = [
  {
    id: "list-blue",
    defaultName: "Blue List",
    color: "blue",
    primaryColor: "#00d4ff",
    accentColor: "#4dd0e1",
    glowColor: "rgba(0, 212, 255, 0.3)",
  },
  {
    id: "list-pink",
    defaultName: "Pink List",
    color: "pink",
    primaryColor: "#ff6ac2",
    accentColor: "#ff82ca",
    glowColor: "rgba(255, 106, 194, 0.3)",
  },
  {
    id: "list-yellow",
    defaultName: "Yellow List",
    color: "yellow",
    primaryColor: "#ffb000",
    accentColor: "#ffd700",
    glowColor: "rgba(255, 176, 0, 0.3)",
  },
  {
    defaultName: "Mint List",
    color: "mint",
    primaryColor: "#4fd1c5",
    accentColor: "#80e8de",
    glowColor: "rgba(79, 209, 197, 0.28)",
  },
  {
    defaultName: "Lavender List",
    color: "lavender",
    primaryColor: "#9b8cff",
    accentColor: "#c4b5fd",
    glowColor: "rgba(155, 140, 255, 0.28)",
  },
  {
    defaultName: "Coral List",
    color: "coral",
    primaryColor: "#ff8a7a",
    accentColor: "#ffb7ae",
    glowColor: "rgba(255, 138, 122, 0.28)",
  },
];

// Default lists configuration
const DEFAULT_LISTS = LIST_COLOR_PRESETS.slice(0, 3).map((palette) => ({
  id: palette.id,
  name: palette.defaultName,
  color: palette.color,
  primaryColor: palette.primaryColor,
  accentColor: palette.accentColor,
  glowColor: palette.glowColor,
  items: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

// Current schema version
const CURRENT_VERSION = 2;
const MAX_ITEM_TEXT_LENGTH = 180;

function normalizeItemText(text) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^[-\u2022*+]|\d+[.)]|\[\s*\]|\[\s*x\s*\]/i, "")
    .replace(/^["']|["']$/g, "")
    .replace(/^(?:and|then|also)\s+/i, "")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!normalized) return "";

  const clipped =
    normalized.length > MAX_ITEM_TEXT_LENGTH
      ? `${normalized.slice(0, MAX_ITEM_TEXT_LENGTH - 3).trim()}...`
      : normalized;

  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

function getItemDedupeKey(text) {
  return normalizeItemText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getListPaletteForIndex(index = 0) {
  return LIST_COLOR_PRESETS[index % LIST_COLOR_PRESETS.length];
}

function getListPaletteForRecord(list, index = 0) {
  if (list?.id) {
    const defaultList = DEFAULT_LISTS.find(
      (defaultRecord) => defaultRecord.id === list.id,
    );
    if (defaultList) {
      const defaultPalette = LIST_COLOR_PRESETS.find(
        (palette) => palette.color === defaultList.color,
      );
      if (defaultPalette) return defaultPalette;
    }
  }

  if (list?.color) {
    const matchingPalette = LIST_COLOR_PRESETS.find(
      (palette) => palette.color === list.color,
    );
    if (matchingPalette) return matchingPalette;
  }

  return getListPaletteForIndex(index);
}

function normalizeListRecord(list, index = 0) {
  const timestamp = new Date().toISOString();
  const palette = getListPaletteForRecord(list, index);
  const name =
    typeof list?.name === "string" && list.name.trim()
      ? list.name.trim()
      : palette.defaultName;

  return {
    ...list,
    name,
    color: list?.color || palette.color,
    primaryColor: list?.primaryColor || palette.primaryColor,
    accentColor: list?.accentColor || palette.accentColor,
    glowColor: list?.glowColor || palette.glowColor,
    items: Array.isArray(list?.items) ? list.items : [],
    createdAt: list?.createdAt || timestamp,
    updatedAt: list?.updatedAt || list?.createdAt || timestamp,
  };
}

function getUniqueListName(baseName, existingLists = []) {
  const normalizedBaseName = String(baseName || "").trim() || "New List";
  const existingNames = new Set(
    existingLists.map((list) =>
      String(list.name || "")
        .trim()
        .toLowerCase(),
    ),
  );

  if (!existingNames.has(normalizedBaseName.toLowerCase())) {
    return normalizedBaseName;
  }

  let suffix = 2;
  while (existingNames.has(`${normalizedBaseName} ${suffix}`.toLowerCase())) {
    suffix += 1;
  }

  return `${normalizedBaseName} ${suffix}`;
}

// Initialize the lists store
function createListsStore() {
  // Create the main store with default empty state
  const { subscribe, set, update } = writable({
    lists: [],
    activeListId: null,
    version: CURRENT_VERSION,
  });

  let _initialized = false;

  // Initialize from localStorage or with defaults
  function initialize() {
    if (!browser || _initialized) return;
    _initialized = true;

    try {
      const rawListsJSON = localStorage.getItem(STORAGE_KEYS.LISTS);
      let storedLists = null;

      try {
        if (rawListsJSON) {
          storedLists = JSON.parse(rawListsJSON);
        }
      } catch (parseError) {
        console.error("Error parsing lists JSON:", parseError);
      }

      const storedActiveListId = localStorage.getItem(
        STORAGE_KEYS.ACTIVE_LIST_ID,
      );

      // Initialize with stored data or defaults
      if (storedLists && storedLists.length > 0) {
        // Migration logic: If we have old lists but not the 3 fixed ones
        // We map the first old list to "Blue List" and create the others
        let finalLists = [...DEFAULT_LISTS];

        // Check if we need to migrate from single list
        const isOldSchema = !storedLists.some((l) => l.id === "list-blue");

        if (isOldSchema) {
          // Take items from the first stored list and put them in Blue List
          finalLists = DEFAULT_LISTS.map((defaultList, index) =>
            normalizeListRecord(defaultList, index),
          );
          if (storedLists[0] && storedLists[0].items) {
            finalLists[0] = normalizeListRecord(
              {
                ...finalLists[0],
                items: storedLists[0].items,
                updatedAt: storedLists[0].updatedAt || new Date().toISOString(),
              },
              0,
            );
          }
        } else {
          // Already migrated, preserve stored lists and ensure defaults exist
          const defaultIds = new Set(DEFAULT_LISTS.map((list) => list.id));
          const baseLists = DEFAULT_LISTS.map((defaultList, index) => {
            const found = storedLists.find((l) => l.id === defaultList.id);
            return normalizeListRecord(found || defaultList, index);
          });
          const extraLists = storedLists
            .filter((list) => !defaultIds.has(list.id))
            .map((list, index) =>
              normalizeListRecord(list, baseLists.length + index),
            );

          finalLists = [...baseLists, ...extraLists];
        }

        const resolvedActiveListId = finalLists.some(
          (list) => list.id === storedActiveListId,
        )
          ? storedActiveListId
          : finalLists[0].id;

        // Set the store with lists
        set({
          lists: finalLists,
          activeListId: resolvedActiveListId,
          version: CURRENT_VERSION,
        });

        const finalListsJSON = JSON.stringify(finalLists);
        const needsPersistence =
          isOldSchema ||
          finalListsJSON !== rawListsJSON ||
          resolvedActiveListId !== storedActiveListId;

        if (needsPersistence) {
          persistToStorage();
        }
      } else {
        const defaultLists = DEFAULT_LISTS.map((list, index) =>
          normalizeListRecord(list, index),
        );
        // Initialize with defaults
        set({
          lists: defaultLists,
          activeListId: defaultLists[0].id,
          version: CURRENT_VERSION,
        });

        // Save to localStorage
        persistToStorage();
      }

      registerLifecycleFlush();
    } catch (error) {
      console.error("Error initializing lists from storage:", error);
      const fallbackLists = DEFAULT_LISTS.map((list, index) =>
        normalizeListRecord(list, index),
      );
      // Fallback to defaults on error
      set({
        lists: fallbackLists,
        activeListId: fallbackLists[0].id,
        version: CURRENT_VERSION,
      });
    }
  }

  // Persist current state to localStorage (debounced)
  let _persistTimer = null;
  let _lifecycleFlushRegistered = false;

  function persistToStorage() {
    if (!browser) return;
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(_flushToStorage, 300);
  }

  function _flushToStorage() {
    if (_persistTimer) {
      clearTimeout(_persistTimer);
      _persistTimer = null;
    }

    try {
      const state = get({ subscribe });
      const listsJSON = JSON.stringify(state.lists);

      localStorage.setItem(STORAGE_KEYS.LISTS, listsJSON);
      localStorage.setItem(
        STORAGE_KEYS.ACTIVE_LIST_ID,
        state.activeListId || "",
      );
      localStorage.setItem(STORAGE_KEYS.LISTS_VERSION, String(state.version));
    } catch (error) {
      console.error("Error persisting lists to storage:", error);
      if (error.name === "QuotaExceededError" || error.code === 22) {
        if (browser && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("ziplist-storage-error", {
              detail: {
                message:
                  "Storage is full! Please delete some items to keep saving.",
              },
            }),
          );
        }
      }
    }
  }

  function registerLifecycleFlush() {
    if (
      !browser ||
      _lifecycleFlushRegistered ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }

    window.addEventListener("pagehide", _flushToStorage);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        _flushToStorage();
      }
    });
    _lifecycleFlushRegistered = true;
  }

  function generateListId() {
    return crypto.randomUUID();
  }

  // Add a new list
  function addList(name = "") {
    update((state) => {
      const palette = getListPaletteForIndex(state.lists.length);
      const resolvedName = getUniqueListName(
        name?.trim() ? name : palette.defaultName,
        state.lists,
      );
      const timestamp = new Date().toISOString();
      const newList = {
        id: generateListId(),
        name: resolvedName,
        color: palette.color,
        primaryColor: palette.primaryColor,
        accentColor: palette.accentColor,
        glowColor: palette.glowColor,
        items: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const newState = {
        ...state,
        lists: [...state.lists, newList],
        activeListId: newList.id, // Auto-select the new list
      };

      return newState;
    });

    persistToStorage();
  }

  // Delete a list by ID
  function deleteList(listId) {
    update((state) => {
      const listIndex = state.lists.findIndex((list) => list.id === listId);
      if (listIndex === -1) return state;

      // Create a new array without the deleted list
      const newLists = [...state.lists];
      newLists.splice(listIndex, 1);

      // Ensure we have at least one list
      let activeListId = state.activeListId;
      if (newLists.length === 0) {
        const defaultList = normalizeListRecord(
          { ...DEFAULT_LISTS[0], items: [] },
          0,
        );
        newLists.push(defaultList);
        activeListId = defaultList.id;
      } else if (state.activeListId === listId) {
        // If we deleted the active list, select the first list
        activeListId = newLists[0].id;
      }

      return {
        ...state,
        lists: newLists,
        activeListId,
      };
    });

    persistToStorage();
  }

  // Set the active list
  function setActiveList(listId) {
    update((state) => {
      // Make sure the ID exists in our lists
      const listExists = state.lists.some((list) => list.id === listId);
      if (!listExists) return state;

      return {
        ...state,
        activeListId: listId,
      };
    });

    persistToStorage();
  }

  // Add an item to a specific list (or active list by default)
  function addItem(text, listId = null) {
    const normalizedText = normalizeItemText(text);
    if (!normalizedText) return false;

    let itemAdded = false;

    update((state) => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map((list) => {
          if (list.id === targetListId) {
            const alreadyExists = list.items.some(
              (item) =>
                getItemDedupeKey(item.text) ===
                getItemDedupeKey(normalizedText),
            );
            if (alreadyExists) {
              return list;
            }

            itemAdded = true;
            return {
              ...list,
              items: [
                ...list.items,
                {
                  id: crypto.randomUUID(),
                  text: normalizedText,
                  checked: false,
                },
              ],
              updatedAt: new Date().toISOString(),
            };
          }
          return list;
        }),
      };
    });

    if (itemAdded) {
      persistToStorage();
    }

    return itemAdded;
  }

  // Add multiple items to a list (or active list)
  function addItems(items, listId = null) {
    if (!items || !items.length) return;

    update((state) => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map((list) => {
          if (list.id === targetListId) {
            const existingTexts = new Set(
              list.items.map((item) => getItemDedupeKey(item.text)),
            );
            // Map text strings to item objects
            const dedupedTexts = items
              .map((text) => normalizeItemText(text))
              .filter((text) => text.length > 0)
              .filter((text) => {
                const key = getItemDedupeKey(text);
                if (existingTexts.has(key)) {
                  return false;
                }
                existingTexts.add(key);
                return true;
              });

            const newItems = dedupedTexts.map((text, index) => ({
              id: crypto.randomUUID(),
              text,
              checked: false,
              order: list.items.length + index, // Add order field to maintain sort order
            }));

            if (newItems.length === 0) {
              return list;
            }

            return {
              ...list,
              items: [...list.items, ...newItems],
              updatedAt: new Date().toISOString(),
            };
          }
          return list;
        }),
      };
    });

    persistToStorage();
  }

  // Toggle an item's checked state
  function toggleItem(itemId, listId = null) {
    update((state) => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map((list) => {
          if (list.id === targetListId) {
            return {
              ...list,
              items: list.items.map((item) => {
                if (item.id === itemId) {
                  const now = new Date().toISOString();
                  return {
                    ...item,
                    checked: !item.checked,
                    // Add completedAt timestamp when checked, remove it when unchecked
                    completedAt: !item.checked ? now : undefined,
                  };
                }
                return item;
              }),
              updatedAt: new Date().toISOString(),
            };
          }
          return list;
        }),
      };
    });

    persistToStorage();
  }

  // Edit an item's text
  function editItem(itemId, newText, listId = null) {
    const normalizedText = normalizeItemText(newText);
    if (!normalizedText) return;

    update((state) => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map((list) => {
          if (list.id === targetListId) {
            return {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId ? { ...item, text: normalizedText } : item,
              ),
              updatedAt: new Date().toISOString(),
            };
          }
          return list;
        }),
      };
    });

    persistToStorage();
  }

  // Remove an item from a list
  function removeItem(itemId, listId = null) {
    update((state) => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map((list) => {
          if (list.id === targetListId) {
            return {
              ...list,
              items: list.items.filter((item) => item.id !== itemId),
              updatedAt: new Date().toISOString(),
            };
          }
          return list;
        }),
      };
    });

    persistToStorage();
  }

  // Clear all items from a list
  function clearList(listId = null) {
    update((state) => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map((list) => {
          if (list.id === targetListId) {
            return {
              ...list,
              items: [],
              updatedAt: new Date().toISOString(),
            };
          }
          return list;
        }),
      };
    });

    persistToStorage();
  }

  // Rename a list
  function renameList(newName, listId = null) {
    if (!newName.trim()) return;

    update((state) => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map((list) => {
          if (list.id === targetListId) {
            return {
              ...list,
              name: newName.trim(),
              updatedAt: new Date().toISOString(),
            };
          }
          return list;
        }),
      };
    });

    persistToStorage();
  }

  // Insert or replace a list record while preserving the target ID
  function upsertList(listData, listId = null) {
    if (!listData) return;

    update((state) => {
      const targetListId = listId || listData.id || state.activeListId;
      if (!targetListId) return state;

      const existingIndex = state.lists.findIndex(
        (list) => list.id === targetListId,
      );
      const normalizedList = normalizeListRecord(
        {
          ...listData,
          id: targetListId,
          items: Array.isArray(listData.items) ? listData.items : [],
          updatedAt: listData.updatedAt || new Date().toISOString(),
        },
        existingIndex === -1 ? state.lists.length : existingIndex,
      );

      if (existingIndex === -1) {
        return {
          ...state,
          lists: [...state.lists, normalizedList],
        };
      }

      return {
        ...state,
        lists: state.lists.map((list) =>
          list.id === targetListId
            ? { ...list, ...normalizedList, id: targetListId }
            : list,
        ),
      };
    });

    persistToStorage();
  }

  // Reorder items in a list
  function reorderItems(reorderedItems, listId = null) {
    const orderedIds = reorderedItems.map((item) =>
      typeof item === "object" ? item.id : item,
    );
    const orderedIdSet = new Set(orderedIds);

    update((state) => {
      const targetListId = listId || state.activeListId;
      return {
        ...state,
        lists: state.lists.map((list) => {
          if (list.id === targetListId) {
            const itemsById = new Map(
              list.items.map((item) => [item.id, item]),
            );
            const orderedItems = orderedIds
              .map((id) => itemsById.get(id))
              .filter(Boolean);
            const unseenItems = list.items.filter(
              (item) => !orderedIdSet.has(item.id),
            );

            const updatedItems = [...orderedItems, ...unseenItems].map(
              (item, index) => ({
                ...item,
                order: index,
              }),
            );

            return {
              ...list,
              items: updatedItems,
              updatedAt: new Date().toISOString(),
            };
          }
          return list;
        }),
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
    upsertList,
    reorderItems,
    persistToStorage,
  };
}

// Create the store instance
export const listsStore = createListsStore();

// Derived store for the currently active list
export const activeList = derived(listsStore, ($listsStore) => {
  if (!$listsStore.activeListId) return null;
  return (
    $listsStore.lists.find((list) => list.id === $listsStore.activeListId) ||
    null
  );
});

// Derived store for the items in the active list
export const activeListItems = derived(activeList, ($activeList) =>
  $activeList ? $activeList.items : [],
);
