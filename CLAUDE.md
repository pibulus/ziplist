# CLAUDE.md - Code Standards for ZipList

## Build & Development

- `npm run dev` - Start development server (runs on http://localhost:50002)
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run format` - Run Prettier formatter
- `npm run lint` - Check code formatting and run ESLint

## Project Overview

ZipList is a minimal voice-to-list todo app. Core features:
- Voice recording → Gemini API transcription → list items
- Full CRUD operations (add, toggle, edit, delete items)
- Local storage persistence
- PWA support with offline capability
- Theme system (peach/pink variants)
- Responsive design with mobile-first approach

**Current State**: 65% complete. Core functionality works, needs polish and export features.

## Code Style Guidelines

- **Framework**: Use idiomatic Svelte patterns; this is a SvelteKit project
- **JavaScript**: Standard JS (not TypeScript) with JSConfig for minimal type checking
- **Formatting**: Prettier with svelte and tailwind plugins
- **CSS**: Tailwind CSS with DaisyUI components
- **Naming**: Use descriptive camelCase for variables, PascalCase for components
- **Imports**: Use ES modules syntax, group imports by type
- **Error Handling**: Avoid window reference errors in SSR context
- **Component Structure**: Organize by functionality in lib/components
- **Services**: External API interactions belong in lib/services
- **Documentation**: Include JSDoc comments for functions
- **Reactivity**: Use Svelte's reactive declarations and statements properly

## Architecture

### Key Services
- **geminiService.js**: Wrapper for audio transcription via Gemini API
- **geminiApiService.js**: Low-level Gemini API calls (REQUIRED - do not delete)
- **transcriptionService.js**: Manages transcription flow with progress animation
- **listsService.js**: Processes transcription results into list items
- **listsStore.js**: Svelte store for list state and local storage
- **themeService.js**: Theme switching and persistence

### Component Structure
- **MainContainer.svelte**: Top-level container, handles recording state
- **GhostContainer.svelte**: SVG ghost character (linked to recording state)
- **SingleList.svelte**: Individual list component with full CRUD
- **RecordButtonWithTimer.svelte**: Voice recording button with visual feedback

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

### Critical Implementation Guidelines

- Apply animations directly to SVG elements via ID (#ghost-shape)
- Never apply animations to container groups (.ghost-bg, .ghost-layer)
- Force browser reflow between animation changes with `void element.offsetWidth`
- Clear all timeouts properly to prevent animation conflicts
- Use high specificity selectors for theme-specific animations

For implementing new themes or modifying existing ones, use the themeStore:

```javascript
import { setTheme } from "./ghost/themeStore";
setTheme("peach"); // Change to peach theme
```

## Editor Configuration

- Default branch: main
- Code width: 80 characters
- Tab size: 2 spaces
