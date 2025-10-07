# Glossary - ZipList

## Components (Svelte)
- `MainContainer` - Top-level container, recording state (lib/components/mainPage/MainContainer.svelte)
- `GhostContainer` - SVG ghost character linked to recording (lib/components/mainPage/GhostContainer.svelte)
- `Ghost` - Base ghost SVG component (lib/components/ghost/Ghost.svelte)
- `DisplayGhost` - Ghost display wrapper (lib/components/ghost/DisplayGhost.svelte)
- `SingleList` - Individual list with full CRUD (lib/components/list/SingleList.svelte)
- `RecordButtonWithTimer` - Voice recording button with feedback (lib/components/mainPage/audio-transcript/RecordButtonWithTimer.svelte)
- `AudioVisualizer` - Audio waveform visualization (lib/components/mainPage/audio-transcript/AudioVisualizer.svelte)
- `TranscriptDisplay` - Transcription result display (lib/components/mainPage/audio-transcript/TranscriptDisplay.svelte)
- `AnimatedTitle` - Staggered text animation title (lib/components/mainPage/AnimatedTitle.svelte)
- `ContentContainer` - Main content wrapper (lib/components/mainPage/ContentContainer.svelte)
- `FooterComponent` - App footer (lib/components/mainPage/FooterComponent.svelte)
- `AboutModal` - About/info modal (lib/components/mainPage/modals/AboutModal.svelte)
- `ImportConfirmationDialog` - Import list confirmation (lib/components/list/ImportConfirmationDialog.svelte)
- `PageLayout` - Base page layout (lib/components/layout/PageLayout.svelte)

## Services
- `geminiService.js` - Gemini API audio transcription wrapper (lib/services/)
- `geminiApiService.js` - Low-level Gemini API calls (lib/services/)
- `transcriptionService.js` - Transcription flow + progress animation (lib/services/)
- `listsService.js` - Parse transcription → list items (lib/services/)
- `listsStore.js` - List state + local storage (lib/services/)
- `themeService.js` - Theme switching + persistence (lib/services/)
- `themeStore.js` - Ghost theme state management (lib/components/ghost/)

## Core Concepts
- **Voice-to-List** - Record voice → Gemini transcription → auto-parsed list items
- **Staggered Text Animation** - Letters fade/slide in with cascading delays (50-100ms)
- **Ghost Animation System** - SVG-based reactive theming with direct element targeting
- **PWA** - Progressive Web App with offline support
- **DaisyUI** - Tailwind component library for UI
- **Theme Variants** - Peach/pink color schemes
