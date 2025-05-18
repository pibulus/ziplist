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
 */
export const GhostSystem = {
  // Core state management
  stateStore: ghostStateStore,

  // Theme management
  themeStore: theme,
};

// Export specific submodules for advanced usage
export * from "./components";
export * from "./state";
export * from "./theme";
export * from "./exportable";

// Selective exports from animation and tracking for more controlled public API
export { ANIMATION_STATES, ANIMATION_BEHAVIORS } from "./animation";

/**
 * The main Ghost component.
 *
 * @example
 * <script>
 *   import Ghost from '$lib/components/ghost';
 * </script>
 *
 * <Ghost
 *   isRecording={false}
 *   isProcessing={false}
 *   externalTheme={appTheme}
 * />
 */
export default Ghost;
