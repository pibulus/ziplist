# ZipList Next

Release baseline:

- Current package target: `0.8.0`
- Branch: `main`
- Latest verified checks: `npm run lint`, `npm run build`, `git diff --check`

What looks solid:

- Core local list flow is intact: add, edit, delete, reorder, move, toggle.
- Gemini route is server-side and guarded by rate/upload/origin controls.
- Voice completion detection can mark existing unchecked items as done when
  Gemini has active-list context.
- Whisper Tiny remains the local/offline path once it is ready.
- PartyKit room creation now uses unique `/parties/main/:roomId` rooms and
  validated full-list snapshots.
- Live Share now copies/shares the live room URL once a list is live.

What still wants attention:

- Real-device iPhone pass across add, rename, reorder, item action sheet, and
  live-list sharing.
- PartyKit production deploy and env wiring.
- Production/social screenshots.
- Decide whether joined live lists should auto-reconnect from saved `liveRoomId`
  metadata on app launch.
- Dependency refresh pass for `partykit` and `partysocket` after live sharing is
  proven on devices.

Obvious next moves:

- Run `npm run dev` and `npm run dev:party` side-by-side.
- Test the live link from Mac to iPhone on the LAN.
- Deploy PartyKit with `PARTYKIT_CREATE_SECRET`.
- Re-run the same two-device live test against production.
- Commit the current audit/fix/docs batch when satisfied.
