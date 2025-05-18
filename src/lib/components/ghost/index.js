/**
 * Ghost Component System
 *
 * This module exports the public API for the Ghost component system, providing
 * access to the main Ghost component and related utilities.
 *
 * @module ghost
 */

import { Ghost, DisplayGhost } from "./components";
import { createEyeTracking } from "./tracking";
import { ghostStateStore } from "./state";
import { theme, setTheme, getThemeColor } from "./theme";
import { applyInitialLoadEffect, applyPulseEffect } from "./animation";
import { ANIMATION_STATES, ANIMATION_BEHAVIORS } from "./animation/animationConstants";

// Export the main components
export { Ghost, DisplayGhost };

// Export key utilities with descriptive names
export {
  createEyeTracking,
  setTheme,
  getThemeColor,
  applyInitialLoadEffect,
  applyPulseEffect,
};

/**
 * GhostSystem provides direct access to the core state and theme management systems.
 * Use this for advanced control over the Ghost component.
 *
 * @example
 * // Change theme
 * import { GhostSystem } from '$lib/components/ghost';
 * GhostSystem.themeStore.setTheme('mint');
 *
 * // Trigger animation state
 * GhostSystem.stateStore.setAnimationState('recording');
 * 
 * // Reactive access to ghost state in Svelte components:
 * import { GhostSystem } from '$lib/components/ghost';
 * 
 * // Extract the specific stores you need for reactive use with $ syntax
 * const isProcessingStore = GhostSystem.stateStore.isProcessing;
 * const isRecordingStore = GhostSystem.stateStore.isRecording;
 * 
 * // Then in your template:
 * // <Component isProcessing={$isProcessingStore} />
 * 
 * // IMPORTANT: Do NOT use $GhostSystem.stateStore.isProcessing directly!
 * // This will cause a "store_invalid_shape" error because GhostSystem is not a store.
 */
export const GhostSystem = {
  // Core state management
  stateStore: ghostStateStore,

  // Theme management
  themeStore: theme,
};

// Selective exports from animation for more controlled public API
export { ANIMATION_STATES, ANIMATION_BEHAVIORS };
