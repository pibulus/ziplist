/**
 * Ghost Component State Management
 *
 * This module provides unified access to the ghost component state system.
 *
 * IMPORTANT: The state system has been consolidated. All functionality from
 * ghostStore has been merged into ghostStateStore for improved maintainability.
 *
 * For new code, please use the imports from ghostStateStore, preferably via
 * the GhostSystem object in the main ghost component index.
 *
 * Example:
 * ```
 * import { GhostSystem } from '$lib/components/ghost';
 *
 * // For using stores with $ syntax in Svelte components:
 * const isProcessingStore = GhostSystem.stateStore.isProcessing;
 * const isRecordingStore = GhostSystem.stateStore.isRecording;
 *
 * // Then in your template:
 * <Component isProcessing={$isProcessingStore} />
 * ```
 */

// Export everything from the consolidated ghostStateStore
export * from "./ghostStateStore";

// Historical note: ghostStore.js has been consolidated into ghostStateStore.js
// This multi-export pattern is maintained for backward compatibility
