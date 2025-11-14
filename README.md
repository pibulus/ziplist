# ZipList

**Speak your list, we'll do the rest.**

Clean, sweet, and stupidly easy voice-to-lists magic that works everywhere.

## The Story

Ziplist's the best. Organize the rest.

No more fumbling with tiny keyboards while standing in grocery stores. No more forgetting what you meant to buy. Just tap, talk, and watch your words become beautiful, organized lists. It's fast, it's fun, it's freaky good.

## What You Get

- **Voice becomes lists in seconds** - Web Speech API magic, zero learning curve
- **Works everywhere** - PWA that saves to your home screen, plus Chrome extension for any website
- **Works offline** - No internet drama, your lists stay local and private
- **Beautiful themes** - Four gorgeous color personalities that actually matter
- **Drag, drop, check off** - Lists that feel alive and respond to your touch
- **Stupidly simple** - One tap to talk, that's it

## Use It Anywhere

**As a PWA**: Save to your home screen, use like a native app. Perfect for quick grocery lists, to-dos, or brainstorming sessions.

**Chrome Extension**: Install once, use everywhere. Turn any text field on any website into a voice-powered list maker. Perfect for emails, social media, messaging apps, or anywhere you need to organize thoughts.

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

## How It's Built

```
/src
├── lib/components/list/         # List card magic
├── lib/components/mainPage/     # Voice recording UI + modals
├── lib/services/lists/          # List brain logic
├── lib/services/transcription/  # Voice → text wizardry
├── lib/services/theme/          # Color personality system
├── lib/services/pwa/            # PWA installation magic
└── routes/                      # SvelteKit pages
```

## Tech Stack

- **SvelteKit** - Fast, modern, feels snappy
- **Tailwind CSS + DaisyUI** - Pretty without the pain
- **Web Speech API** - Browser-native voice recognition
- **Local Storage** - Your lists stay yours, offline-first
- **PWA Ready** - Full Progressive Web App with manifest and service worker
- **Chrome Extension** - Voice-to-lists in any text field on any website

## The Four Personalities

Ziplist adapts its look and feel to match your mood:

- **Warm sunset vibes** - Peachy, cozy energy
- **Cool fresh energy** - Mint, clean focus
- **Playful pink pop** - Bubblegum fun
- **Full spectrum joy** - Rainbow everything

Choose once, it remembers. Because good tools should feel like they know you.

## PWA Features

- **Install to home screen** - Works like a native app
- **Offline support** - No internet required after first load
- **Fast startup** - Cached and optimized for speed
- **Mobile-first design** - Thumb-friendly, responsive everywhere
- **App shortcuts** - Jump straight to recording from your home screen

## Chrome Extension

Install the extension to use Ziplist's voice-to-text magic anywhere on the web:

1. Download extension files (link in app)
2. Unzip to a folder
3. Open `chrome://extensions`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the folder

Now you can create voice lists directly in Gmail, Twitter, Slack, or any text field. Voice-to-lists anywhere, anytime.

---

## Why This Exists

Lists shouldn't be boring. Voice input shouldn't be frustrating. Apps shouldn't treat you like a database.

This is for anyone who's ever stood in a store trying to remember what they needed, anyone who thinks better out loud, anyone who wants their tools to feel a little more human.

Clean, sweet, and stupidly easy. Because that's how software should be.

**MIT License • Built with care • Contributions welcome**
