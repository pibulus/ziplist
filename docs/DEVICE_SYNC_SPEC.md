# Device Sync

> Every list on every paired device. No account, no plaintext on any server.

Status: **built and verified 2026-10-02.** The first version of this doc
specced a one-shot handoff that stored nothing. Pablo approved the continuous
design in `_audits/fleet/SOVEREIGN-DEVICE-SYNC-AUDIT.md` instead, and that is
what shipped, so this doc now describes the code.

Verify, in this order:

```bash
npm run check                               # crypto, merge, bundle round-trip
node scripts/verify-live-relay-sync.mjs     # two sockets vs the DEPLOYED relay
```

The second one is the one that matters after any `worker/index.ts` change.
`wrangler deploy` never type-checks, so a worker can deploy green and still
throw on every sync message.

---

## The phrase is an address, the key is the secret

Four words from the banks in `syncPhrase.js` are ~28 bits. That is enough to
make a room id hard to stumble into, but it is nowhere near a key: the relay
sees every room id, and could walk phrase → room id offline in minutes. So
the two are separate:

|         | Comes from                                     | Who sees it         |
| ------- | ---------------------------------------------- | ------------------- |
| Room id | `SHA-256("ziplist:sync:v1:" + phrase)`, 32 hex | the relay           |
| Key     | 256 random bits, `crypto.getRandomValues`      | only paired devices |

The pairing link carries both:

```
https://ziplist.app/?sync=<four-words>#k=<base64url key>&code=<contributor token>
```

Everything after `#` is a fragment, which browsers never send to a server, so
Netlify and Cloudflare logs only ever see the phrase.

**There is no type-the-words pairing, and there cannot be.** Four words get
into the room but not the key. The ways in are the QR, opening the link, or
pasting the link into Options → Device sync → Pair with a link. Pasting exists
for installed PWAs: on iOS a QR scan opens Safari, whose storage is not the
home-screen app's.

---

## Mechanism

```
device A                       relay (Durable Object)               device B
────────                       ──────────────────────               ────────
edit → debounce 500ms
export bundle → AES-GCM-256
send sync_envelope ──────────▶ store as "sync_envelope"
                               (30-day alarm, reset per write)
                               broadcast + sender ───────────────▶ decrypt → merge
                                                                   (no push back)
                                         ◀──────────────── connect (or reconnect)
                               send stored envelope ─────────────▶ decrypt → merge
                                         ◀──────────────── push own envelope on open
```

- **One channel.** Only whole encrypted snapshots travel: `{type, version, iv,
ct, updatedAt}`. The relay validates the envelope shape and nothing else.
- **Pushes are snapshots, so order doesn't matter.** The merge is idempotent
  and commutative, so a device can apply the same envelope twice, or two
  envelopes in either order, and land in the same place.
- **No echo loop.** Applying a remote envelope sets `isApplyingRemote`, and
  store changes made under it are not pushed.
- **Size.** Measured against production on 2026-10-02: a 1MB envelope stored
  and caught up intact. A full contributor collection (12 lists × 120 items)
  is ~480KB of ciphertext.

Code: `deviceSyncStore.js` (socket, pairing, push/apply), `syncCrypto.js`,
`listsStore.js` (`exportCollectionBundle` / `importCollectionBundle`),
`listMergeService.js`, `worker/index.ts` (`isSyncRoom`).

---

## Merge rules (`listMergeService.js`)

- **Items and lists merge by id.** Field-level last-write-wins on top: text
  and tags follow `updatedAt`; checked state follows `checkedAt` (stamped on
  check AND uncheck, falling back to `completedAt` for older items). Ticking
  on one phone and editing text on another keeps both.
- **Deletes are tombstones**, kept 30 days: `list.deletedItemIds` per list and
  `deletedListIds` for whole lists. A tombstone newer than every edit keeps
  the thing deleted, so a device that was offline can't bring it back.
- **Undo outranks its own tombstone.** Restoring stamps the item (or list)
  newer than the delete.
- **Every edit path stamps.** Store methods stamp directly. Every whole-array
  replacement from `SingleList` (clear done, clear all, uncheck all, tag
  edits, resample, every undo) goes through `upsertList` →
  `stampItemChanges`, which tombstones what vanished and stamps what changed.
  A new mutation path that bypasses both will sync wrong.
- **Not synced:** joined live lists (`live_*`). They are rooms, not collection
  data, and keep their carousel slot through every merge. Also not synced:
  the untouched starter list (`list-blue` named "Blue List" holding only
  `starter-*` items). It never travels, and it steps aside when a real list
  with that id arrives, so pairing a fresh phone can't rename the other
  device's first list or fill it with tutorial lines.
- **Cap.** Merged lists over the tier cap (3 free / 12 contributor) stay on
  the other device, and a toast names how many.

---

## Failure modes

| Case                          | Behaviour                                                                |
| ----------------------------- | ------------------------------------------------------------------------ |
| No relay host configured      | Store stays disconnected, nothing opens                                  |
| Pasted text isn't a full link | Inline note: it needs the part after `#`                                 |
| A live envelope won't decrypt | Pill reads "Mismatch" with a note; a fresh pairing link fixes both sides |
| Stored catch-up won't decrypt | Ignored. It's stale, and this device's push on connect replaces it       |
| Socket drops                  | "Offline"; partysocket reconnects and the device pushes again on open    |
| Merged lists exceed the cap   | Extras stay on the other device; toast says how many                     |
| Room idle 30 days             | Relay alarm deletes the envelope; devices keep their own copies          |

---

## Known edges

- **LWW trusts wall clocks.** A device whose clock runs minutes fast wins
  ties it shouldn't. The audit measured typical skew at 5–30s, and
  field-level stamps keep the blast radius to one field of one item.
- **A tombstone older than 30 days is pruned.** A device offline for longer
  than that can bring back what was deleted while it was away.
- **The relay keeps only the last envelope.** A brand-new device catches up
  from whichever device pushed last. Each device pushes its fully merged
  state, so that copy is complete as long as the last pusher had merged
  before it pushed.
