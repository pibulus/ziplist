# Device Sync

> Passport lists follow paired devices. The relay only sees sealed snapshots.

Status: **local two-browser check, 2026-11-01.** Owner → second browser,
second browser → owner, and checks made immediately after remote additions
converged in three repeated runs. Real Passport redemption, deployed Worker,
and physical-device pairing still need a pass.

Verify, in this order:

```bash
npm run check                               # crypto, merge, bundle round-trip
LIVE_SMOKE_SKIP_EXPIRED_SOCKET=1 npm run smoke:live  # local relay + four-word list
npx wrangler deploy --dry-run               # worker bundle, no deploy
```

The old `scripts/verify-live-relay-sync.mjs` models a retired random-URL-key
flow; it is **not** proof of current Passport pairing. A real two-device pass
against the deployed relay remains a release gate.

---

## The Passport code is the secret

`deviceSyncStore.js` derives a room id **and** AES-GCM key from the saved
Passport code (plus the optional private sync phrase, when set) using PBKDF2
and HKDF. The room id has the `zl_p` prefix. The relay sees that id and sealed
envelopes, never the code or plaintext. A four-word Passport passkey is
**speakable, not high-entropy**; encryption does not make a guessed passkey
unguessable. The optional phrase changes the secret and must match on every
paired device.

The Passport card's QR and copy-link carry `#code=<passkey>` and an optional
`&sync=<private phrase>` in the URL fragment. The recipient redeems the code
before syncing; an unlicensed phrase does not grant paid access. On iOS an
installed PWA has different storage from Safari, so the link must be opened
in the intended app or the key entered there. There is **no random `#k` key**
in the current pairing flow.

Four-word **shared-list** links also use `zl_p` room ids, but contain list
snapshots rather than sync envelopes. `worker/index.ts` distinguishes the
existing room type by its stored `listData`, preserving older share links.

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
| Pairing code is unlicensed    | Redeem rejects it; local lists stay on this device                      |
| A live envelope won't decrypt | Pill reads "Mismatch" with a note; a fresh pairing link fixes both sides |
| Stored catch-up won't decrypt | Ignored; matching pairing credentials are needed before lists can merge  |
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
