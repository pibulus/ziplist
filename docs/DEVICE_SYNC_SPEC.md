# Device Sync — scoped spec

> Move every list from one device to another by scanning a code. No account,
> no plaintext on any server, nothing kept.

Status: **spec only, nothing built.** Written 2026-09-23.

This is the build that `_audits/fleet/ACCOUNTS-AND-SYNC-EXPLAINED.md` parked on
2026-07-18 with the words _"a passphrase-derived key, encrypted blobs synced
through a dumb relay… Parked as a genuine future build — flag it if you want it
scoped."_ It is now flagged.

---

## What it is, and what it deliberately is not

**Is:** a one-time, end-to-end encrypted handoff of the whole list collection,
device A → device B, started by scanning a QR code.

**Is not**, and these are decisions, not omissions:

- **Not continuous sync.** No background reconciliation, no two-way merge, no
  tombstones. The transfer happens, finishes, and is over.
- **Not a multi-list room.** `docs/V1.1.md:79` says never, and this honours it:
  the bundle is ciphertext passing through RAM and is never written to storage,
  so no room ever _holds_ multiple lists.
- **Not accounts.** The code is the credential, as everywhere else in the fleet.
- **Not a backup.** Nothing is retained to restore from later.

If continuous sync is ever wanted, it is a different project with a conflict
model. Say so explicitly rather than growing this one into it.

---

## Why the QR carries the key, not the four words

The obvious design is to reuse the existing 4-word phrase as both room id and
encryption key. **Do not do this**, and the reason is written in this repo:

> _"Four words from these banks is ~1.6 million combinations. That is
> convenience-first, and correct for a shopping list — it is NOT a vault, and
> nothing here should ever be reused for anything that wants to be one."_
> — `src/lib/services/realtime/syncPhrase.js:9`

A single shopping list is a fair bet at 1.6M. **Every list someone owns is not.**
If the key were phrase-derived, anyone who can see room ids — the relay operator,
or anyone enumerating — could brute-force a 1.6M keyspace offline and decrypt.
That turns the encryption into decoration.

So the phrase and the key are separated:

|                | Derived from                                                              | Who can see it       | Purpose         |
| -------------- | ------------------------------------------------------------------------- | -------------------- | --------------- |
| Room id        | `SHA-256("ziplist:bundle:v1:" + phrase)`, first 32 hex                    | the relay            | rendezvous only |
| Encryption key | 256 bits from `crypto.getRandomValues`, **never derived from the phrase** | only whoever scanned | confidentiality |

The QR encodes:

```
https://ziplist.app/sync/<four-words>#k=<base64url 256-bit key>
```

The key sits in the **fragment**, which browsers never transmit to the server.
The relay learns the room id and sees ciphertext. It cannot derive the key.

**Consequence, stated plainly: there is no type-the-words fallback for bundle
sync.** Typing four words would join the room without the key and decrypt
nothing. Scanning is the whole mechanism — which is also exactly the feature as
asked for. The existing single-list `/j/<phrase>` type-in path is untouched and
keeps working as it does today.

A different room salt (`ziplist:bundle:v1:` vs the existing `ziplist:sync:v1:`)
guarantees a bundle code can never drop somebody into a live _list_ room, or
vice versa.

---

## Mechanism

```
Device A (has the lists)              relay (Cloudflare Worker)       Device B
──────────────────────────            ─────────────────────────       ────────
generate phrase + random key
POST /api/live/create  ───────────────▶ room created (stub list)
derive room id from phrase
connect, show QR  ────────────────────▶ room
                                                         ◀───── scan QR, connect
                                        ◀── presence ───▶
encrypt bundle with key
send BUNDLE_OFFER (ciphertext) ───────▶ broadcast ──────────────────▶ decrypt
                                        (never stored)                merge
                                        ◀────────────── BUNDLE_ACK ───
show "12 lists sent"
```

### Pieces that already exist and should be copied, not reinvented

| Need                               | Take it from                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| PBKDF2/AES-GCM helpers             | `qrbuddy/utils/crypto.ts` (AES-GCM-256; keep the primitives, drop the PBKDF2 step — the key is random here, not derived) |
| Bundle export/import + merge-by-id | `qrbuddy/utils/sync-phrase.ts` (`exportSyncBundle` / `importSyncBundle`)                                                 |
| Whole-collection beam over a relay | `talktype/src/lib/stores/syncStore.js` (`history_snapshot`)                                                              |
| Phrase → room derivation           | `src/lib/services/realtime/syncPhrase.js` (add the new salt)                                                             |
| RAM-only relay semantics           | `apps/pibulus-party/src/server.ts`                                                                                       |

---

## Protocol changes

`src/lib/services/realtime/liveListProtocol.js`:

1. Add to `LIVE_MESSAGE_TYPES`: `BUNDLE_OFFER: "bundle_offer"`, `BUNDLE_ACK: "bundle_ack"`.
2. Add `sanitizeBundleEnvelope(input)` — validates only the _envelope_, never the
   contents, because the contents are ciphertext the server must not understand:
   ```js
   { v: 1, iv: <base64url, ≤ 32 chars>, ct: <base64url, ≤ MAX_BUNDLE_BYTES> }
   ```
3. Add `MAX_BUNDLE_BYTES` to `LIVE_LIST_LIMITS`. Worst case today is
   12 lists × 120 items × 140 chars ≈ 200KB plaintext, ~270KB base64 ciphertext.
   Set the cap at **512KB** and **measure against the platform's real WebSocket
   message limit before shipping** — if it needs chunking, chunk in the client
   and reassemble in the client, never in the room.
4. Wire both types into `normalizeLiveMessage`.

`party/listRoom.ts`: **no logic change needed.** Only `LIST_UPDATE` calls
`saveListData`; every other type is broadcast-and-forget, which is precisely the
RAM-relay behaviour wanted. It still needs `npm run party:deploy`, because the
worker imports the shared protocol — and per `liveListProtocol.js:33`, the
worker and Netlify drifting apart is a known footgun. **Deploy both or neither.**

### The room-creation gate

`onConnect` closes with `ROOM_NOT_FOUND` unless the room already holds a list, so
a bundle room cannot spring into being. Rather than loosen that gate, the sender
creates the room through the existing `/api/live/create` with a **stub list**
(`{ id, name: "", items: [] }`). This reuses the endpoint's rate limiting and
create-secret, and the only thing ever persisted is an empty stub that expires on
the normal TTL. No real content touches storage.

---

## Merge rules on the receiving device

Additive, never destructive. A sync should not be able to lose anything.

1. **List matched by id.** Present locally → merge items into it. Absent → create.
2. **Items deduped by id.** Missing ones appended in arrival order. An item that
   exists locally is left alone — the local copy wins, because the local device
   is the one being used.
3. **Nothing is ever deleted.** A list absent from the bundle stays. This is what
   keeps the absence of a conflict model honest.
4. **Cap is enforced, and overflow is reported.** Import up to `getMaxListCount()`
   (12 contributor / 3 free), then say exactly how many did not fit. Never
   silently drop — `listsStore.addList` already returns a `max-lists` result to
   build on.
5. **Names collide → keep both.** `getUniqueListName` already handles this.

Idempotent by construction: running the same bundle twice changes nothing the
second time.

---

## Where it lives in the UI

The surface-area budget in `CLAUDE.md` says prefer replacing a control over
adding one, so this does not get a new tray.

- **Sending** — the Options row that is now _"Bring a list in"_ becomes the
  device row for both directions, gaining one control: **"Send all lists"** →
  shows the QR full-bleed. It is the only place in the app that talks about
  devices, so both halves belong together.
- **Receiving** — no UI at all. Scanning opens `/sync/<phrase>#k=…`, which shows
  what is about to arrive ("12 lists, 84 items") and a single confirm. Same
  keep-or-leave shape as `/live/<roomId>`, so there is one mental model.
- The QR modal already exists and takes `title`/`subtitle` props — reuse it
  rather than building a second one.

---

## Failure modes, all of which must be visible

| Case                              | Behaviour                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| No PartyKit host configured       | The send control stays hidden, exactly as live sharing already does                              |
| Fragment key missing or malformed | "This code is incomplete — scan it again" and stop. Never join a room you cannot read            |
| Decrypt fails                     | "This code doesn't match" — a wrong or stale code, not a crash                                   |
| Sender disconnects mid-transfer   | Receiver shows nothing partial. The bundle is one message; it either arrives whole or not at all |
| Bundle over cap                   | Sender refuses before encrypting, and names the number                                           |
| Room expired                      | Existing "bubble popped" state                                                                   |

---

## Docs to correct as part of this work

The research turned up four statements that are wrong today. They should be
fixed in the same branch, because each one is why somebody believed this feature
already existed:

- `NEXT.md:61` — lists "Sovereign device sync… over ephemeral memory pipes" as
  shipped. It carries one list, and ZipList's room **persists**. Not ephemeral.
- `docs/LIVE_SHARING.md:132` — supporter rooms "may… hold multiple lists… be
  exportable/backed up to the Pi". Contradicts `V1.1.md:79`. Resolve it: this
  design keeps the cutoff by never storing a bundle.
- `~/Documents/reference/BUILD-appendage-architecture.md` — "Implemented in
  TalkType/Ziplist". The bridge is; the beam is not.
- `src/lib/config/pricing.js` — already corrected 2026-09-23, keep it that way.

---

## Deliberately not in scope

- Chonk/EliteDesk as the relay. `ssh pibulus-remote` works, but the relay is a
  Cloudflare Worker today and a RAM relay is a natural Worker. Putting a core
  feature behind home-uptime is a separate decision.
- Extracting `softstack-sync` into a real git repo. TalkType's README asks for
  this the moment a second app needs it — and this makes ZipList that app. It is
  a fleet refactor, worth doing, and not worth blocking this on.
- Any `pibulus-party` revival. ZipList's own worker is fine.

---

## Rough shape of the work

|                                                                    |                     |
| ------------------------------------------------------------------ | ------------------- |
| Protocol + envelope sanitizer                                      | small               |
| Crypto helpers (copied from QRBuddy, minus PBKDF2)                 | small               |
| Bundle build/merge service + a runnable round-trip check           | medium              |
| `/sync/[phrase]` route + confirm screen                            | medium              |
| Options send control + QR reuse                                    | small               |
| Worker deploy + Netlify in lockstep, two-device test on production | must not be skipped |

The riskiest part is not the code — it is the deploy pairing and a real
two-device pass. Budget for those rather than treating them as the victory lap.
