# Ghost Component Cleanup Plan

This document outlines the proposed cleanup steps for the Ghost component system in the Ziplist/TalkType application.

## Current Issues

After reviewing the Ghost component system, we've identified several issues:

1. **Redundant Path Definitions**: SVG paths are defined in both `ghost-paths.svg` and `exportable/paths.js`, creating maintenance challenges.

2. **Component Duplication**: `Ghost.svelte` and `DisplayGhost.svelte` share significant code with minor differences.

3. **Disorganized File Structure**:

   - `eyeTracking.js` is in the root directory while other services are in the services/ folder
   - `themeStore.js` is in the root folder rather than the stores/ directory

4. **Animation Redundancies**: Some animations are defined in both CSS and JavaScript.

5. **Configuration Sprawl**: Animation parameters are spread across multiple files.

6. **Inconsistent Asset Generation**: The ghost asset generation relies on paths from `exportable/paths.js` but doesn't ensure consistency with `ghost-paths.svg`.

7. **Inconsistent Module Export Patterns**: Some files use default exports while others use named exports.

## Proposed Cleanup Steps

### 1. Consolidate Path Definitions

- Add missing paths (like the background path) to `exportable/paths.js`
- Update both Ghost components to use path constants directly
- Remove the dependency on the external SVG file
- Eventually remove the redundant `ghost-paths.svg` file

### 2. Reorganize File Structure

- Move `eyeTracking.js` to the services/ directory
- Move `themeStore.js` to the stores/ directory
- Group related animations in an animations/ subdirectory

### 3. Refactor Components

- Create a base `GhostBase.svelte` component that both `Ghost.svelte` and `DisplayGhost.svelte` can extend
- Extract common SVG structure and basic animations to the base component
- Ensure proper prop inheritance between components

### 4. Consolidate Animation Logic

- Choose either CSS or JavaScript for animations where possible
- Prefer CSS animations for performance
- Use JavaScript only for dynamic behaviors that CSS can't handle
- Remove duplicate animation definitions

### 5. Unify Configuration System

- Merge `animationConfig.js` and `gradientConfig.js` into a single configuration system
- Create a single source of truth for theme colors
- Standardize configuration parameter naming and structure

### 6. Standardize Module Export Patterns

- Decide on either singleton or factory pattern for services
- Use consistent export patterns across modules
- Document the chosen patterns in the README

### 7. Improve Asset Generation

- Update the asset generator to validate consistency between component SVGs and static assets
- Add validation to prevent path definition drift
- Ensure all assets use the same path definitions

## Implementation Priority

1. **High Priority**:

   - Consolidate path definitions to eliminate redundancy
   - Reorganize file structure for better organization

2. **Medium Priority**:

   - Refactor components to reduce duplication
   - Consolidate animation logic

3. **Lower Priority**:
   - Unify configuration system
   - Standardize module export patterns
   - Improve asset generation

## Benefits

Implementing these cleanup steps will:

1. Reduce code duplication and maintenance burden
2. Improve component performance
3. Make the codebase more maintainable
4. Ensure consistency across the application
5. Simplify future feature development

## Compatibility Considerations

When implementing these changes:

1. Maintain backwards compatibility with existing theme system
2. Ensure animations remain visually consistent
3. Test all components thoroughly after each change
4. Preserve existing public APIs where possible
