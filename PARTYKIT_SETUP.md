# PartyKit Live Collaboration Setup Guide

This guide walks you through setting up PartyKit for live collaborative lists in ZipList.

## Quick Start (5 minutes)

### 1. Login to PartyKit

PartyKit uses GitHub for authentication - no separate account needed!

```bash
npx partykit login
```

This will:
- Open a browser window
- Prompt you to sign in with GitHub
- Authorize the PartyKit CLI
- Save credentials to `~/.partykit`

### 2. Deploy Your PartyKit Server

```bash
npx partykit deploy
```

You'll see output like:

```
✓ Deployed to https://ziplist.YOUR_GITHUB_USERNAME.partykit.dev
```

**Save this URL!** You'll need it in step 3.

### 3. Configure Your App

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Add your PartyKit host:

```bash
# .env
VITE_PARTYKIT_HOST=ziplist.YOUR_GITHUB_USERNAME.partykit.dev
```

### 4. Test It!

```bash
# Terminal 1: Start SvelteKit
npm run dev

# Terminal 2: Start local PartyKit (for local testing)
npm run dev:party
```

Open http://localhost:3001, click **"🔴 Make Live"** on any list!

---

## Local Development

For local development, you don't need to deploy PartyKit - just run it locally:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:party
```

The app will auto-detect `localhost:1999` and connect to your local PartyKit server.

---

## Production Deployment

### Step 1: Deploy PartyKit

```bash
npx partykit deploy
```

### Step 2: Configure Environment Variable

On your hosting platform (Netlify, Vercel, etc.), add:

```
VITE_PARTYKIT_HOST=ziplist.YOUR_GITHUB_USERNAME.partykit.dev
```

### Step 3: Deploy Your App

```bash
npm run build
# Deploy to your hosting platform
```

Done! Your app will now use the production PartyKit server.

---

## PartyKit Pricing

### Free Tier (Perfect for Testing)
- Unlimited projects
- Up to **100 concurrent connections** per project
- Plenty for small teams and testing

### Paid Tier (If You Grow)
- **~$0.05 per 1000 active connections**
- Pay-as-you-go (no monthly minimum)
- Way cheaper than running your own servers

For most use cases, the free tier is more than enough!

---

## How It Works

```
┌─────────────────────────────────────────────┐
│  Your App (SvelteKit)                       │
│  └─ partyService.js                         │
└────────────────┬────────────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │   PartyKit    │
         │   Edge Server │
         │               │
         │  party/       │
         │  listRoom.ts  │
         │               │
         │  Durable      │
         │  Storage      │
         └───────────────┘
                 │
        ┌────────┴────────┐
        │                 │
    Browser A         Browser B
  "Misty Fox"      "Happy Frog"
```

**Data Flow:**
1. User A clicks "Make Live" → Creates PartyKit room
2. PartyKit stores list in Durable Objects (persistent storage)
3. User B opens share URL → Connects to same room
4. Changes broadcast via WebSocket → <50ms latency
5. Both users see updates in real-time ✨

---

## Troubleshooting

### "Cannot connect to PartyKit"

**Check 1:** Is the local server running?
```bash
npm run dev:party
```

**Check 2:** Is the environment variable set correctly?
```bash
echo $VITE_PARTYKIT_HOST
```

**Check 3:** In production, did you deploy PartyKit?
```bash
npx partykit deploy
```

### "Failed to create live list"

**Check:** Browser console for errors
```javascript
// Look for:
[PartyService] Connected to room: abc123
```

If you see errors, make sure:
- Local PartyKit server is running (`npm run dev:party`)
- OR production host is configured in `.env`

### "Presence not showing"

**Check:** Are both users in the same room?
- Share URL should look like: `/live/abc123`
- Both browsers should have the SAME room ID

**Check:** Browser console for presence updates:
```javascript
[LiveListsService] Presence update: Misty Fox, Happy Frog
```

---

## Multi-Room Configuration

PartyKit automatically handles multiple rooms - each list gets its own room ID.

```javascript
// List 1 → Room: abc123
// List 2 → Room: def456
// List 3 → Room: ghi789
```

Each room is isolated:
- Separate presence
- Separate data storage
- Separate WebSocket connections

No configuration needed - it just works!

---

## Advanced: Custom Room Names

By default, room IDs are auto-generated. To use custom room names:

```javascript
// In liveListsService.js
const roomId = "my-custom-room-name";
await createLiveList(listData, null, roomId);
```

Useful for:
- Predictable URLs: `/live/grocery-list`
- Shared spaces: `/live/family-todo`
- Team rooms: `/live/team-standup`

---

## Comparison: PartyKit vs Supabase

| Feature | PartyKit | Supabase |
|---------|----------|----------|
| **Latency** | Ultra-low (<50ms) | Higher (~200-500ms) |
| **Setup** | Just deploy | Need Supabase project + DB |
| **Cost** | Free tier + $0.05/1k | Free tier then $25/mo |
| **Best For** | Pure presence/sync | Apps w/ Supabase already |
| **Storage** | Durable Objects | PostgreSQL |
| **Scale** | Global edge network | Regional databases |

**Recommendation:** Use PartyKit unless you're already using Supabase for other features.

---

## Questions?

- **PartyKit Docs**: https://docs.partykit.io
- **PartyKit Discord**: https://discord.gg/partykit
- **GitHub Issues**: https://github.com/pibulus/ziplist/issues

Happy collaborating! 🎉
