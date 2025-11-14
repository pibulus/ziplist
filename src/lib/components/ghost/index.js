import Ghost from "./Ghost.svelte";
import { createEyeTracking } from "./eyeTracking";
import {
  ghostStateStore, // Use the main state store
  theme, // Use the theme store directly
} from "./stores";

// Export the main component and services
export { Ghost, createEyeTracking };

// Export the animation system (using direct store access)
export const GhostSystem = {
  // Core stores
  stateStore: ghostStateStore,
  themeStore: theme,
  // Consumers can derive specific states like isRecording: derived(ghostStateStore, $s => $s.isRecording)
};

// Default export remains the Ghost component
export default Ghost;
