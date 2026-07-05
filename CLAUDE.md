# CLAUDE.md - Code Standards for ZipList

## Build & Development

- `npm run dev` - Start development server (runs on http://localhost:3001)
- `npm run dev:party` - Start local PartyKit server (runs on http://localhost:1999)
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run format` - Run Prettier formatter
- `npm run lint` - Check code formatting and run ESLint

## Project Overview

ZipList is a minimal voice-to-list todo app. Core features:

- Voice recording → Gemini API transcription → list items
- Full CRUD operations (add, toggle, edit, delete items)
- Drag-and-drop reorder with haptic feedback
- Local storage persistence with multiple color-coded lists (Blue, Pink, Yellow defaults + more)
- PWA support with offline capability
- Theme system (focus/chill/zen/nocturne/neo) with animated gradients
- Neo-Brutalist "Chunky Mode" style overlay
- Responsive design with mobile-first approach
- PartyKit real-time collaboration (optional — works without server)
- Canvas confetti celebrations, particle effects

**Current State**: ~97% complete. Three rounds of security/correctness audits
hardened CSP headers, rate limiter, PartyKit room auth (password hashing,
VALIDATION PROTOCOL), Square webhook idempotency, import payload bounds, and
response parser fail-closed behaviour. A fourth pass (2026-07-05, see
docs/FABLE-AUDIT.md) added atomic/locked server stores, per-visitor rate
buckets behind the tunnel, speech-bitrate recording, and dead-room live-share
handling. Remaining: set BODY_SIZE_LIMIT=16M in prod env (see KEYS.md),
real-device iPhone pass, sandbox-card checkout pass, production screenshots.

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
- **transcriptionService.js**: Manages recording-to-list transcription flow,
  target-list locking, and progress animation
- **simpleHybridService.js**: Chooses Gemini or local Whisper and handles
  fallback timing
- **responseParser.js**: Parses structured model responses into new items and
  completed-item matches
- **promptTemplates.js**: Prompt styles and existing-item context for completion
  detection
- **listsService.js**: Processes transcription results, commands, and completion
  matches into list mutations
- **listsStore.js**: Svelte store for list state and local storage (default lists + palette-safe list creation)
- **index.js (`applyTheme()`)**: Theme switching and persistence (`src/lib/index.js`)
- **pwa/pwaService.js**: Install prompt state, standalone/mobile detection,
  persistent storage requests, and installed-device setup completion
- **pwa/wakeLockService.js**: Feature-detected Screen Wake Lock wrapper used
  while recording
- **infrastructure/stores.js**: Central reactive state (audio, recording, transcription, UI)
- **infrastructure/hapticService.js**: Haptic feedback for touch interactions
- **realtime/liveListProtocol.js**: Shared PartyKit room ids, message names,
  limits, and validators
- **realtime/**: PartyKit live collaboration (liveListsService, partyService, presenceStore, typingStore, avatarService)
- **party/listRoom.ts**: PartyKit room server for validated live-list snapshots
  and ephemeral presence

### Component Structure

- **MainContainer.svelte**: Top-level orchestrator, handles recording state and lifecycle
- **ContentContainer.svelte**: Thin wrapper for AnimatedTitle (32 lines)
- **AnimatedTitle.svelte**: Title with staggered animation + floating "Dude" record button
- **SingleList.svelte**: Rich list component — CRUD, rename/add-list header controls, drag/drop, move actions, static share, live share, particles
- **RecordButtonWithTimer.svelte**: Voice recording button with waveform visualization
- **PwaDeviceSetup.svelte**: Installed mobile PWA setup pill for mic permission,
  persistent storage, and offline model preload
- **SwipeableLists.svelte**: Horizontal list navigation with touch/swipe
- **PageLayout.svelte**: App shell with responsive layout and fixed footer

### Live Sharing

- Live sharing is optional and hidden unless PartyKit host config is present or
  the app is running in local dev.
- Create flow: `SingleList` -> `liveListsService.makeLive()` ->
  `/api/live/create` -> PartyKit `/parties/main/:roomId`.
- PartyKit room ids use high-entropy `zl_...` ids.
- The live protocol intentionally uses full-list snapshots plus typing events.
  Keep it simple unless real usage proves conflict handling needs to become more
  granular.
- Presence is ephemeral; do not persist collaborator presence into durable room
  storage.
- Production deploy requires matching `PARTYKIT_CREATE_SECRET` in the app env and
  PartyKit env.

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

## Mascot Component

The app mascot renders through the portable SoftStack `Mascot.svelte`
(`src/lib/components/ui/`) — float bob, blinking eyes, aura, and the cross-app
sizing scale. ZipList passes its art inline via the default slot from
`AnimatedTitle.svelte`. (The earlier Ghost icon system was removed in the
cleanup arc.)

## Editor Configuration

- Default branch: main
- Code width: 80 characters
- Tab size: 2 spaces
