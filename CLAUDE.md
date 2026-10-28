# CLAUDE.md - Code Standards for ZipList

## Build & Development

- `npm run dev` - Start development server (runs on http://localhost:3001)
- `npm run dev:party` - Start local Cloudflare Worker room relay via Wrangler (runs on http://localhost:1999)
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
- Four stationery Vibes (**Highlighter**, **Sticky Note**, **Gel Pen**, **Legal Pad**) with Soft Neo-Toybrut styling
- Tactile sound system (`@softstack/juicy-sounds` + Cherry MX typewriter keys + rising checkbox pitch cascade)
- Responsive design with mobile-first approach
- Cloudflare Durable Object real-time room collaboration & E2EE Device Sync (optional — works without server)
- Canvas confetti celebrations, particle effects

**Current State**: ~99% complete, v1.0 runway. The 2026-07-09→10
design-coherence arc (merged to main, see docs/FABLE-AUDIT.md) settled the
design laws: constant cream page ground, one flat brand-yellow CTA
(`--zl-cta-color`), within-family gradients only, one ghost stroke-icon
language, branded share/live landing pages (BrandMark letterhead), DiceBear
room avatars with editable names, and the copy voice rules (no all-caps, no
imperatives at users, never speak as the user).

**DEPLOY TARGET IS NETLIFY, NOT THE PI** (corrected 2026-07-31 — this file
said Pi for weeks and it was wrong). `ziplist.app` is served by Netlify
(`ziplist-netlify`); `netlify deploy --prod --build` is the ship command, and
env vars live in the Netlify dashboard, NOT in `~/.config/fleet/keys.env`.
The fleet `keys-sync ziplist` / `/etc/ziplist.env` path does not touch this
app. `scripts/deploy-pi.sh` and adapter-node are still there for a Pi deploy
that isn't currently used. Verify with: `curl -sI https://ziplist.app | grep -i server`.

`BODY_SIZE_LIMIT=16M` is no longer a v1.0 blocker: that was a Pi concern.
Recording is capped at 60s at 48kbps (halved from 120s on 2026-08-17), so
the worst case is ~360KB of audio → ~500KB base64 request, comfortably under
Netlify's 6MB function payload limit (which is a hard platform limit and
cannot be raised).

Remaining for v1.0 is hands-on only: real-device iPhone + two-phone live
pass, sandbox-card checkout, screenshots → tag v1.0.0. Post-launch charter
lives in docs/V1.1.md (including the hard cutoffs: no dates, no nested items,
no multi-list rooms, no accounts).

**Security headers**: exactly TWO sources, and they must stay in sync —
`src/hooks.server.js` (server-rendered) and `netlify.toml` (prerendered
homepage, which no hook can reach). Do NOT add a second `hooks.server.*` or a
`_headers` file; both were tried on 2026-07-31 and each silently shadowed the
real CSP, leaving the live site with no Content-Security-Policy at all.

## When you hit a decision that isn't yours

This repo diagnoses well and decides badly. Twice the right answer was
written down, correctly, and then never acted on:

- `349550e` regrouped the seven share-tray buttons and said in its own
  commit message that the real fix was a cut it would not make, because
  "cutting a working feature is a product call, not a layout one."
- `NEXT.md` described the Prettier hole exactly, down to "it is a
  decision, not a chore."

Both were right. Neither reached a human, so the share tray stayed a
junk drawer and 44 components went unformatted. The deferral was correct;
the destination was not.

**A commit message is not an inbox. `NEXT.md` is not an inbox.** When a
task turns out to need a product call — cutting a feature, reformatting
the repo, changing what a control means — ask in the conversation, as one
question, before shipping the half you can do. It costs the human forty
seconds. Writing it into a file nobody greps is how a two-minute decision
becomes a months-long loop.

## Surface-area budget

`docs/V1.1.md` sets hard cutoffs for features (no dates, no nested items,
no multi-list rooms, no accounts). Nothing set a cutoff for _controls_, so
every shipped feature parked its affordance in the nearest open tray and
the share tray reached seven buttons — not one bad call, a dozen good ones
with nowhere else to go.

- The share tray is for sharing; the list `⋯` is for unmaking. When
  something lands in one of them that is neither, that is the smell.
- Prefer replacing a control over adding one. Three-ish in a tray is
  where it still reads as a choice rather than a menu.
- Adding a button because there is nowhere else to put it is the signal
  to stop and think about where it actually belongs.

These are heuristics, not statute. They exist to stop drift, not to win
arguments — if the sensible, functional thing breaks one of them, do the
sensible thing and say why. A rule quoted back at a real problem instead
of solving it is worse than no rule.

## Code Style Guidelines

- **Framework**: Use idiomatic Svelte patterns; this is a SvelteKit project
- **JavaScript**: Standard JS (not TypeScript) with JSConfig for minimal type checking
- **Formatting**: Prettier with svelte and tailwind plugins, loaded by
  `.prettierrc`. That config is load-bearing: without it Prettier has no
  parser for `.svelte` and skips all 44 components in silence while still
  reporting the run green. `prettier-plugin-tailwindcss` must stay last in
  the plugin list, and below 0.8.0 it cannot wrap `prettier-plugin-svelte`
  on Prettier 3.9 at all (`getVisitorKeys is not a function`).
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

- **geminiService.js**: Wrapper for audio transcription via Gemini API. Gemini
  takes the audio and returns the transcript AND the parsed items/completions
  in one pass — it is not transcribe-then-parse. The local Whisper fallback was
  removed 2026-07-31 (text only, so item splitting fell back to a regex and
  completion detection was lost — 117MB for a worse list).
- **geminiApiService.js**: Low-level Gemini API calls (REQUIRED - do not delete)
- **transcriptionService.js**: Manages recording-to-list transcription flow,
  target-list locking, and progress animation
- **listParser.js**: Regex splitter, used only when a Gemini response comes back
  unstructured
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
- **infrastructure/soundService.js** + **infrastructure/typewriterWiring.js**:
  Shared `@softstack/juicy-sounds` sound engine (`ZiplistSoundService`) with
  custom WebAudio cues (`check` rising pitch cascade, `uncheck`, `bloom`,
  `sparkle`, `copySuccess`, `fanfare`, `locked`, `delete`, `clear`, `select`,
  `recordStart`, `recordStop`) plus Cherry MX mechanical key clicks on desktop
  text inputs (`sharedState: false` so Sound toggle is isolated per app).
- **infrastructure/hapticService.js**: Haptic feedback for touch interactions
- **realtime/liveListProtocol.js**: Shared live room ids, message names,
  limits, and validators
- **realtime/**: Live collaboration & PartySocket client bridge (liveListsService, partyService, presenceStore, typingStore, avatarService)
- **worker/index.ts**: Cloudflare Worker + Durable Object room server (`ziplist-rooms.pibulus.workers.dev`) for validated live-list snapshots, ephemeral presence, and E2EE device sync relay
- **realtime/deviceSyncStore.js** + **syncCrypto.js** + **lists/listMergeService.js**:
  Device Sync — every list on every paired device, AES-GCM sealed client-side,
  relayed by `worker/index.ts` (`zl_p*` rooms). Pairing is by link only (QR,
  opened link, or pasted link); the key lives in the `#k=` fragment. Every
  item mutation must stamp `updatedAt`/`checkedAt` and every removal must
  tombstone — store methods do it directly, whole-array replacements get it
  from `upsertList` → `stampItemChanges`. Spec + verify commands:
  `docs/DEVICE_SYNC_SPEC.md`. After any worker change run
  `node scripts/verify-live-relay-sync.mjs` (wrangler never type-checks).

### Modal System

All modals (`IntroModal`, `AboutModal`, `SettingsModal`, `ContributorModal`, `QrShareModal`) run on ONE
global system: `services/modals/modalService.js` (imperative open/close by
dialog id, scroll-lock, exit-animation orchestration, one-modal-at-a-time)
over native `<dialog>`/`showModal()` top-layer semantics, with the shared
`dialog.modal` skeleton + `zl-modal-*` keyframes in `app.css`. Matches
TalkType's modal specs (`box-shadow: 3px 3px 0 #1e1714`, `color-mix` pastel
control borders, centered `grid-template-areas: "modal"`). Never hand-roll
per-modal Escape/backdrop/scroll-lock/keyframe machinery; route new modals
through `modalService`.

### Component Structure

- **MainContainer.svelte**: Top-level orchestrator, handles recording state and lifecycle
- **ContentContainer.svelte**: Thin wrapper for AnimatedTitle (32 lines)
- **AnimatedTitle.svelte**: Title with staggered animation + floating "Dude" record button
- **SingleList.svelte**: Rich list component — CRUD, rename/add-list header controls, drag/drop, move actions, static share, live share, particles
- **RecordButtonWithTimer.svelte**: Voice recording button with waveform visualization
- **PwaDeviceSetup.svelte**: Installed mobile PWA setup pill for mic permission
  and persistent storage
- **SwipeableLists.svelte**: Horizontal list navigation with sticky mobile `.list-nav` and collapsed parked slide height
- **PageLayout.svelte**: App shell with responsive layout and fixed footer

### Live Sharing

- Live sharing is optional and hidden unless the relay host config is present or
  the app is running in local dev.
- Create flow: `SingleList` -> `liveListsService.makeLive()` ->
  `/api/live/create` -> Cloudflare Durable Object Worker `/parties/main/:roomId`
  (`worker/index.ts`, deployed at `ziplist-rooms.pibulus.workers.dev`).
- Room ids use high-entropy `zl_...` ids (or 4-word phrase rooms via `/j/[phrase]`).
- The live protocol intentionally uses full-list snapshots plus typing events.
  Keep it simple unless real usage proves conflict handling needs to become more
  granular.
- Presence is ephemeral; do not persist collaborator presence into durable room
  storage.
- Production deploy requires matching `PARTYKIT_CREATE_SECRET` in the app env and
  Worker env (`npx wrangler deploy` from `worker/`).

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

## Vibe / Theme System

Four stationery Vibes defined in `src/lib/styles/theme-variables.css` and `src/lib/constants/theme.js`:

- **focus** (_Highlighter_ — electric pink + highlighter yellow, default)
- **chill** (_Sticky Note_ — warm coral + mint)
- **zen** (_Gel Pen_ — lilac + sky blue)
- **nocturne** (_Legal Pad_ — warm amber + sage)
- Applied via `data-theme` attribute on `<html>` root (`chunky-mode` is always enabled on `<body>` as the unified Soft Neo-Toybrut styling).
- Theme constants in `src/lib/constants/theme.js`, application in `src/lib/services/theme/themeService.js` (`applyTheme()`).

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
