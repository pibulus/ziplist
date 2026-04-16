// Centralized stores for application state management
import { writable } from "svelte/store";
import { browser } from "$app/environment";
import * as CONSTANTS from "./constants";

// Initialize store with localStorage value if available
function createLocalStorageStore(key, initialValue) {
  // Create the writable store
  const store = writable(initialValue);

  // Initialize from localStorage if in browser context
  if (browser) {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      store.set(storedValue);
    }
  }

  // Return a custom store that syncs with localStorage
  return {
    subscribe: store.subscribe,
    set: (value) => {
      if (browser) {
        localStorage.setItem(key, value);
      }
      store.set(value);
    },
    update: (fn) => {
      store.update((storeValue) => {
        const newValue = fn(storeValue);
        if (browser) {
          localStorage.setItem(key, newValue);
        }
        return newValue;
      });
    },
  };
}

// Create centralized store for theme/vibe management
export const theme = createLocalStorageStore(
  CONSTANTS.STORAGE_KEYS.THEME,
  CONSTANTS.DEFAULT_THEME,
);

// Create centralized store for modal visibility
export const showSettingsModal = writable(false);

// Store for first visit tracking
export const hasSeenIntro = createLocalStorageStore(
  CONSTANTS.STORAGE_KEYS.FIRST_VISIT,
  "false",
);

// Store for auto-record preference
export const autoRecord = createLocalStorageStore(
  CONSTANTS.STORAGE_KEYS.AUTO_RECORD,
  "false",
);

// Store for prompt style preference
export const promptStyle = createLocalStorageStore(
  CONSTANTS.STORAGE_KEYS.PROMPT_STYLE,
  CONSTANTS.DEFAULT_PROMPT_STYLE,
);

// Export all constants for use throughout the app
export { CONSTANTS };

// Helper function to apply theme across app components
export function applyTheme(vibeId) {
  // Update the store (which also updates localStorage)
  theme.set(vibeId);

  if (browser) {
    // Apply theme to document root — CSS variables handle the rest
    document.documentElement.setAttribute("data-theme", vibeId);
  }
}
