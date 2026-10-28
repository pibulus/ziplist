# ZipList

**Talk it into a list. Tick it off.**

ZipList is a warm little voice checklist for groceries, errands, packing,
gear, chores, and all the small things you just need to get down.

## The Story

No setup. No dates. No priorities.

Tap the mic, say the pile, and ZipList turns it into a clean checklist. Add
more whenever. Drag things around. Tick them off. That is the whole point.

## What You Get

- **Talk into the active list** - choose a list, tap the mic, add items
- **Add more whenever** - record again and the new items append to that list
- **RiffRap pastel waterfall** - rich color ramps with 12:1 WCAG AAA text contrast
- **1-layer modular hierarchy**:
  - `## Category` headers & `##` / `---` movable divider bars
  - `→ Target List` portals that flip the carousel straight to linked lists
- **Smart tags & resampling** - tap `#tag` to filter in-place, or `[ ✂️ Resample to new list ]` to spin out a fresh list
- **Magic AI import** - paste messy recipes, WhatsApp dumps, or notes to extract clean checklists
- **Fast local storage** - your everyday lists stay 100% on your device (IndexedDB/localStorage)
- **Drag, drop, check off** - desktop drag plus 1:1 touch-native reorder on mobile
- **Say what is done** - phrases like "I bought the milk" tick matching items via Gemini
- **Optional live lists & Device Sync** - 4-word sovereign phrase rooms & Cloudflare Durable Object relay with zero logins
- **No task-manager pressure** - no dates, priorities, streaks, or dashboard anxiety

## Use It Anywhere

**As a PWA**: Save to home screen and use it like a tiny checklist app.
Good for groceries, packing, gear, chores, set lists, and housemate runs.

**Live sharing & Device Sync**: Turn a single list into a live room (`/j/[phrase]` or `/live/[roomId]`) or pair devices with E2EE Device Sync so multiple screens stay in lockstep.

## Getting Started

Need Node.js 20.18.1+ and npm 10.8.0+.

```bash
# Grab it
git clone https://github.com/pibulus/ziplist.git
cd ziplist

# Install the goods
npm install

# Fire it up
npm run dev

# Build when you're ready
npm run build
```

## Dev Commands

- `npm run dev` - Start the show
- `npm run build` - Make it production-ready
- `npm run preview` - Test your build
- `npm run dev:party` - Start local Cloudflare Worker room relay on port `1999`
- `npm run format` - Clean up the code (Prettier)
- `npm run lint` - Catch the rough edges (ESLint)
- `npm run lighthouse` - Performance check

## Environment

ZipList uses a server-side speech processing route. Set:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Do not use `VITE_GEMINI_API_KEY` for the main app runtime. `VITE_*` vars are exposed to the browser.

If you want live sharing in a deployed environment, also set:

```bash
VITE_PARTYKIT_HOST=ziplist-rooms.pibulus.workers.dev
PARTYKIT_HOST=ziplist-rooms.pibulus.workers.dev
PARTYKIT_CREATE_SECRET=long_random_secret_also_set_in_worker
```

Leave it unset for solo/demo deployments and ZipList will stay in clean solo mode.
For local two-device testing, run `npm run dev:party`; Vite dev clients on
your LAN will use port `1999`.

Contributor checkout and unlock codes use:

```bash
CONTRIBUTOR_LICENSE_SECRET=long_random_secret_at_least_32_chars
CONTRIBUTOR_UNLOCK_CODES=ZL-DEMO-CODE
PUBLIC_APP_URL=https://ziplist.app
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_LOCATION_ID=your_square_location_id
SQUARE_WEBHOOK_SIGNATURE_KEY=your_square_webhook_signature_key
SQUARE_WEBHOOK_NOTIFICATION_URL=https://ziplist.app/api/square/webhook
```

## How It's Built

```
/src
├── lib/components/list/         # List cards and checklist controls
├── lib/components/mainPage/     # Voice recording UI + modals
├── lib/services/lists/          # List state and item logic
├── lib/services/realtime/       # PartyKit live-list bridge
├── lib/services/transcription/  # Audio processing flow
├── lib/services/pwa/            # PWA installation support
├── routes/                      # SvelteKit pages and server endpoints
└── ../worker/index.ts           # Cloudflare Durable Object room server
```

## Tech Stack

- **SvelteKit** - Fast, modern, feels snappy
- **Tailwind CSS + DaisyUI** - Pretty without the pain
- **Local Storage / IndexedDB** - Lists stay local and offline-first by default
- **Gemini Audio** - Single-pass server-side audio transcription + item & completion parsing
- **Cloudflare Durable Objects (`worker/index.ts`)** - Live shared checklist rooms and E2EE Device Sync relay
- **Weightless + Juicy Sounds** - Tactile spring physics, rising pitch checkbox cascade, and Cherry MX key clicks
- **PWA Ready** - Manifest, service worker, installed-device setup, and recording
  wake lock where supported

## The Four Stationery Vibes

ZipList adapts its palette to four tactile stationery moods:

- **Highlighter** (`focus`) - Electric pink + highlighter yellow
- **Sticky Note** (`chill`) - Warm coral + mint clarity
- **Gel Pen** (`zen`) - Lilac calm + sky blue ink
- **Legal Pad** (`nocturne`) - Warm amber + sage paper

## PWA Features

- **Install to home screen** - Works like a native app
- **Offline support** - Lists open and edit without signal
- **Recording wake lock** - Supported browsers keep the screen awake while
  recording
- **Fast startup** - Cached and optimized for speed
- **Mobile-first design** - Sticky list navigation, thumb-friendly rows, responsive everywhere
- **App shortcuts** - Jump straight to recording from the home screen

---

## Why This Exists

Lists should not make you set up a system before you can write the thing down.

This is for anyone who has stood in a store trying to remember what they
needed, anyone who thinks better out loud, and anyone who wants a checklist
without the task-app baggage.

Talk. List. Tick.

**MIT License • Built with care • Contributions welcome**
