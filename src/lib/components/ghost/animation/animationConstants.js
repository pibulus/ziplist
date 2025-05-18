/**
 * Animation Constants
 * 
 * Shared constants for Ghost component animations.
 * This module is separate to prevent circular dependencies
 * between the animation services and state management.
 */

/**
 * Animation state constants
 */
export const ANIMATION_STATES = {
  INITIAL: "initial",
  IDLE: "idle",
  RECORDING: "recording",
  THINKING: "thinking",
  REACTING: "reacting",
  ASLEEP: "asleep",
  WAKING_UP: "waking_up",
  EASTER_EGG: "easter_egg",
};

/**
 * Valid state transitions
 */
export const ANIMATION_TRANSITIONS = {
  [ANIMATION_STATES.INITIAL]: [
    ANIMATION_STATES.INITIAL,
    ANIMATION_STATES.IDLE,
    ANIMATION_STATES.RECORDING,
  ],
  [ANIMATION_STATES.IDLE]: [
    ANIMATION_STATES.IDLE,
    ANIMATION_STATES.RECORDING,
    ANIMATION_STATES.THINKING,
    ANIMATION_STATES.REACTING,
    ANIMATION_STATES.ASLEEP,
    ANIMATION_STATES.EASTER_EGG,
  ],
  [ANIMATION_STATES.RECORDING]: [
    ANIMATION_STATES.RECORDING,
    ANIMATION_STATES.IDLE,
    ANIMATION_STATES.THINKING,
    ANIMATION_STATES.REACTING,
  ],
  [ANIMATION_STATES.THINKING]: [
    ANIMATION_STATES.THINKING,
    ANIMATION_STATES.IDLE,
    ANIMATION_STATES.RECORDING,
  ],
  [ANIMATION_STATES.REACTING]: [
    ANIMATION_STATES.REACTING,
    ANIMATION_STATES.IDLE,
    ANIMATION_STATES.RECORDING,
  ],
  [ANIMATION_STATES.ASLEEP]: [
    ANIMATION_STATES.ASLEEP,
    ANIMATION_STATES.WAKING_UP,
  ],
  [ANIMATION_STATES.WAKING_UP]: [
    ANIMATION_STATES.WAKING_UP,
    ANIMATION_STATES.IDLE,
  ],
  [ANIMATION_STATES.EASTER_EGG]: [
    ANIMATION_STATES.EASTER_EGG,
    ANIMATION_STATES.IDLE,
  ],
};

/**
 * Behaviors and settings for each animation state
 */
export const ANIMATION_BEHAVIORS = {
  [ANIMATION_STATES.INITIAL]: {
    cssClass: "animation-initial",
    eyeTracking: false,
    cleanupDelay: 0,
  },
  [ANIMATION_STATES.IDLE]: {
    cssClass: "animation-idle",
    eyeTracking: true,
    cleanupDelay: 0, // No automatic cleanup for idle
  },
  [ANIMATION_STATES.RECORDING]: {
    cssClass: "animation-recording",
    eyeTracking: true,
    cleanupDelay: 0, // No automatic cleanup for recording
  },
  [ANIMATION_STATES.THINKING]: {
    cssClass: "animation-thinking",
    eyeTracking: false,
    cleanupDelay: 0,
    blinkInterval: 1800, // ms between blinks in thinking state
    blinkDuration: 600, // ms duration of each blink
  },
  [ANIMATION_STATES.REACTING]: {
    cssClass: "animation-reacting",
    eyeTracking: true,
    cleanupDelay: 1200, // Auto-return to previous state after 1200ms
  },
  [ANIMATION_STATES.ASLEEP]: {
    cssClass: "animation-asleep",
    eyeTracking: false,
    cleanupDelay: 0, // No automatic cleanup for asleep
  },
  [ANIMATION_STATES.WAKING_UP]: {
    cssClass: "animation-waking-up",
    eyeTracking: false,
    cleanupDelay: 1000, // Time before transitioning to IDLE after waking up
  },
  [ANIMATION_STATES.EASTER_EGG]: {
    cssClass: "animation-easter-egg",
    eyeTracking: false,
    cleanupDelay: 2400, // Auto-return to IDLE after easter egg completes
  },
};

/**
 * CSS Classes for animations
 */
export const CSS_CLASSES = {
  WOBBLE_LEFT: "wobble-left",
  WOBBLE_RIGHT: "wobble-right",
  WOBBLE_BOTH: "wobble-both",
  PULSE: "pulse",
  SPIN: "spin",
  ASLEEP: "asleep",
  INITIAL_LOAD: "initial-load-effect",
};

/**
 * Animation timing configuration
 */
export const ANIMATION_TIMING = {
  IDLE_TO_RECORD_DELAY: 100,
  RECORD_TO_IDLE_DELAY: 100,
  // Total duration of initial load animation, including growth and wobble
  INITIAL_LOAD_DURATION: 2400, // ms
};

/**
 * Wobble animation configuration
 */
export const WOBBLE_CONFIG = {
  // Duration of the wobble animation effect in ms. Doubled from previous 600.
  DURATION: 1200,
  // Time to wait between random wobbles in ms
  MIN_WAIT: 15000,
  MAX_WAIT: 45000,
  // Amplitude of random wobbles
  AMPLITUDE: 0.5,
};

/**
 * Blink animation configuration
 */
export const BLINK_CONFIG = {
  // Time for a single blink
  SINGLE_DURATION: 150,
  // Time between blinks in a double blink
  DOUBLE_PAUSE: 130,
  // Random blink timing
  MIN_GAP: 4000,
  MAX_GAP: 10000,
  // Chance for double vs single blink
  DOUBLE_CHANCE: 0.3,
  // Inactivity timeout before falling asleep
  INACTIVITY_TIMEOUT: 60000, // 60 seconds
};

/**
 * Eye movement configuration
 */
export const EYE_CONFIG = {
  // Horizontal and vertical translation ranges in pixels
  X_MULTIPLIER: 5,
  Y_MULTIPLIER: 4,
  // Scale factor for closed eyes
  CLOSED_SCALE: 0.25,
  // Delay before reacting to transcript
  REACT_DELAY: 300,
  // Threshold for different reactions based on text length
  TEXT_THRESHOLD: 12,
};

/**
 * Special animation configuration
 */
export const SPECIAL_CONFIG = {
  // How often to check for special animation opportunities
  CHECK_INTERVAL: 30000, // 30 seconds
  // Chance of triggering a special animation on each check (0-1)
  CHANCE: 0.25, // 25% chance
  // Duration of special animations
  DURATION: 1600,
};