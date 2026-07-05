# ZipList Next

Release baseline:

- Current package version: `0.9.0`
- Branch: `main` (audit fixes on `fable-audit-2026-07-05`)
- Latest verified checks: `npm run lint`, `npm run build`

What looks solid:

- Core local list flow is intact: add, edit, delete, reorder, move, toggle.
- Gemini route is server-side and guarded by rate/upload/origin controls, with
  per-visitor rate buckets (`cf-connecting-ip`) behind the Cloudflare tunnel.
- Voice completion detection can mark existing unchecked items as done when
  Gemini has active-list context.
- Whisper Tiny is integrated as a local fallback with privacy mode support.
- Recording uses a 48kbps speech bitrate so the 120s cap stays uploadable.
- PartyKit live sharing is deployed (`ziplist.pibulus.partykit.dev`) with
  validated snapshots, hashed room passwords, and dead-room close handling.
- Square $9 contributor checkout is wired end-to-end; license/checkout stores
  are atomic (write-then-rename) and mutation-locked.

What still wants attention (ranked):

1. **Set `BODY_SIZE_LIMIT=16M` in `/etc/ziplist.env`** (via `ZIPLIST_EXTRA_ENV`
   in the fleet `keys.env`, then `keys-sync ziplist`). adapter-node's default
   512KB body cap 413s recordings past ~85s even at the new 48kbps bitrate.
   See KEYS.md.
2. Fix `.env.example`: `CONTRIBUTOR_LICENSE_SECRET` placeholder says "at least
   16" chars but the code enforces **32** — a 16-char secret 500s every
   contributor flow. (Blocked from editing in the audit session.)
3. Real-device iPhone pass across add, rename, reorder, item action sheet, and
   live-list sharing.
4. Redeem a code via Square sandbox card end-to-end in a browser.
5. Production/social screenshots.
6. Decide whether joined live lists should auto-reconnect from saved
   `liveRoomId` metadata on app launch.
7. Dependency refresh pass for `partykit` and `partysocket` after live sharing
   is proven on devices.

Obvious next moves:

- Set BODY_SIZE_LIMIT (item 1) — it's one `keys.env` edit + `keys-sync`.
- Run `npm run dev` + `npm run dev:party`, test a live link Mac → iPhone.
- Do the sandbox-card checkout pass, then screenshots, then ship.

See `docs/FABLE-AUDIT.md` for the full 2026-07-05 audit record.
