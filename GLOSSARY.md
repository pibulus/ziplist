# Glossary - ZipList

## Product Terms

- **ZipList** - A voice-to-checklist web app: talk, list, tick.
- **List card** - One color-coded checklist. The defaults are Blue, Pink, and
  Yellow.
- **Active list** - The list currently receiving typed, moved, imported, or
  transcribed items.
- **Static share** - A snapshot import URL generated from local list data.
- **Live share** - A PartyKit room URL where multiple devices edit the same list.
- **Contributor** - Paid/unlocked mode for more room and live sharing; the core
  local checklist stays useful without it.
- **Chunky Mode** - Optional neo-brutalist visual overlay, independent of theme.

## Main Components

- `PageLayout` - App shell, metadata, footer slot, and page framing.
- `MainContainer` - Top-level app orchestrator for intro/settings/modals,
  recording UI, list area, and footer events.
- `AnimatedTitle` - Brand/title area with the tappable Dude record affordance.
- `RecordButtonWithTimer` - Recording button, countdown/progress, and waveform
  state display.
- `SwipeableLists` - Mobile-first horizontal list navigation.
- `SingleList` - Main checklist surface: items, add/edit/delete/toggle, reorder,
  move actions, static share, and live share controls.
- `ListItem` / `ListItemBody` - Reusable row rendering and row actions.
- `DraftItemRow` - Inline typed-item entry row.
- `ImportConfirmationDialog` - Confirms snapshot imports from static share links.
- `SettingsModal` - Theme, prompt style, Chunky Mode, and contributor controls.
- `ContributorModal` - Contributor code/redeem/checkout entry.
- `IntroModal` - First-run onboarding.
- `AboutModal` - Product/about copy.
- `ExtensionModal` - Extension information modal. The packaged extension itself
  is not part of the current repo.
- `Mascot` - Portable SoftStack mascot/icon component (float, blink, aura).

## Services

- `audioService` - Browser microphone recording lifecycle and audio blob capture.
- `transcriptionService` - Main recording-to-list orchestration and progress
  state.
- `simpleHybridService` - Chooses Gemini or local Whisper, with Gemini fallback
  while Whisper loads.
- `whisperService` - Local Whisper Tiny loader/transcriber.
- `geminiApiService` - Server/client boundary for Gemini API calls.
- `geminiService` - Gemini transcription wrapper and structured response
  normalization.
- `responseParser` - Parses model JSON/text responses into new items and
  completion matches.
- `promptTemplates` / `promptManager` - Prompt style selection and existing-item
  context for completion detection.
- `listsStore` - Svelte store for local list records, persistence, limits, and
  item operations.
- `listsService` - Higher-level command/list API used by UI and transcription.
- `shareService` - Static snapshot share/import URL generation.
- `applyTheme` - Theme + Chunky Mode application/persistence (`src/lib/index.js`).
- `modalService` - DaisyUI dialog open/close helpers.
- `pwaService` - Install prompt state, standalone/mobile detection, persistent
  storage requests, and installed-device setup completion.
- `wakeLockService` - Feature-detected Screen Wake Lock wrapper used while
  recording.
- `liveListProtocol` - Shared PartyKit room ids, message names, limits, and
  validators.
- `partyService` - Low-level PartySocket client and room creation proxy calls.
- `liveListsService` - Bridges PartyKit room state into `listsStore`.
- `presenceStore` / `typingStore` - Per-live-list ephemeral collaborator state.

## Core Flows

- **Voice add** - `RecordButtonWithTimer` captures audio, `transcriptionService`
  transcribes it, `listsService` adds parsed items to the target list.
- **Voice completion** - Gemini can return `complete` matches for existing
  unchecked items; `listsService` toggles the matching target-list items.
- **Static import** - `shareService` encodes a snapshot URL, `/import` decodes it,
  and `ImportConfirmationDialog` adds it as a local list.
- **Live list** - `/api/live/create` creates a PartyKit room, `party/listRoom.ts`
  stores the validated snapshot, `/live/[roomId]` joins it, and
  `liveListsService` keeps local state in sync.

## Visual System

- **Themes** - `focus`, `chill`, `zen`, `nocturne`, and `neo`, defined through
  CSS variables in `src/lib/styles/theme-variables.css`.
- **Chunky Mode** - Orthogonal visual style overlay; it should respect the active
  theme variables.
- **Dude** - The tappable title-area character/record affordance.
