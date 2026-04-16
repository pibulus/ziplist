# CLAUDE.md - Code Standards for ZipList

## Build & Development

- `npm run dev` - Start development server (runs on http://localhost:3001)
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run format` - Run Prettier formatter
- `npm run lint` - Check code formatting and run ESLint

## Project Overview

ZipList is a minimal voice-to-list todo app. Core features:

- Voice recording → Gemini API transcription → list items
- Full CRUD operations (add, toggle, edit, delete items)
- Drag-and-drop reorder with haptic feedback
- Local storage persistence (3 default lists: Blue, Pink, Yellow)
- PWA support with offline capability
- Theme system (focus/chill/zen/nocturne/neo) with animated gradients
- Neo-Brutalist "Chunky Mode" style overlay
- Responsive design with mobile-first approach
- PartyKit real-time collaboration (optional — works without server)
- Canvas confetti celebrations, particle effects

**Current State**: ~80% complete. Core functionality solid, deployed to Pi. Needs: real screenshots, touch-based drag reorder polish, PartyKit production deploy.

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
- **listsStore.js**: Svelte store for list state and local storage (3 default lists)
- **themeService.js**: Theme switching and persistence
- **infrastructure/stores.js**: Central reactive state (audio, recording, transcription, UI)
- **infrastructure/hapticService.js**: Haptic feedback for touch interactions
- **realtime/**: PartyKit live collaboration (liveListsService, partyService, presenceStore, typingStore, avatarService)

### Component Structure

- **MainContainer.svelte**: Top-level orchestrator, handles recording state and lifecycle
- **ContentContainer.svelte**: Thin wrapper for AnimatedTitle (32 lines)
- **AnimatedTitle.svelte**: Title with staggered animation + floating "Dude" record button
- **SingleList.svelte**: Rich list component (1300 lines) — CRUD, drag/drop, particles, live collab
- **RecordButtonWithTimer.svelte**: Voice recording button with waveform visualization
- **SwipeableLists.svelte**: Horizontal list navigation with touch/swipe
- **Ghost.svelte**: Lightweight themed SVG icon (used in copy button)
- **PageLayout.svelte**: App shell with responsive layout and fixed footer

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

## Theme System

Five themes defined in `src/lib/styles/theme-variables.css` with 50+ CSS variables each:
- **focus** (warm tangerine), **chill** (cool mint), **zen** (lavender), **nocturne** (moonlight), **neo** (high-contrast, default)
- Applied via `data-theme` attribute on `<html>` root
- "Chunky Mode" (Neo-Brutalist) is an orthogonal style overlay
- Theme constants in `src/lib/constants.js`, application in `src/lib/index.js:applyTheme()`

## Ghost Component

Lightweight SVG icon (~50 lines) at `src/lib/components/ghost/Ghost.svelte`. Accepts `externalTheme` prop to tint fill color. Used as decorative copy-button icon in TranscriptDisplay. The original 20-file ghost animation system was removed in the cleanup arc.

## Editor Configuration

- Default branch: main
- Code width: 80 characters
- Tab size: 2 spaces
