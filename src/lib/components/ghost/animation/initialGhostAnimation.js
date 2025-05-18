/**
 * Svelte Action for Ghost Initial Animation Sequence
 *
 * This action orchestrates the initial animation for the ghost:
 * 1. Applies a CSS class to trigger the grow and wobble animation.
 * 2. Schedules a double blink to occur towards the end of the CSS animation.
 * 3. Dispatches an 'initialAnimationComplete' event when the sequence is finished.
 */

import { ANIMATION_TIMING, WOBBLE_CONFIG } from "./animationConfig";
import { browser } from "$app/environment";
import { ghostStateStore } from "../state";

/**
 * Checks if code is running in browser environment
 * @returns {boolean} True if in browser environment
 */
function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && browser;
}

export function initialGhostAnimation(node, initialParams) {
  // Check for browser environment first
  if (!isBrowser()) {
    return {
      update() {},
      destroy() {}
    };
  }

  let blinkTimeoutId = null;
  // Persist debug state across updates, initialized from the first set of params.
  let currentDebugState = initialParams?.debug || false;

  function runSetup(params) {
    // Always check browser environment
    if (!isBrowser()) return;

    // Always clear any existing timeout and remove the class from a potential previous run.
    if (blinkTimeoutId) {
      clearTimeout(blinkTimeoutId);
      blinkTimeoutId = null;
    }
    node.classList.remove("initial-load-effect");

    // Update the debug state based on the current parameters being processed.
    currentDebugState = params?.debug || false;

    // If params is falsy (e.g., undefined) or essential properties are missing,
    // the action should not proceed with its main logic.
    if (
      !params ||
      !params.blinkService ||
      !params.leftEye ||
      !params.rightEye
    ) {
      if (currentDebugState) {
        console.log(
          "[Action initialGhostAnimation] Essential params missing or params undefined. Setup skipped. Params:",
          params,
        );
      }
      return; // Exit setup if prerequisites are not met.
    }

    // Destructure after confirming params and its properties are valid.
    const { blinkService, leftEye, rightEye } = params;

    if (currentDebugState) {
      console.log(
        "[Action initialGhostAnimation] Running setup on node:",
        node,
        "with params:",
        params,
      );
    }

    // 1. Apply CSS class to trigger grow & wobble
    node.classList.add("initial-load-effect");
    if (currentDebugState) {
      console.log(
        '[Action initialGhostAnimation] Applied "initial-load-effect" class.',
      );
    }

    // 2. Schedule the double blink
    const blinkStartDelay =
      ANIMATION_TIMING.INITIAL_LOAD_DURATION - WOBBLE_CONFIG.DURATION;

    if (currentDebugState) {
      console.log(
        `[Action initialGhostAnimation] Scheduling double blink in ${blinkStartDelay}ms. Duration: ${ANIMATION_TIMING.INITIAL_LOAD_DURATION}, Wobble: ${WOBBLE_CONFIG.DURATION}`,
      );
    }

    blinkTimeoutId = setTimeout(() => {
      // Always check browser environment in async operations
      if (!isBrowser()) return;

      // Re-check debug state as it might have changed if update was called.
      // However, currentDebugState is updated at the start of runSetup.
      if (currentDebugState) {
        console.log(
          "[Action initialGhostAnimation] Timeout reached. Performing double blink. Eyes:",
          leftEye, // These are from the closure of runSetup, based on the params it received.
          rightEye,
        );
      }

      // It's good practice to ensure blinkService and eyes are still valid,
      // though they should be if this timeout is running from a valid setup.
      if (
        blinkService &&
        typeof blinkService.performDoubleBlink === "function" &&
        leftEye &&
        rightEye
      ) {
        // Make sure eyes are open before performing the double blink
        blinkService.applyEyeTransforms(leftEye, rightEye);
        
        blinkService.performDoubleBlink({ leftEye, rightEye }, () => {
          // Check browser environment again in callback
          if (!isBrowser()) return;

          if (currentDebugState) {
            console.log(
              '[Action initialGhostAnimation] Double blink complete. Ensuring eyes are open and dispatching "initialAnimationComplete" event.',
            );
          }
          
          // Explicitly ensure eyes are open after initial animation completes
          // This fixes the issue where eyes might stay closed after the initial animation
          if (blinkService && leftEye && rightEye) {
            // First update the store state
            blinkService.ghostStateStore.setEyesClosed(false);
            // Then force the visual update through applyEyeTransforms 
            setTimeout(() => {
              blinkService.applyEyeTransforms(leftEye, rightEye);
              if (currentDebugState) {
                console.log('[Action initialGhostAnimation] Forced eye open state after animation.');
              }
            }, 50); // Small delay to ensure state update is processed
          }
          
          node.dispatchEvent(new CustomEvent("initialAnimationComplete"));
        });
      } else {
        if (currentDebugState) {
          console.warn(
            "[Action initialGhostAnimation] Could not perform double blink during timeout. Missing blinkService, eye elements, or function.",
          );
        }
        // Fallback: dispatch completion event anyway so the app doesn't get stuck
        node.dispatchEvent(new CustomEvent("initialAnimationComplete"));
      }
    }, blinkStartDelay);
  }

  // Initial setup call with the parameters provided when the action is first applied.
  runSetup(initialParams);

  return {
    update(newParams) {
      // When Svelte updates the action's parameters, re-run the setup.
      // This handles transitions like:
      // - params initially undefined, then becoming defined (action activates).
      // - params initially defined, then becoming undefined (action deactivates/cleans up).
      // - params changing (e.g., debug flag toggling).
      if (!isBrowser()) return;
      runSetup(newParams);
    },
    destroy() {
      // Check browser environment before cleanup
      if (!isBrowser()) return;
      
      // Cleanup when the element is unmounted.
      if (blinkTimeoutId) {
        clearTimeout(blinkTimeoutId);
        blinkTimeoutId = null;
      }
      node.classList.remove("initial-load-effect"); // Ensure class is removed.
      if (currentDebugState) {
        // Log based on the last known debug state.
        console.log("[Action initialGhostAnimation] Destroying.");
      }
    },
  };
}