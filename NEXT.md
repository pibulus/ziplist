# ZipList Next

Release baseline:

- Current package version: `0.9.0` (tag `1.0.0` after the device pass)
- Branch: `main` — the full audit + design-coherence arc (27 commits) is merged
  and pushed as of 2026-07-10
- Latest verified checks: `npm run lint`, `npm run build`, live two-tab
  PartyKit room test on local dev

What looks solid:

- Core local list flow: add, edit, delete, reorder, move, toggle — verified
  live in-browser at 390/820/1440 during the design pass.
- One design language everywhere: constant cream ground, flat brand-yellow
  CTA, ghost stroke icons, saturated mascots, branded share/live landings.
  Laws are recorded in `GLOSSARY.md` and `docs/FABLE-AUDIT.md`.
- Gemini route is server-side and guarded (rate/upload/origin, per-visitor
  buckets); Whisper Tiny local fallback; 48kbps speech bitrate.
- PartyKit live sharing deployed (`ziplist.pibulus.partykit.dev`); rooms
  verified end-to-end on local dev (create, join, sync, presence with
  DiceBear faces). Dev CSP now allows `ws://localhost` for `dev:party`.
- Square $9 contributor checkout wired end-to-end; stores atomic + locked.

What still wants attention (ranked — all Pablo-hands):

1. **Deploy main to the Pi** (`npm run deploy:pi`) — production still serves
   the pre-coherence build.
2. **Set `BODY_SIZE_LIMIT=16M`** via `ZIPLIST_EXTRA_ENV` in the fleet
   `keys.env`, then `keys-sync ziplist` → `key-doctor`. adapter-node's 512KB
   default 413s recordings past ~85s. See KEYS.md.
3. Fix `.env.example`: `CONTRIBUTOR_LICENSE_SECRET` says "at least 16" chars
   but code enforces **32** (file is permission-blocked for agent sessions).
4. Real-device iPhone pass: add, rename, reorder, live share — especially
   watching another device's typing/draft indicators (unverifiable from one
   browser profile).
5. Square sandbox-card checkout once, end to end.
6. Production/social screenshots → tag `v1.0.0`.

After the tag, `docs/V1.1.md` is the charter: pretty word-slug links, portal
items, sliding room TTL, copy-as-text, hold-to-capture, voice-in-rooms — and
the hard cutoffs (no dates, no trees, no multi-list rooms, no accounts).

See `docs/FABLE-AUDIT.md` for the complete 2026-07-05→10 audit + design record.
