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
- **Installable web app** - save it to your home screen, no app store needed
- **No task-manager pressure** - no dates, priorities, streaks, or dashboard

## Use It Anywhere

**As a PWA**: Save to your home screen and use it like a tiny checklist app.
Good for groceries, packing, gear, chores, set lists, and housemate runs.

**Chrome Extension**: Install once and turn text fields into quick list capture
spots when you need them.

## Getting Started

Need Node.js 20+ and your terminal skills.

```bash
# Grab it
git clone https://github.com/yourusername/ziplist.git
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
```

Leave it unset for solo/demo deployments and ZipList will stay in clean solo mode.

## How It's Built

```
/src
├── lib/components/list/         # List cards and checklist controls
├── lib/components/mainPage/     # Voice recording UI + modals
├── lib/services/lists/          # List state and item logic
├── lib/services/transcription/  # Audio processing flow
├── lib/services/theme/          # Color personality system
├── lib/services/pwa/            # PWA installation support
└── routes/                      # SvelteKit pages
```

## Tech Stack

- **SvelteKit** - Fast, modern, feels snappy
- **Tailwind CSS + DaisyUI** - Pretty without the pain
- **Local Storage** - Your lists stay yours, offline-first
- **PWA Ready** - Full Progressive Web App with manifest and service worker
- **Chrome Extension** - Voice-to-lists in any text field on any website

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
- **Fast startup** - Cached and optimized for speed
- **Mobile-first design** - Thumb-friendly, responsive everywhere
- **App shortcuts** - Jump straight to recording from your home screen

## Chrome Extension

Install the extension to make quick lists in text fields around the web:

1. Download extension files (link in app)
2. Unzip to a folder
3. Open `chrome://extensions`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the folder

Now you can create voice lists directly in Gmail, Slack, social fields, or any
other text field.

---

## Why This Exists

Lists should not make you set up a system before you can write the thing down.

This is for anyone who has stood in a store trying to remember what they
needed, anyone who thinks better out loud, and anyone who wants a checklist
without the task-app baggage.

Talk. List. Tick.

**MIT License • Built with care • Contributions welcome**
