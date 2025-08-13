/**
 * @deprecated This file is maintained for backward compatibility only.
 * Please use ghostStateStore.js instead via GhostSystem.
 *
 * All functionality has been consolidated into ghostStateStore.js to provide
 * a single source of truth for ghost state management. This transitional
 * module forwards all accesses to the consolidated state store.
 */

import { derived } from "svelte/store";
import { ghostStateStore } from "./ghostStateStore";
import { theme as themeStore } from "../theme";

// Re-export the convenience exports from the ghostStateStore for compatibility
export const isRecording = ghostStateStore.isRecording;
export const isProcessing = ghostStateStore.isProcessing;

// Export the theme from the themeStore module for compatibility
export const theme = themeStore;

// Create a transitional ghostStore that forwards to ghostStateStore
// This maintains the same API shape for backward compatibility
export const ghostStore = {
  subscribe: ghostStateStore.subscribe,

  // Forward recording state changes
  setRecording: (value) => {
    console.warn(
      "ghostStore.setRecording is deprecated. Use GhostSystem.stateStore.setRecording instead.",
    );
    ghostStateStore.setRecording(value);
  },

  // Forward processing state changes
  setProcessing: (value) => {
    console.warn(
      "ghostStore.setProcessing is deprecated. Use GhostSystem.stateStore.setProcessing instead.",
    );
    ghostStateStore.setProcessing(value);
  },

  // Theme path (derived from theme)
  themePath: derived(theme, ($theme) => {
    switch ($theme) {
      case "mint":
        return "/talktype-icon-bg-gradient-mint.svg";
      case "bubblegum":
        return "/talktype-icon-bg-gradient-bubblegum.svg";
      case "rainbow":
        return "/talktype-icon-bg-gradient-rainbow.svg";
      default: // Default to peach
        return "/talktype-icon-bg-gradient.svg";
    }
  }),

  // Forward theme handling to the proper themeStore
  setTheme: (newTheme) => {
    console.warn(
      "ghostStore.setTheme is deprecated. Use GhostSystem.themeStore.setTheme instead.",
    );
    if (typeof themeStore.setTheme === "function") {
      themeStore.setTheme(newTheme);
    } else {
      themeStore.set(newTheme);
    }
  },

  // Get current state without subscribing
  getState: () => {
    console.warn(
      "ghostStore.getState is deprecated. Use GhostSystem.stateStore methods directly.",
    );
    return {
      isRecording: ghostStateStore.isRecording ? true : false,
      isProcessing: ghostStateStore.isProcessing ? true : false,
      theme: {
        current: theme ? theme : "peach",
      },
    };
  },
};
