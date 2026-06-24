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
- **Three local lists by default** - swipe between color-coded list cards
- **Fast local storage** - your everyday lists stay on your device
- **Drag, drop, check off** - desktop drag plus touch-native reorder on mobile
- **Say what is done** - phrases like "I bought the milk" can tick matching
  unchecked items when Gemini has list context
- **Optional live lists** - PartyKit rooms let a couple, band, family, or
  housemate group share one changing list
- **Installable web app** - save it to your home screen, no app store needed
- **Installed-device setup** - the mobile PWA can ready mic permission, storage,
  and the offline model in one guided step
- **No task-manager pressure** - no dates, priorities, streaks, or dashboard

## Use It Anywhere

**As a PWA**: Save to your home screen and use it like a tiny checklist app.
Good for groceries, packing, gear, chores, set lists, and housemate runs.

**Live sharing**: Contributor mode can turn a list into a live link so multiple
people see the same checklist update.

**Chrome Extension**: The app includes an extension info modal, but the packaged
extension bundle is not currently part of this repo.

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
- `npm run dev:party` - Start local PartyKit on port `1999`
- `npm run format` - Clean up the code (Prettier)
- `npm run lint` - Catch the rough edges (ESLint)
- `npm run lighthouse` - Performance check

## Environment

ZipList uses a server-side speech processing route. Set:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Do not use `VITE_GEMINI_API_KEY` for the main app runtime. `VITE_*` vars are exposed to the browser.

If you want PartyKit live sharing in a deployed environment, also set:

```bash
VITE_PARTYKIT_HOST=your-actual-host.partykit.dev
PARTYKIT_HOST=your-actual-host.partykit.dev
PARTYKIT_CREATE_SECRET=long_random_secret_also_set_in_partykit
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
├── lib/services/theme/          # Color personality system
├── lib/services/pwa/            # PWA installation support
├── routes/                      # SvelteKit pages and server endpoints
└── ../party/listRoom.ts         # PartyKit room server
```

## Tech Stack

- **SvelteKit** - Fast, modern, feels snappy
- **Tailwind CSS + DaisyUI** - Pretty without the pain
- **Local Storage** - Your lists stay yours, offline-first
- **Gemini + local Whisper** - Server-side Gemini first, local Whisper when ready
- **PartyKit** - Optional live shared lists
- **PWA Ready** - Manifest, service worker, installed-device setup, and recording
  wake lock where supported
- **Extension modal** - Placeholder/help path for a future packaged browser
  extension

## The Five Personalities

Ziplist adapts its look and feel to match your mood:

- **Focus** - Warm tangerine sunrise
- **Chill** - Minty cool clarity
- **Zen** - Lavender calm with a lo-fi edge
- **Nocturne** - Moonlit pastel night energy
- **Neo** - High-contrast punch with extra pop

Choose once, it remembers. Because good tools should feel like they know you.

## PWA Features

- **Install to home screen** - Works like a native app
- **Offline support** - No internet required after first load
- **Offline model setup** - Installed mobile users can preload Whisper with
  progress feedback
- **Recording wake lock** - Supported browsers keep the screen awake while
  recording
- **Fast startup** - Cached and optimized for speed
- **Mobile-first design** - Thumb-friendly, responsive everywhere
- **App shortcuts** - Jump straight to recording from your home screen

## Chrome Extension

The app has an extension info modal, but this repo does not currently include a
packaged extension bundle. Treat the extension as a future/placeholder surface
until the files are added.

When that ships, keep install instructions next to the actual downloadable
extension artifact.

---

## Why This Exists

Lists should not make you set up a system before you can write the thing down.

This is for anyone who has stood in a store trying to remember what they
needed, anyone who thinks better out loud, and anyone who wants a checklist
without the task-app baggage.

Talk. List. Tick.

**MIT License • Built with care • Contributions welcome**
