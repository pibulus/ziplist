# Live Sharing

ZipList live sharing uses PartyKit to let multiple devices edit one checklist
through a magic link.

## User Flow

```text
Make Live
  -> live room is created
  -> link is copied/shared
  -> another device opens /live/:roomId
  -> both devices see the same list update
```

The public UX should stay simple: one live link, no workspace language, no
account setup.

## Code Flow

```text
SingleList.svelte
  -> liveListsService.makeLive(listId)
  -> partyService.createLiveList()
  -> /api/live/create
  -> PartyKit /parties/main/:roomId
  -> party/listRoom.ts
```

Joining:

```text
/live/[roomId]
  -> liveListsService.connectToLive(listId, roomId, password)
  -> partyService.connectToLiveList()
  -> PartySocket init message
  -> listsStore.upsertList()
```

`connectToLive()` resolves only after the PartyKit room sends an `init` message.
That keeps loading/error UI honest.

## Protocol

`src/lib/services/realtime/liveListProtocol.js` owns:

- room id generation
- message type names
- list/item limits
- avatar/password sanitizing
- live-list snapshot validation
- client/server message normalization

Current messages:

- `init`
- `presence`
- `list_update`
- `typing_start`
- `typing_stop`

The protocol intentionally avoids dormant partial item operations for now.
Full-list snapshots are simpler and fine for small ZipList lists.

## Live Feel Plan

Live collaboration should feel like the list itself is alive, not like a chat
or workspace. Keep remote activity spatial, soft, and tied to the item being
touched.

Near-term target:

- replace the literal typing banner with remote draft rows inside the list
- tint remote draft rows, item glows, and check ripples with the collaborator's
  avatar color
- keep draft text, focus/selection, presence, and voice-in-progress signals
  ephemeral
- store only committed list state and room metadata durably
- let voice-added items pop in with the collaborator glow after transcription
  resolves

Possible protocol additions:

- `draft_update` - remote user is typing a new item draft
- `draft_clear` - draft was submitted, cancelled, timed out, or the user left
- `item_focus` - remote user is editing or touching an existing item

Avoid notification-panel language such as "Pablo is typing." Prefer ghost rows,
colored glows, avatar dots, and item-level motion where the work is happening.
Do not add CRDTs unless ZipList grows beyond small shared checklist rooms.

## Room Lifetimes

Current behavior:

- static `/import#listdata=...` share links contain the list snapshot in the
  URL hash and have no server-side expiry
- local lists stay on the device until browser/PWA storage is cleared or the
  user deletes them
- live rooms have no ZipList-level expiry yet; they remain available as long as
  the PartyKit/Cloudflare room storage keeps them
- presence, typing, draft text, focus, and voice-in-progress signals are
  ephemeral

Before promising long-term live rooms, verify whether production is on the
PartyKit Individual storage-retention path or deployed to our own Cloudflare
account.

Product target:

- free quick rooms should be temporary bubbles, probably 24 hours or 7 days
  after last activity
- expired free rooms should fail softly with a "bubble popped" state, not a
  broken link
- supporter rooms can be durable for a year or while supporter status remains
  active
- supporter rooms may reserve a cute phrase/QR alias, hold multiple lists, use
  passport/avatar identity, and be exportable/backed up to the Pi

Possible room metadata:

```js
{
  createdAt,
  updatedAt,
  lastActiveAt,
  expiresAt,
  tier: "free" | "supporter",
  alias: "blue-lemon-disco",
}
```

Start with lazy expiry: check `expiresAt` when a room is opened and show the
expired state. Add scheduled cleanup only when storage hygiene actually needs
it.

Direct live URLs (`/live/zl_...`) point at one room. Cute aliases
(`/r/blue-lemon-disco`) can outlive a room and point at the current room
record. Free aliases can expire/recycle; supporter aliases should stay
reserved.

## Usage And Costs

Pricing audit: 2026-06-06. Re-check the linked provider pages before committing
to public pricing or durability promises.

- [PartyKit pricing](https://www.partykit.io/) lists Individual as free for up
  to 10 live projects, with storage cleared every 24 hours.
- PartyKit Commercial is also listed as free when deployed to our own
  Cloudflare account, with custom domains and unlimited projects; Cloudflare
  usage is the cost surface.
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
  says Workers Paid has a $5 USD/month account minimum and includes Workers,
  Pages Functions, KV, Hyperdrive, and Durable Objects usage.
- Workers Free currently includes 100,000 Worker requests/day. On Workers
  billing, the initial WebSocket upgrade counts as a request; routed WebSocket
  messages do not count as Worker requests.
- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
  currently lists Free-plan Durable Object allowances for SQLite-backed
  objects, including 100,000 requests/day, 13,000 GB-s/day duration, 5 million
  rows read/day, 100,000 rows written/day, and 5 GB total SQL stored data.
- [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
  allow unlimited SQLite-backed objects within the account, with 5 GB storage
  per account on Free and 10 GB per object.

ZipList cost model:

- committed checklist snapshots are tiny; storage is not the scary part
- durable writes should happen on room create, committed list changes, metadata
  changes, and expiry/revive actions
- draft typing, focus glow, voice-in-progress, and presence should stay
  ephemeral so they feel magical without becoming write spam
- if rooms become long-lived and busy, revisit WebSocket hibernation; regular
  connected sockets can make Durable Object duration the meaningful cost
- a free room can disappear by policy; a supporter room needs explicit
  durability, export, and backup expectations

## PartyKit Room

`party/listRoom.ts`:

- rejects joins to rooms that were never created
- validates snapshots before storage
- requires `PARTYKIT_CREATE_SECRET` for non-local room creation
- stores one durable `listData` snapshot per room
- derives presence from active PartyKit connections
- broadcasts valid list updates and typing events to everyone except sender

## Environment

App/SvelteKit env:

```bash
PARTYKIT_HOST=your-party-host.partykit.dev
VITE_PARTYKIT_HOST=your-party-host.partykit.dev
PARTYKIT_CREATE_SECRET=the_same_long_secret
```

PartyKit env:

```bash
PARTYKIT_CREATE_SECRET=the_same_long_secret
```

Local dev:

```bash
npm run dev
npm run dev:party
```

`partykit.json` pins local PartyKit to port `1999`. In Vite dev, local/LAN app
clients infer the current host with port `1999`, so an iPhone at
`http://192.168.0.148:3001` can connect to `192.168.0.148:1999`. The local
room-create endpoint follows the same host in dev, even when production
PartyKit env is present in `.env`.

## Production Deploy

1. Generate a long random secret.
2. Set the app env vars.
3. Set the PartyKit env secret.
4. Deploy PartyKit:

```bash
npx partykit deploy --with-vars
```

5. Deploy/restart the ZipList app.
6. On a fresh production device, redeem a contributor code before tapping
   `Make Live`; room creation is intentionally contributor-gated.
7. Run the two-device test against production.

## Test Checklist

- Run `npm run smoke:live` with local Vite + PartyKit, or set
  `LIVE_SMOKE_APP_ORIGIN`, `LIVE_SMOKE_PARTYKIT_HOST`, and
  `LIVE_SMOKE_CONTRIBUTOR_TOKEN` for production.
- Create live list A and live list B; confirm no cross-room bleed.
- On a fresh phone install, redeem contributor access before creating a room.
- Join from a second device; confirm initial state appears before loading ends.
- Add item on device A; confirm device B updates.
- Tick item on device B; confirm device A updates.
- Reorder on mobile; confirm order syncs.
- Refresh both devices; confirm durable room state is still correct.
- Turn PartyKit off/misconfigure host; confirm the UI fails clearly.

## Known Product Decision

Joined live lists are currently persisted locally with `liveRoomId` metadata.
Later, decide whether ZipList should auto-reconnect those saved live lists on app
launch or keep joined live rooms session-oriented.
