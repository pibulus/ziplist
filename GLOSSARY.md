# Glossary - ZipList

## Product Terms

- **ZipList** - A voice-to-checklist web app: talk, list, tick.
- **List card** - One color-coded checklist. The defaults are Blue, Pink, and
  Yellow.
- **Active list** - The list currently receiving typed, moved, imported, or
  transcribed items.
- **Static share** - A snapshot import URL generated from local list data.
- **Live share** - A Cloudflare Durable Object room URL (`/live/[roomId]` or `/j/[phrase]`) where multiple devices edit the same list.
- **Device Sync** - End-to-end encrypted (`AES-GCM`) multi-list sync across a user's paired devices (`zl_p*` rooms), keyed by a link fragment (`#k=`).
- **Contributor / ZipList Passport** - Unlocked mode for up to 12 lists, live rooms, E2EE Device Sync, and holographic Passport card; the core local checklist stays complete without it.
- **Vibes** - The four stationery palettes (`Highlighter` / `focus`, `Sticky Note` / `chill`, `Gel Pen` / `zen`, `Legal Pad` / `nocturne`) paired with permanent Soft Neo-Toybrut styling.

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
- `ListItemBody` - Reusable row rendering and row actions (checkbox, text,
  reorder/delete ghost twins).
- `DraftItemRow` - Inline typed-item entry row.
- `ImportConfirmationDialog` - The share landing card: branded page a static
  share link opens, with the list preview and Save to ZipList.
- `SettingsModal` - Vibe picker, Sound/Haptics/Voice/Layout toggles, room handle + avatar, and
  ZipList Passport entry.
- `ContributorModal` - ZipList Passport card, E2EE Device Sync pairing, redeem, and checkout entry.
- `QrShareModal` - Live room QR & 4-word phrase sharing modal.
- `IntroModal` - First-run onboarding.
- `AboutModal` - Product pitch, contributor tip deck, and use-case guide links.
- `Mascot` - Portable SoftStack mascot/icon component (float, blink, aura).
- `BrandMark` - Mini mascot + ZipList.app wordmark letterhead used on
  standalone pages (share landing, live rooms, list-first mode).
- `ThemeMascot` - Tiny per-theme mascot swatch used by the vibe picker.

## Services

- `audioService` / `audioRecorderService` - Browser microphone recording lifecycle and audio blob capture.
- `transcriptionService` - Main recording-to-list orchestration and progress
  state.
- `geminiApiService` - Server/client boundary for Gemini API calls.
- `geminiService` - Single-pass Gemini audio transcription wrapper and structured response
  normalization (`{ items, complete }`).
- `responseParser` - Parses model JSON/text responses into new items and
  completion matches.
- `promptTemplates` / `promptManager` - Prompt style selection and existing-item
  context for completion detection.
- `listsStore` - Svelte store for local list records, persistence, limits, and
  item operations.
- `listsService` - Higher-level command/list API used by UI and transcription.
- `shareService` - Static snapshot share/import URL generation.
- `themeService` (`applyTheme`) - Vibe + Soft Neo-Toybrut styling application/persistence (`src/lib/services/theme/themeService.js`).
- `soundService` + `typewriterWiring` - `@softstack/juicy-sounds` WebAudio cues (`check`, `uncheck`, `bloom`, `sparkle`, `copySuccess`, `fanfare`, `locked`, `delete`, `clear`, `select`, `recordStart`, `recordStop`) and Cherry MX mechanical key clicks.
- `modalService` - Native `<dialog>` top-layer open/close helpers.
- `pwaService` - Install prompt state, standalone/mobile detection, persistent
  storage requests, and installed-device setup completion.
- `wakeLockService` - Feature-detected Screen Wake Lock wrapper used while
  recording.
- `liveListProtocol` - Shared live room ids, message names, limits, and
  validators.
- `partyService` - Low-level PartySocket client and room creation proxy calls.
- `liveListsService` - Bridges Cloudflare Durable Object room state into `listsStore`.
- `deviceSyncStore` / `syncCrypto` / `listMergeService` - Client-side AES-GCM multi-list Device Sync and field-level merge with tombstones.
- `presenceStore` / `typingStore` - Per-live-list ephemeral collaborator state.
- `avatarService` - Editable room names ("Zesty Bear" by default) plus
  DiceBear thumbs faces, generated offline as SVG data-URIs.

## Core Flows

- **Voice add** - `RecordButtonWithTimer` captures audio, `transcriptionService`
  sends it to Gemini, and `listsService` adds parsed items to the target list.
- **Voice completion** - Gemini can return `complete` matches for existing
  unchecked items; `listsService` toggles the matching target-list items.
- **Static import** - `shareService` encodes a snapshot URL, `/import` decodes it,
  and `ImportConfirmationDialog` adds it as a local list.
- **Live list** - `/api/live/create` creates a Cloudflare Durable Object room, `worker/index.ts`
  stores the validated snapshot, `/live/[roomId]` (or `/j/[phrase]`) joins it, and
  `liveListsService` keeps local state in sync.

## Visual System

- **Vibes** - `focus` (_Highlighter_), `chill` (_Sticky Note_), `zen` (_Gel Pen_), and `nocturne` (_Legal Pad_), defined through
  CSS variables in `src/lib/styles/theme-variables.css`.
- **Soft Neo-Toybrut** - Permanent tactile card & modal styling (`chunky-mode` on `<body>`), warm cream surfaces (`#fffef7` / `#fbf1e4`), warm sepia ink (`#1e1714`), and TalkType-aligned modal geometry.
- **Dude** - The tappable title-area character/record affordance.
- **Design laws** (settled 2026-07-09) - The cream page ground is constant across
  themes; the CTA is one flat brand yellow (`--zl-cta-color`); gradients are
  within-family shade offsets only; quiet actions share one ghost stroke-icon
  language; copy never shouts, commands, or speaks as the user.
