# ZipList Architecture

ZipList is a SvelteKit app with a local-first checklist core, server-side Gemini
transcription, optional local Whisper, optional PartyKit live sharing, and PWA
support.

## Entry Points

- `src/routes/+page.svelte` - Home page.
- `src/routes/+layout.svelte` - App layout wrapper.
- `src/routes/import/+page.svelte` - Static snapshot import flow.
- `src/routes/live/[roomId]/+page.svelte` - Join an existing live list room.
- `src/routes/api/gemini/+server.js` - Server-side Gemini transcription route.
- `src/routes/api/live/create/+server.js` - Contributor-gated PartyKit room
  creation proxy.
- `party/listRoom.ts` - PartyKit room server.

## UI Ownership

- `src/lib/components/mainPage/MainContainer.svelte` orchestrates the main app
  surface: title, recording controls, list carousel, footer, modals, and
  lifecycle hooks.
- `src/lib/components/mainPage/audio-transcript/` owns recording controls,
  waveform/progress display, and transcript display states.
- `src/lib/components/list/SingleList.svelte` owns the rich checklist UI:
  add/edit/delete/toggle, reorder, move item, rename list, static share, and live
  share controls.
- `src/lib/components/list/SwipeableLists.svelte` owns horizontal list
  navigation.
- `src/lib/components/mainPage/modals/` owns modal surfaces.
- `src/lib/components/layout/PageLayout.svelte` owns app shell metadata and page
  framing.

## Service Ownership

- `src/lib/services/audio/` - Browser recording and audio state.
- `src/lib/services/transcription/` - End-to-end transcription orchestration,
  Gemini/Whisper selection, and target-list locking.
- `src/lib/services/lists/` - List store, persistence, limits, commands, item
  operations, and completion matching.
- `src/lib/services/realtime/` - PartyKit client protocol, socket connection,
  live-list store bridge, presence, typing, and anonymous avatars.
- `src/lib/services/share/` - Static snapshot share/import URL handling.
- `src/lib/services/pwa/` - Install prompt state, installed-device setup,
  persistent storage requests, and Screen Wake Lock.
- `src/lib/services/theme/` - Theme and Chunky Mode application.
- `src/lib/services/infrastructure/` - Shared event bus, stores, haptics, and
  storage helpers.

## Data Flow

### Voice Add/Complete

```text
RecordButtonWithTimer
  -> audioService
  -> transcriptionService
  -> simpleHybridService
  -> Gemini or Whisper
  -> responseParser/listParser
  -> listsService
  -> listsStore
  -> SingleList
```

Gemini can return `{ items, complete }`. `items` are added to the captured target
list. `complete` entries are matched against existing unchecked items and toggled.
Whisper returns text only and does not perform semantic completion matching.

### Static Sharing

```text
SingleList
  -> shareService
  -> /import#listdata=...
  -> ImportConfirmationDialog
  -> listsService/listsStore
```

Static share is a snapshot. It does not stay connected to the source list.

### Live Sharing

```text
SingleList
  -> liveListsService.makeLive()
  -> /api/live/create
  -> PartyKit /parties/main/:roomId
  -> party/listRoom.ts
  -> /live/:roomId joiners
  -> liveListsService
  -> listsStore
```

Live sharing uses full-list snapshots plus typing events. That is intentional for
small ZipList lists and keeps the protocol portable. Presence is derived from
active connections and is not durable list data.

## Configuration

- `GEMINI_API_KEY` - Required for server-side Gemini transcription.
- `GEMINI_MODEL` - Optional; defaults in the Gemini route.
- `PARTYKIT_HOST` / `VITE_PARTYKIT_HOST` - Required for production live sharing.
- `PARTYKIT_CREATE_SECRET` - Must match between the app env and PartyKit env.
- `PUBLIC_FORCE_CONTRIBUTOR_MODE=true` - Local/dev contributor bypass only.

## PWA Notes

- The service worker owns the offline app shell only. It intentionally skips
  API/live/import routes and third-party/model downloads.
- Installed mobile PWAs can show `PwaDeviceSetup.svelte`, which primes
  microphone permission, requests persistent storage, and preloads Whisper.
- `wakeLockService` is requested while recording and released when recording
  stops or errors. Unsupported browsers are treated as a no-op.

## Organization Notes

- Current docs live in `docs/`.
- Historical cleanup plans and audits live in `docs/archive/`.
- `CLAUDE.md` and `GLOSSARY.md` are the high-signal orientation files for AI
  agents.
- There is no checked-in `AGENTS.md` or `CODEX.md` at this time.
