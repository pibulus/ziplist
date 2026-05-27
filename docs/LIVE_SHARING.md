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
`http://192.168.0.148:3001` can connect to `192.168.0.148:1999`.

## Production Deploy

1. Generate a long random secret.
2. Set the app env vars.
3. Set the PartyKit env secret.
4. Deploy PartyKit:

```bash
npx partykit deploy --with-vars
```

5. Deploy/restart the ZipList app.
6. Run the two-device test against production.

## Test Checklist

- Create live list A and live list B; confirm no cross-room bleed.
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
