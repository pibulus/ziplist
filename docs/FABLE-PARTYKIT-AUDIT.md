# ZipList PartyKit Live-Sharing Audit — 2026-07-18

Branch: `fable-partykit-audit-2026-07-18` · Auditor: Fable (background session)
Scope: `party/listRoom.ts`, `src/lib/services/realtime/*`, `/live/[roomId]` route, `/api/live/create`.

## How the layer works (orientation)

A **room** = one shared list. Room ids are `zl_<crypto-UUID>` (capability URLs, ~122
bits — unguessable), minted **server-side** by `/api/live/create` (rate-limited +
contributor-token-gated), which POSTs the sanitized snapshot to the PartyKit worker
using `PARTYKIT_CREATE_SECRET`. The room stores ONE validated full-list snapshot +
metadata (tier/TTL: free 24h idle, supporter 365d) + an optional SHA-256 password hash.

Wire messages: `init` (server→client full snapshot + meta), `presence` (server→client
full roster, derived from live connections — never durable), and client-sent
`list_update` (whole-list snapshot, last-write-wins), `typing_start/stop`,
`draft_update/clear`, `item_focus`, `voice_activity`. Join = PartySocket WS with
`avatar` + `pwd` query params; server checks password/existence/expiry, sends `init`,
broadcasts presence. Leave = close → presence broadcast excluding the leaver.
Every message is normalized through `liveListProtocol.js` on the **server** (before
store/broadcast) *and* re-validated on the **client** (before applying) — good.

Deploy: was undocumented; `npm run party:deploy` added (commit bb5f4f4). Dev: `npm run
dev:party`. Smoke: `npm run smoke:live`.

## Deployed and working RIGHT NOW? — YES, confirmed

- `https://ziplist.pibulus.partykit.dev/parties/main/zl_<dummy>` returns
  `{"error":"Live list not found"}` HTTP 404 — that JSON is `listRoom.ts`'s own
  handler. The worker is live and running this codebase's room logic.
- `ziplist.app` (HTTP 200) production bundle has `ziplist.pibulus.partykit.dev`
  baked in as `VITE_PARTYKIT_HOST` — not the placeholder. Live sharing is wired
  end-to-end in prod, not just built.
- Create path fails closed: worker returns 503 if the create secret is unset, 403
  without the bearer (observed locally).
- Not tested: creating a real room against prod (would write junk data and needs a
  contributor token — deliberately skipped; the local exercise below covers the code).

## Live two-client verification (observed, not inferred)

Ran `partykit dev` + a two-WebSocket-client script (scratchpad `party-test.mjs`):

| Test | Observed result |
|---|---|
| Create without secret | 403 (fail-closed) |
| Create with secret | 200, roomId echoed |
| Join | full-snapshot `init`, presence roster `Alpha,Beta` |
| **Concurrent delete + stale edit** | **deleted item RESURRECTED** — B deleted `x2`, A's concurrent snapshot (still containing `x2`) landed last; stored state had `x2` back. Whole-snapshot LWW confirmed live. |
| Malformed input fuzz (garbage JSON, wrong-typed `items`, empty ids, unknown types, binary frame, 50,000-char item text) | room survived everything; 50k text clamped to 140 chars; next valid update still flowed A→B |
| B disconnects | A's presence roster immediately drops to `Alpha` — no ghost |
| B reconnects | fresh `init` with current full state — **full-state resync on reconnect is real** |
| Password room | GET no-pwd 403, wrong-pwd 403, right-pwd 200; wrong-pwd WS closed with 1008, which the client treats as terminal (no infinite reconnect loop) |

`npm run build`, eslint, prettier: all green after fixes.

## What I fixed (all in commit `bb5f4f4`)

1. **Timing-safe create-secret comparison** (`party/listRoom.ts`): the bearer header
   was compared with plain `!==`, leaking match position via response timing. Now uses
   the file's existing `timingSafeStringEqual`. Server-only, zero wire impact.
2. **Presence-authoritative ghost sweep** (`liveListsService.js`): presence updates now
   clear typing/draft/focus/voice indicators for users no longer in the roster. Before:
   someone disconnecting mid-voice-note left a ghost "recording" badge up to **45s**
   (voice TTL); drafts 6.5s; typing 5s. Client-only, uses existing store APIs.
3. **Dead code**: `presenceStore.addUser/removeUser` removed (server always sends the
   full roster; verified zero call sites).
4. **`party:deploy` script** added to package.json so the worker deploy path is
   discoverable (previously manual/undocumented).

## Punch-list (NOT fixed — ranked by user-visible pain)

1. **[Concurrency — protocol] Whole-snapshot LWW loses concurrent edits & resurrects
   deletes** (observed live, table above). Two people editing simultaneously: the later
   snapshot wins wholesale — the other's check/rename vanishes, and a deleted item can
   come back if someone else was holding a stale copy. For 2–3-person grocery lists
   this is a small, self-healing annoyance ("didn't I delete that?"), which is why it's
   a note: fixing it means per-item operations or a CRDT — a wire-protocol change
   needing coordinated client+server versioning.
2. **[Concurrency — protocol] Client wall clocks arbitrate reconnect conflicts.**
   `isLocalSnapshotNewer` compares the local device's `updatedAt` against the server's.
   A device with a fast clock always wins after a reconnect; a slow clock silently
   discards its own offline edits. Same protocol-versioning caveat as #1.
3. **[Auth] Password brute-force is unmetered at the worker.** `/api/live/create` is
   rate-limited, but WS joins and GETs with `?pwd=` guesses are not, and the hash is
   unsalted SHA-256 (deliberate, per in-code comment — at-rest opacity only). Room ids
   being unguessable UUIDs is the real barrier; still, a leaked room id allows offline-
   speed guessing online. Fix = CF rate rules or an attempt counter in room storage
   (auth-path behavior change — noted, not touched).
4. **[Presence] Non-graceful drops (phone battery dies, NAT timeout) show a ghost
   "here" dot until Cloudflare notices the dead TCP connection** (can be minutes).
   Graceful closes are clean (observed). Fix = server heartbeat/ping sweep — protocol
   addition.
5. **[Lifecycle] Idle viewers of an expired room are never told it popped** — expiry is
   only checked on connect/message, so a tab left open just goes quiet until the next
   send. Fix = `room.storage.setAlarm()` at `expiresAt` closing connections with 4005.
6. **[Defense-in-depth] POST to an existing room overwrites list + metadata + password**
   for any create-secret holder. Unreachable via the app (fresh UUID per create) but a
   "room already exists" guard would be cheap armor. Left alone: it would change create
   semantics for legit re-provisioning.
7. **[UX] `init` sends `meta` (tier/expiresAt) and the client ignores it** — free-tier
   rooms pop after 24h idle with no countdown or warning shown anywhere.

## Red/alarming failure-state check — CLEAN

No red/maroon anywhere in this layer. `/live/[roomId]` failure card is cream + amber
(`#ffb000`) with friendly copy ("This room popped", "Live link needs another try") and
a Go Home button. Unconfigured host → soft toast ("Live collaboration is not configured
on this deployment yet") and the app continues local-only; join timeout (12s) → friendly
retry message; mid-session room death (expiry/password change) → reconnect loop stops
(terminal close codes) + gentle toast "Live sharing ended for this list". Graceful
degradation is genuinely good here.

## Pattern notes for ProMapper's PartyKit stack

The one that will bite ProMapper hardest: **whole-snapshot LWW does not scale past tiny
documents** — ZipList gets away with delete-resurrection and lost concurrent edits
because lists are ≤120 items and 2–3 people; a bigger collab surface (maps, many
entities, more cursors) amplifies both the race window and the blast radius of "your
whole state got replaced", so ProMapper should be on per-entity ops or a CRDT from the
start, and must not use client wall-clocks to pick winners (ZipList punch-list #1/#2).
Worth copying wholesale from ZipList: the `normalizeLiveMessage` type-allowlist
validated on BOTH server (before store/broadcast) and client (before apply) — it made
the room fuzz-proof in live testing; the TERMINAL_CLOSE_CODES set that stops partysocket
reconnecting forever against a dead room; presence derived from live connections (never
durable) with the presence-roster-sweeps-activity-stores pattern; timing-safe compares
on every shared-secret HTTP path; and fail-closed room creation (503 when the secret
is unconfigured, secret held server-side only).
