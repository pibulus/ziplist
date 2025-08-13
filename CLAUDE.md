# CLAUDE.md - Code Standards for TalkType

## Build & Development

⚠️ **CRITICAL DEVELOPMENT NOTICE** ⚠️

- **NEVER RUN `npm run dev`** - This will cause significant issues with the application and server environment.

- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run format` - Run Prettier formatter
- `npm run lint` - Check code formatting and run ESLint
- `npm run generate-ghost-assets` - Generate all ghost static assets from component definitions

## Code Style Guidelines

- **Framework**: Use idiomatic Svelte patterns; this is a SvelteKit project
- **JavaScript**: Standard JS (not TypeScript) with JSConfig for minimal type checking
- **Formatting**: Prettier with svelte and tailwind plugins
- **CSS**: Tailwind CSS with DaisyUI components
- **Naming**: Use descriptive camelCase for variables, PascalCase for components
- **Imports**: Use ES modules syntax, group imports by type, and follow the module pattern below
- **Error Handling**: Avoid window reference errors in SSR context
- **Component Structure**: Organize by functionality in lib/components
- **Services**: External API interactions belong in lib/services
- **Documentation**: Include JSDoc comments for functions
- **Reactivity**: Use Svelte's reactive declarations and statements properly

## Module & Import Pattern

Each module should follow this organization pattern:

1. **Directory Structure**:
   - Every feature directory should have an `index.js` file that exports the public API
   - Related files should be grouped in subdirectories (e.g., `animation/`, `state/`)
   - Component files (.svelte) should be in a `components/` subdirectory

2. **Import Best Practices**:
   - Import from directories, not specific files, for cross-directory imports:

     ```javascript
     // Good
     import { ghostStateStore } from "../state";

     // Avoid
     import { ghostStateStore } from "../state/ghostStateStore.js";
     ```

   - Use relative imports for files in the same directory:
     ```javascript
     // For files in the same directory
     import { animate } from "./animator";
     ```
   - Omit file extensions in imports:

     ```javascript
     // Good
     import { helper } from "./utils";

     // Avoid
     import { helper } from "./utils.js";
     ```

   - Use named exports and imports where possible (prefer destructuring)
   - When importing from SvelteKit paths, use the aliases:
     ```javascript
     import { browser } from "$app/environment";
     ```

3. **Export Pattern**:
   - Each `index.js` should re-export from its directory's files
   - Export named functions/objects rather than defaults when possible
   - Document the public API with JSDoc comments

This approach improves maintainability, provides clear module boundaries, and makes imports less brittle during refactoring.

## Text Animation System

The Ziplist app uses subtle text animations for improved user experience:

### Staggered Text Animation

- **Implementation**: Split text into `<span>` elements, one per letter
- **Animation**: Each letter fades in and moves up with CSS transitions
- **Timing**: Letters have cascading delays (50-100ms apart)
- **Performance**: Use `will-change` and hardware acceleration for smoothness
- **CSS Properties**:

  ```css
  .stagger-letter {
    display: inline-block;
    opacity: 0;
    transform: translateY(15px);
    animation: staggerFadeIn 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards;
    will-change: transform, opacity;
  }

  /* Incremental delays per letter */
  .stagger-letter:nth-child(1) {
    animation-delay: 0.05s;
  }
  .stagger-letter:nth-child(2) {
    animation-delay: 0.1s;
  }
  /* ... and so on */
  ```

### Slide-In Animation

- **Used For**: Subtitle text and other content blocks
- **Effect**: Text slides up and fades in simultaneously
- **Timing**: Typically starts after main title animation begins
- **CSS Properties**:
  ```css
  .slide-in-subtitle {
    opacity: 0;
    transform: translateY(10px);
    animation: slideIn 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards;
    animation-delay: 0.6s;
    will-change: transform, opacity;
    backface-visibility: hidden;
  }
  ```

### Animation Coordination

- **Sequence**: Main title → Subtitle → Interactive elements
- **Timing**: Total sequence completes in ~2-2.5 seconds
- **Session Management**: Optional storage-based tracking to show animations only on first visit

### Hover Effects

- **Title Hover**: Subtle pink text-shadow glow effect (15px radius with 0.6 opacity)
- **Subtitle Hover**: Color darkening with subtle pink text-shadow (8px radius with 0.3 opacity)
- **Timing**: All hover effects use smooth 0.3s ease transitions
- **Implementation**: Applied through dedicated CSS classes (.title-hover, .subtitle-hover)
- **Note**: Hover effects should be subtle and not interfere with entrance animations

## Ghost Component System

The Ghost component is a central UI element in TalkType that uses an SVG-based approach with reactive theming.

For detailed documentation of the Ghost component, including its architecture, animation system, and theme implementation, refer to:

```
/src/lib/components/ghost/README.md
```

### Key Architecture Principles

1. **Unified SVG with Layered Elements**: Uses a single SVG with multiple layers (background, outline, eyes)
2. **Hybrid State Management**:
   - Global theme state managed by Svelte stores in `themeStore.js`
   - Local animation states managed in component
3. **Direct Element Targeting**: Animations target SVG elements directly via ID selectors
4. **Theme System**: Centralized theme definitions with reactive updates
5. **Exportable Path Definitions**: SVG paths defined in `exportable/paths.js` for use by both components and static assets

### Critical Implementation Guidelines

- Apply animations directly to SVG elements via ID (#ghost-shape)
- Never apply animations to container groups (.ghost-bg, .ghost-layer)
- Force browser reflow between animation changes with `void element.offsetWidth`
- Clear all timeouts properly to prevent animation conflicts
- Use high specificity selectors for theme-specific animations

For implementing new themes or modifying existing ones, use the themeStore:

```javascript
import { setTheme } from "$lib/components/ghost";
setTheme("peach"); // Change to peach theme
```

## File Operations

- When reorganizing files, prefer using bash commands (`mv`, `mkdir`, etc.) over rewriting files
- This preserves git history and is more efficient for large files
- Example: `mv src/oldpath/file.js src/newpath/file.js` instead of read+write

## Editor Configuration

- Default branch: main
- Code width: 80 characters
- Tab size: 2 spaces
