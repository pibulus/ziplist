/**
 * Ziplist Constants
 *
 * Central configuration for app-wide constants to maintain DRY principles
 * and make future adjustments easier.
 */

// Theme Configuration — matches CSS in src/lib/styles/theme-variables.css
export const THEMES = {
  FOCUS: "focus",
  CHILL: "chill",
  ZEN: "zen",
  NOCTURNE: "nocturne",
  NEO: "neo",
};

export const DEFAULT_THEME = THEMES.NEO;

// Local Storage Keys
export const STORAGE_KEYS = {
  // Application Settings
  THEME: "ziplist-vibe",
  FIRST_VISIT: "hasSeenZiplistIntro",
  AUTO_RECORD: "ziplist-autoRecord",
  LIST_FIRST_MODE: "ziplist-list-first-mode",
  SOUND_CUES: "ziplist-sound-cues",
  PROMPT_STYLE: "ziplist-prompt-style",
  DEBUG_MODE: "ziplist-debug-mode",
  CHUNKY_MODE: "ziplist-chunky-mode",
  CONTRIBUTOR: "ziplist-contributor",
  CONTRIBUTOR_TOKEN: "ziplist-contributor-token",
  CONTRIBUTOR_EXPIRES: "ziplist-contributor-expires",

  // PWA Related
  TRANSCRIPTION_COUNT: "ziplist-transcription-count",
  PWA_PROMPT_SHOWN: "ziplist-pwa-prompt-shown",
  PWA_PROMPT_COUNT: "ziplist-pwa-prompt-count",
  PWA_LAST_PROMPT_DATE: "ziplist-pwa-last-prompt-date",
  PWA_INSTALLED: "ziplist-pwa-installed",
  PWA_DEVICE_SETUP_COMPLETE: "ziplist-pwa-device-setup-complete",
  PWA_DEVICE_SETUP_DISMISSED_AT: "ziplist-pwa-device-setup-dismissed-at",

  // Lists Related
  LISTS: "ziplist-lists",
  ACTIVE_LIST_ID: "ziplist-active-list-id",
  LISTS_VERSION: "ziplist-lists-version",
};

// Prompt Styles
export const PROMPT_STYLES = {
  STANDARD: "standard",
  SURLY_PIRATE: "surlyPirate",
  LEET_SPEAK: "leetSpeak",
  SPARKLE_POP: "sparklePop",
  CODE_WHISPERER: "codeWhisperer",
  QUILL_AND_INK: "quillAndInk",
};

export const DEFAULT_PROMPT_STYLE = PROMPT_STYLES.STANDARD;

// Product limits: keep ZipList focused on quick, graspable lists.
export const PRODUCT_LIMITS = {
  RECORDING_SECONDS: 120,
  FREE_MAX_LISTS: 3,
  CONTRIBUTOR_MAX_LISTS: 12,
  LONG_LIST_NUDGE_AT: 60,
  MAX_ITEM_TEXT_LENGTH: 140,
  MAX_LIST_NAME_LENGTH: 32,
  MAX_IMPORT_ITEMS: 120,
  MAX_IMPORT_NAME_LENGTH: 120,
  SHARE_URL_WARNING_LENGTH: 1500,
};

// Animation Timing (in ms)
export const ANIMATION = {
  // Button animations
  BUTTON: {
    PRESS_DURATION: 400, // Duration of button press animation
    HOVER_TRANSITION: 300, // Transition time for button hover effects
    NOTIFICATION_TIMER: 2500, // Time to display notification in button
  },

  // Toast notifications
  TOAST: {
    DISPLAY_DURATION: 3000, // How long toasts stay visible
    ERROR_DURATION: 5000, // How long error toasts stay visible
  },

  // Modal timing
  MODAL: {
    CLOSE_DELAY: 50, // Delay before running closeModal function
    PERMISSION_ERROR_DURATION: 8000, // How long the permission error shows
  },

  // Recording time limits
  RECORDING: {
    LIMIT: PRODUCT_LIMITS.RECORDING_SECONDS, // Maximum recording time in seconds
    WARNING_THRESHOLD: 15, // Seconds remaining when to start showing warning
    DANGER_THRESHOLD: 8, // Seconds remaining when to start showing danger state
    ALMOST_DONE_THRESHOLD: 3, // Seconds remaining for final warning flash
    SCROLL_DELAY: 100, // Delay before scrolling during recording
    POST_RECORDING_SCROLL_DELAY: 650, // Delay after transcription to scroll
  },

  // Copy functionality
  COPY: {
    TOOLTIP_MAX_COUNT: 3, // Maximum number of times to show the copy tooltip
    SUCCESS_TIMER: 2500, // How long to show the success message
    FOCUS_RETURN_DELAY: 100, // Delay before returning focus after copy
  },

  // Confetti animation
  CONFETTI: {
    PIECE_COUNT: 48, // Reward burst without covering the list
    MIN_SIZE: 6, // Minimum confetti size in px
    MAX_SIZE: 14, // Maximum confetti size in px
    ANIMATION_DURATION: 1800, // Duration of entire confetti animation
    COLORS: ["#ff9cef", "#fde68a", "#a78bfa", "#f472b6", "#60a5fa"], // Confetti colors
  },
};

// CTA Button Phrases
export const CTA_PHRASES = [
  "Start Recording", // Always first
  "Talk a List",
  "Add by Voice",
  "Say the List",
  "Add More",
  "Talk More",
  "Just Say It",
  "Ready When You Are",
];

// ZipList specific phrases for different button contexts
export const ZIPLIST_START_PHRASES = ["Talk That List"];

export const ZIPLIST_ADD_PHRASES = [
  "Add More",
  "Talk More",
  "Add A Thing",
  "Keep Going",
  "Add To List",
];

// Clipboard Success Messages
export const COPY_MESSAGES = [
  "Copied to clipboard.",
  "Copied and ready to paste.",
  "All yours.",
  "Saved to clipboard.",
  "Got it.",
];

// Attribution Tags
export const ATTRIBUTION = {
  SIMPLE_TAG: "𝘊𝘳𝘦𝘢𝘵𝘦𝘥 𝘸𝘪𝘵𝘩 𝘡𝘪𝘱𝘭𝘪𝘴𝘵 👻",
  SHARE_POSTFIX: "\n\n𝘊𝘳𝘦𝘢𝘵𝘦𝘥 𝘸𝘪𝘵𝘩 𝘡𝘪𝘱𝘭𝘪𝘴𝘵 👻",
  FOCUS_RECOVERY_MESSAGE: "Click in the window first, then copy again.",
};

// Get a random element from any array
export function getRandomFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Vibration Patterns
export const VIBRATION = {
  START_RECORDING: [40, 60, 40],
  STOP_RECORDING: 50,
  COPY_SUCCESS: 25,
  ERROR: [20, 150, 20],
  PERMISSION_ERROR: [20, 100, 20, 100, 20],
};
