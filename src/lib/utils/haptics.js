/**
 * Haptic Feedback Utility
 * Provides vibration feedback for user interactions
 */

/**
 * Trigger haptic feedback if supported
 * @param {number|number[]} pattern - Vibration pattern (single duration or array of durations)
 */
export function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/**
 * Predefined haptic patterns for common interactions
 */
export const HAPTIC_PATTERNS = {
  LIGHT: 20,
  MEDIUM: 50,
  HEAVY: 80,
  SUCCESS: [20, 30, 20],
  ERROR: [50, 100, 50],
  COMPLETE: [30, 50, 30, 50, 30],
  DRAG_START: 50,
  DRAG_OVER: 15,
  DRAG_END: [20, 30, 20]
};
