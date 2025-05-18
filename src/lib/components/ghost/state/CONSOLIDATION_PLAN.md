# Ghost Component Store Consolidation Plan

## Current State Analysis

We currently have two stores managing overlapping aspects of the Ghost component state:

1. **ghostStateStore.js**:
   - Main store with complete state machine implementation
   - Includes isRecording, isProcessing, animation states, eye tracking
   - Exported through GhostSystem and used throughout the codebase

2. **ghostStore.js**:
   - Simpler store with basic state (isRecording, isProcessing, theme)
   - Has derived stores for isRecording, isProcessing, theme
   - Minimal usage based on code analysis

## Consolidation Strategy

1. **Preserve Interfaces**: Maintain existing public APIs to prevent breaking changes
2. **Merge Functionality**: Move unique functionality from ghostStore to ghostStateStore
3. **Remove Redundancy**: Phase out ghostStore while maintaining compatibility
4. **Improve Documentation**: Clearly document the consolidated store pattern

## Implementation Steps

1. **Audit ghostStore References**:
   - Check all imports of ghostStore.js
   - Identify any components using its derived exports

2. **Implement Forwarding Layer**:
   - Add derived stores in ghostStateStore to match ghostStore's exports
   - Create a transitional bridge between the stores

3. **Update Index Exports**:
   - Modify state/index.js to export consolidated interfaces 
   - Document the transition for developers

4. **Remove Redundant Code**:
   - After ensuring all functionality is preserved, remove ghostStore.js

## Considerations

- Theme management appears to be primarily handled by themeStore.js, not ghostStore
- The ghostStore.js derived exports need to be maintained for compatibility
- We need to ensure SSR compatibility is maintained throughout

This approach will give us a cleaner state management architecture while maintaining backward compatibility.