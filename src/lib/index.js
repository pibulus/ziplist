// Centralized stores for application state management
import { derived, writable } from "svelte/store";
import { browser } from "$app/environment";
import { env as publicEnv } from "$env/dynamic/public";
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

// Migration safety: a user may have a theme saved from a retired roster
// (e.g. "chill", "zen", "nocturne", "neo", "dayglo", "manila" from before
// the 2026-07-20 curation down to The Desk Drawer's four). If the stored
// value isn't one of the current THEMES, fall back to DEFAULT_THEME and
// re-persist it so the store, localStorage, and the picker's active-tile
// state all agree. app.html's inline pre-hydration script does the same
// check for the bare data-theme attribute; this covers the Svelte store.
if (browser) {
  const validThemeIds = Object.values(CONSTANTS.THEMES);
  const storedTheme = localStorage.getItem(CONSTANTS.STORAGE_KEYS.THEME);
  if (storedTheme && !validThemeIds.includes(storedTheme)) {
    theme.set(CONSTANTS.DEFAULT_THEME);
  }
}

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

// Store for a list-first working view that hides the mascot/title hero.
export const listFirstMode = createLocalStorageStore(
  CONSTANTS.STORAGE_KEYS.LIST_FIRST_MODE,
  "false",
);

// Store for tactile audio cue preference
export const soundCues = createLocalStorageStore(
  CONSTANTS.STORAGE_KEYS.SOUND_CUES,
  "true",
);

// Store for prompt style preference
export const promptStyle = createLocalStorageStore(
  CONSTANTS.STORAGE_KEYS.PROMPT_STYLE,
  CONSTANTS.DEFAULT_PROMPT_STYLE,
);

export const contributor = createLocalStorageStore(
  CONSTANTS.STORAGE_KEYS.CONTRIBUTOR,
  "false",
);

export const contributorToken = createLocalStorageStore(
  CONSTANTS.STORAGE_KEYS.CONTRIBUTOR_TOKEN,
  "",
);

function isForcedContributorMode() {
  return publicEnv.PUBLIC_FORCE_CONTRIBUTOR_MODE === "true";
}

const CONTRIBUTOR_TERM_DAYS = 365;
const CONTRIBUTOR_TERM_MS = CONTRIBUTOR_TERM_DAYS * 24 * 60 * 60 * 1000;

// Soft 1-year expiry (client-side localStorage — honest framing for a $9 app, not
// DRM). Missing stamp = legacy unlock, treated as still valid so we never lock out
// existing contributors.
function contributorExpiryOk() {
  if (!browser) return true;
  const raw = localStorage.getItem(CONSTANTS.STORAGE_KEYS.CONTRIBUTOR_EXPIRES);
  if (!raw) return true;
  const expires = Number(raw);
  return !Number.isFinite(expires) || Date.now() < expires;
}

export const isContributor = derived(contributor, ($contributor) => {
  if (isForcedContributorMode()) return true;
  return $contributor === "true" && contributorExpiryOk();
});

export function setContributorStatus(isUnlocked, token = null) {
  contributor.set(isUnlocked ? "true" : "false");

  if (token) {
    contributorToken.set(token);
    if (browser) {
      // Stamp a 1-year expiry from now (the contributor pass lasts a year).
      localStorage.setItem(
        CONSTANTS.STORAGE_KEYS.CONTRIBUTOR_EXPIRES,
        String(Date.now() + CONTRIBUTOR_TERM_MS),
      );
    }
  } else if (!isUnlocked) {
    contributorToken.set("");
    if (browser) {
      localStorage.removeItem(CONSTANTS.STORAGE_KEYS.CONTRIBUTOR_EXPIRES);
    }
  }
}

export function getContributorSnapshot() {
  if (isForcedContributorMode()) return true;
  if (!browser) return false;

  const hasUnlock =
    localStorage.getItem(CONSTANTS.STORAGE_KEYS.CONTRIBUTOR) === "true" ||
    Boolean(localStorage.getItem(CONSTANTS.STORAGE_KEYS.CONTRIBUTOR_TOKEN));
  return hasUnlock && contributorExpiryOk();
}

export function getContributorTokenSnapshot() {
  if (!browser) return "";
  return localStorage.getItem(CONSTANTS.STORAGE_KEYS.CONTRIBUTOR_TOKEN) || "";
}

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
