# 🔧 TINKER.md - ZipList Quick Reference

_For when you haven't touched this in 6 months and need to change something NOW_

**ADHD MODE**: Jump to [QUICK WINS](#-quick-wins---80-of-what-youll-change) or [WHEN SHIT BREAKS](#-when-shit-breaks---top-3-fixes)

---

## 🚀 START HERE - RUN THE DAMN THING

### Dev Mode

```bash
# STACK: SVELTEKIT + VITE + TAILWIND + DAISYUI
npm run dev
# Opens: http://localhost:50002 (custom port, not 5173!)
```

### Production Build

```bash
npm run build
npm run preview
```

### Health Check

```bash
npm run lint      # Check code quality
npm run format    # Auto-format code
```

---

## 📁 FILE MAP - WHERE SHIT LIVES

```
ziplist/
├── src/
│   ├── routes/
│   │   ├── +page.svelte         # Homepage/main list view
│   │   ├── +layout.svelte       # App wrapper/layout
│   │   ├── list-test/           # List testing route
│   │   ├── ghost-test/          # Ghost mode testing
│   │   └── ui-components/       # UI component demos
│   ├── lib/
│   │   ├── components/          # Reusable Svelte components
│   │   ├── services/            # API services, transcription
│   │   ├── styles/              # Global CSS, Tailwind setup
│   │   └── constants.js         # App constants
│   └── app.html                 # HTML template
├── static/                      # Images, manifest, etc.
├── scripts/                     # Dev scripts (list, generate, parse-prd)
└── tailwind.config.js          # Tailwind + DaisyUI config
```

### The Files You'll Actually Touch:

1. **src/lib/components/mainPage/MainContainer.svelte** - Top-level container + recording state
2. **src/lib/components/ghost/GhostContainer.svelte** - Ghost character (visual feedback)
3. **src/lib/components/list/SingleList.svelte** - Individual list with full CRUD
4. **src/lib/services/geminiService.js** - Gemini API transcription
5. **src/lib/services/listsStore.js** - Svelte store for list state + localStorage
6. **src/lib/services/themeService.js** - Theme switching (peach/pink variants)
7. **tailwind.config.js** - Colors and DaisyUI themes
8. **src/lib/constants.js** - App settings

---

## 🎯 QUICK WINS - 80% OF WHAT YOU'LL CHANGE

### 1. Change the Main Text/Copy

```
File: src/lib/components/mainPage/MainContainer.svelte
Look for: Text content, headers, instructions
What: Main UI copy, recording prompts

Also check:
- src/lib/components/ghost/Ghost Container.svelte - Ghost character text
- src/routes/+page.svelte - Page-level meta/title
```

### 2. Change Colors/Theme

```
File: tailwind.config.js
Look for: theme: { extend: { colors: {...} } }
Current: Peach/pink color variants for theme system
Also: src/lib/services/themeService.js - Theme definitions

DaisyUI: Installed for component library
Theme service: Handles peach/pink/mint variants (check themeService.js)
```

### 3. Change Voice Transcription API

```
File: src/lib/services/geminiService.js
Current: Google Gemini API (@google/generative-ai package)
Key function: Handles audio → text transcription

To switch to offline Whisper:
1. Check ZIPLIST_1.0_BATTLE_PLAN.md (references TalkType implementation)
2. TalkType has working offline Whisper in ~/Projects/active/apps/talktype/
3. Copy src/lib/components/whisper/ from TalkType
4. Replace geminiService.js imports with new whisper service

Alternative APIs:
- OpenAI Whisper: openai package
- Anthropic: Not for voice transcription
```

### 4. Change Default List Behavior

```
File: src/lib/constants.js or relevant service file
Look for: Default settings, list templates
Change: Auto-save timing, default list name, etc.
```

---

## 🔧 COMMON TWEAKS

### Add a New Page/Route

```bash
# SvelteKit routing:
Create: src/routes/newpage/+page.svelte
Visit: http://localhost:5173/newpage

# With layout:
Create: src/routes/newpage/+layout.svelte
```

### Change Port

```bash
# Vite default is 5173
# To change, add to package.json dev script:
"dev": "vite dev --port 3000"
```

### Add/Remove DaisyUI Component

```bash
# DaisyUI is already installed
# Use components directly in Svelte files:
<button class="btn btn-primary">Click Me</button>

# See all components:
https://daisyui.com/components/
```

### Toggle Ghost Mode (if implemented)

```bash
# Check src/lib/services or components for ghost mode
# Usually a feature flag or localStorage key
```

### Change App Name/Title

```bash
File: src/app.html
Look for: <title>ZipList</title>
Change: Your new app name

Also check: package.json (name field)
And: static/manifest.json (for PWA)
```

---

## 💥 WHEN SHIT BREAKS - TOP 3 FIXES

### 1. Port Already in Use

```bash
# Find what's using port 5173:
lsof -i :5173

# Kill it:
kill -9 PID_NUMBER

# Or change port (see "Change Port" above)
```

### 2. Dependencies Fucked

```bash
# Nuclear option:
rm -rf node_modules package-lock.json
npm install

# Try again:
npm run dev
```

### 3. Build Fails

```bash
# Clean everything:
rm -rf dist .svelte-kit node_modules

# Reinstall:
npm install

# Try build:
npm run build
```

---

## 🚦 DEPLOYMENT - SHIP IT

### One-Liner Deploy (Vercel)

```bash
# Install Vercel CLI:
npm i -g vercel

# Deploy:
vercel --prod
```

### Manual Deploy Steps

1. Build it: `npm run build`
2. Test it: `npm run preview`
3. Push it: `git push origin main`
4. Deploy: Vercel auto-deploys from GitHub (if connected)

**Note**: Using @sveltejs/adapter-vercel (see package.json)

---

## 🎤 VOICE TRANSCRIPTION NOTES

Current setup (from package.json):

- **Gemini**: `@google/generative-ai` - Cloud transcription
- **Future**: Offline Whisper (see ZIPLIST_1.0_BATTLE_PLAN.md)
- **Reference**: TalkType has working offline implementation

To switch APIs:

1. Change service in `src/lib/services/`
2. Update API key in `.env` file
3. Update imports in components

---

## 📝 NOTES FOR FUTURE PABLO

- **Port 50002**: Custom dev port (not 5173) to avoid conflicts
- **Architecture**: Component-based (mainPage/, ghost/, list/, ui/, layout/)
- **State management**:
  - listsStore.js = Svelte store + localStorage
  - themeService.js = Theme switching
  - Recording state = MainContainer.svelte
- **65% complete**: Core works, needs polish + export features
- **Battle Plan exists**: ZIPLIST_1.0_BATTLE_PLAN.md = full roadmap
- **TalkType reference**: Offline Whisper working in ~/Projects/active/apps/talktype/
  - Copy src/lib/components/whisper/ to port offline transcription
- **Ghost character**: GhostContainer.svelte = SVG character linked to recording state
- **Animations**: Staggered text animations (split into <span>, CSS delays)
- **Services**:
  - geminiService.js = Gemini API wrapper
  - geminiApiService.js = Low-level API (DO NOT DELETE)
  - transcriptionService.js = Transcription flow + progress
  - listsService.js = Process transcription → list items
- **DaisyUI**: Tailwind component library
- **Svelte 5**: Using latest (check for runes syntax)
- **Vercel adapter**: Ready for deployment
- **Unique positioning**: Voice + offline AI + list sharing = rare combo

### Pablo's Project Quirks:

- Voice-first (not text-first todo app)
- Privacy-focused (offline transcription planned via TalkType port)
- Ghost character personality (not just a tool)
- Theme variants: peach/pink (themeService.js)
- Battle plan mentions: Web Share API, PostHog analytics, offline Whisper
- 3 dev scripts: list, generate, parse-prd (scripts/dev.js)

---

## 🎸 TLDR - COPY PASTE ZONE

```bash
# Start working
npm run dev

# Ship it
npm run build
vercel --prod

# When broken
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Quick paths:**

- Main page: `src/routes/+page.svelte`
- Components: `src/lib/components/`
- Voice/transcription: `src/lib/services/`
- Colors: `tailwind.config.js`
- Constants: `src/lib/constants.js`

**Battle plan:**

- Read: `ZIPLIST_1.0_BATTLE_PLAN.md`

---

_Generated for ZipList - Voice-to-list app with offline AI 🎤_
