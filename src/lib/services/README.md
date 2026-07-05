# ZipList Services

This directory is the app's service layer. Components should call these modules
for browser APIs, persistence, transcription, sharing, and live collaboration
instead of reaching into those details directly.

## Directory Map

- `audio/` - Microphone recording lifecycle and audio states.
- `first-visit/` - First-run/onboarding state.
- `infrastructure/` - Shared Svelte stores, haptics, sound cues, storage
  helpers.
- `lists/` - List store, list mutations, command processing, local persistence.
- `modals/` - Dialog open/close helpers.
- `pwa/` - Install prompt, installed-device setup, persistent storage, and wake
  lock helpers.
- `realtime/` - PartyKit live-list client bridge, protocol, presence, typing,
  and anonymous avatar names.
- `share/` - Static snapshot share/import URL generation.
- `transcription/` - Recording-to-text orchestration plus local Whisper support.
- Root files - Gemini wrappers, prompt templates, and parser helpers.

Theme application lives in `src/lib/index.js` (`applyTheme()`), not in a
service directory.

## Main Flows

### Voice To List

1. UI records audio through `audioService`.
2. `transcriptionService` captures the target list id before transcription
   starts.
3. `simpleHybridService` chooses Gemini or local Whisper.
4. Gemini can return structured `{ items, complete }`; Whisper returns text only.
5. `responseParser` and `listsService` add new items and mark completion matches
   on the captured target list.

### Static Sharing

1. `shareService` encodes a local list snapshot into a share URL.
2. `/import` decodes the payload.
3. `ImportConfirmationDialog` lets the user add the snapshot as a local list.

### Live Sharing

1. `liveListsService.makeLive(listId)` asks `/api/live/create` to create a
   PartyKit room.
2. `partyService` connects to the room with `PartySocket`.
3. `liveListsService.connectToLive()` resolves only after receiving the room
   `init` message.
4. Validated full-list snapshots flow through `liveListProtocol`.
5. `presenceStore` and `typingStore` expose ephemeral collaborator state to UI.

### Installed PWA Setup

1. `pwaService.shouldShowDeviceSetup()` detects an installed mobile PWA that has
   not completed setup.
2. `PwaDeviceSetup.svelte` primes microphone permission, asks for persistent
   storage, and force-loads Whisper with progress from `whisperStatus`.
3. `wakeLockService` keeps supported screens awake only while recording.

## Ownership Rules

- Keep external API calls in services or SvelteKit server routes.
- Keep UI components focused on interaction state and rendering.
- Keep list mutation rules in `listsStore`/`listsService`; avoid duplicating them
  in components.
- Keep PartyKit message names, ids, limits, and validation in
  `realtime/liveListProtocol.js`.
- Keep install, storage, and wake-lock browser API handling in `pwa/`.
- Preserve SSR safety: browser globals need guards or SvelteKit `browser` checks.

## Public Entry

Import services from their own modules (e.g.
`$lib/services/lists/listsService`) or a subdirectory barrel like
`$lib/services/infrastructure`. There is intentionally no top-level services
barrel.
