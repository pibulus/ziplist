/**
 * Ghost Animation Module
 * 
 * Centralized export point for all animation-related functionality.
 * Provides a clean public API while encapsulating implementation details.
 */

// Import animation constants from dedicated file to prevent circular dependencies
import {
  ANIMATION_STATES,
  ANIMATION_TRANSITIONS,
  ANIMATION_BEHAVIORS,
  CSS_CLASSES,
  WOBBLE_CONFIG,
  BLINK_CONFIG,
  ANIMATION_TIMING,
  EYE_CONFIG,
  SPECIAL_CONFIG
} from "./animationConstants";

// Import additional animation configuration
import {
  ANIMATION_EFFECTS,
  PULSE_CONFIG
} from "./animationConfig";

// Import core services (default exports)
import animationServiceObj from "./animationService";
import blinkServiceObj from "./blinkService";

// Import utility functions
import {
  forceReflow,
  toggleClasses,
  seedRandom,
  isBrowser,
  cleanupTimers
} from "./animationUtils";

// Import animation functions
import {
  initGradientAnimation,
  cleanupAnimation,
  cleanupAllAnimations
} from "./gradientAnimator";

// Import the Svelte action
import { initialGhostAnimation } from "./initialGhostAnimation";

// Re-export configuration constants
export {
  ANIMATION_STATES,
  ANIMATION_TRANSITIONS,
  ANIMATION_BEHAVIORS,
  CSS_CLASSES,
  WOBBLE_CONFIG,
  BLINK_CONFIG,
  ANIMATION_TIMING,
  ANIMATION_EFFECTS,
  PULSE_CONFIG,
  EYE_CONFIG,
  SPECIAL_CONFIG
};

// Re-export the initialGhostAnimation Svelte action
export { initialGhostAnimation };

// Re-export utility functions
export {
  forceReflow,
  toggleClasses,
  seedRandom,
  isBrowser,
  cleanupTimers
};

// Re-export gradient animation functions
export {
  initGradientAnimation,
  cleanupAnimation,
  cleanupAllAnimations
};

// applyInitialLoadEffect is already exported via animationService destructuring

// Re-export services as named exports for consistent access pattern
export const animationService = animationServiceObj;
export const blinkService = blinkServiceObj;

// Export specific functions from animation service for direct access
export const {
  initAnimations,
  initThemeAnimation,
  applyInitialLoadEffect,
  applyPulseEffect,
  startSpecialAnimationWatch,
  stopSpecialAnimationWatch
} = animationServiceObj;

// Export specific functions from blink service for direct access
export const {
  initBlinking,
  applyEyeTransforms,
  performSingleBlink,
  performDoubleBlink,
  applyRandomBlinkEffect,
  applyRhythmicBlinkEffect,
  applyQuickBlinkEffect,
  reactToTranscript,
  cleanupBlinking
} = blinkServiceObj;
