import { Ghost } from "./components";
import { createEyeTracking } from "./tracking";
import { ghostStateStore } from "./state";
import { theme } from "./theme";

// For backwards compatibility with any missing imports
const AnimationDebugger = null; // Replace with actual import if exists

// Export the main component and services
export { Ghost, createEyeTracking, AnimationDebugger };

// Export the animation system (using direct store access)
export const GhostSystem = {
  // Core stores
  stateStore: ghostStateStore,
  themeStore: theme,

  // Debug component
  Debugger: AnimationDebugger,
  // Consumers can derive specific states like isRecording: derived(ghostStateStore, $s => $s.isRecording)
};

// Re-export from subdirectories for easy access
export * from "./components";
export * from "./animation";
export * from "./theme";
export * from "./tracking";
export * from "./state";
export * from "./exportable";

// Default export remains the Ghost component
export default Ghost;
