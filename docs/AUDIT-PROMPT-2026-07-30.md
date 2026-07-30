# ZipList v1.0 Audit Prompt — 2026-07-30

Paste everything below the line into a fresh Claude instance running in the
ZipList repo. Written to be adversarial about the right things and to refuse
to re-litigate what is already settled.

---

You are auditing **ZipList**, a SvelteKit voice-to-list app at ~99% and going
for a v1.0 tag tonight. Repo root is the app. Read `CLAUDE.md`, `docs/`, and
`PROJECT_LEDGER.json` before forming any opinion.

## Your job

Find what would actually embarrass this app in front of a real user on a real
phone, or what would silently break in production. Rank by **user-visible
severity**, not by how interesting the finding is.

## Rules of engagement — read these before reporting anything

1. **Verify before asserting.** This codebase has been audited before and the
   prior auditor's biggest failure mode was reporting things that were already
   fixed, or that its own reading of the code had invented. For every finding:
   name the file and line, quote the actual code, and state the concrete
   input/state that produces the bad output. If you cannot produce a failing
   path, label it **SPECULATIVE** and rank it below everything concrete.

2. **A green build is not a working app.** Where you can, actually run it:
   `npm run dev` (port 3001) and drive it with Playwright at a 390×844
   viewport. Measure with `getBoundingClientRect()` and
   `document.getAnimations()` rather than reasoning about CSS in your head.
   Browser measurement beats code-reading for any layout or perf claim.

3. **Severity discipline.** Reserve "critical" for data loss, security holes,
   or a core flow that cannot complete. A cosmetic nit is not a P1. If
   everything you found is minor, say so plainly — a short honest list beats a
   padded one. Do not invent a critical to justify the exercise.

4. **No scope creep into product decisions.** The following are deliberate and
   are NOT findings: no dates, no nested items, no multi-list rooms, no
   accounts, intentionally non-scalable, local-first. See `docs/V1.1.md`.

## Already fixed on 2026-07-30 — do NOT report these

These were found and fixed in the session immediately before yours. Confirm
they are still fixed if you like, but do not present them as new findings:

- **Live sharing 403.** Netlify's `PARTYKIT_CREATE_SECRET` had drifted from the
  PartyKit room server's. Fixed by re-syncing the Netlify env var.
- **Card shadow clipped on mobile.** `.swipe-container` clipped the card's hard
  shadow because `overflow-x: clip` landed on the slide's 4px padding edge.
  Fixed with `overflow-clip-margin` in `SwipeableLists.svelte`.
- **Sluggishness / "memory hungry".** It was never memory (JS heap ~4.4MB).
  `gradient-shift` animates `background-position` (non-compositable) on all
  three carousel cards forever. Fixed by pausing it on inactive slides.
- **Whisper offline model dead in prod.** CSP `connect-src` omitted
  `huggingface.co` / `cdn.jsdelivr.net`. Fixed in `src/hooks.server.ts`.
- **"Live sharing needs one more try" on a permanent failure.** Status codes
  were swallowed in `partyService.js`. Now distinguishes config faults.
- **Sound Cues + Ready Mic settings removed** (Ready Mic wrote a preference
  nothing read). **Header "+" removed**, new-list moved into Options.
  **Chunky mode bumped** and de-blackened.

## Where to actually look

Rank these by likely payoff:

1. **The transcription pipeline end to end** — `transcriptionService.js`,
   `simpleHybridService.js`, `responseParser.js`, `listsService.js`. What
   happens on a malformed model response, a 3-second recording, a 10-minute
   recording, an empty transcript, a network drop mid-transcribe? Does the
   target-list lock hold if the user swipes lists mid-transcription?
2. **Local storage durability** — `listsStore.js`. Quota exceeded, corrupt
   JSON, a schema from an older version, two tabs writing at once. Is any path
   capable of losing a user's list?
3. **Live collaboration edge cases** — `party/listRoom.ts`,
   `liveListsService.js`. Two devices editing the same item, a room that
   expires mid-session, reconnect after backgrounding a phone for an hour.
   Snapshot-based sync means last-write-wins; find where that actually bites.
4. **Mobile reality at 390×844 and 375×667** — anything that overflows, any
   tap target under 44px, anything that hides behind the footer or the corner
   voice button, any state where the list can't be scrolled clear.
5. **Accessibility basics** — keyboard path through add/edit/reorder/delete,
   focus management when modals open and close, screen-reader labels on the
   icon-only header buttons.
6. **Security** — the app went through a hardening pass through 2026-07-05
   (CSP, rate limiting, room auth, webhook idempotency). Look for what that
   pass would have missed, especially anything touching the contributor token
   or the Square webhook.

## Output format

For each finding:

```
[SEVERITY] Short title
File:line
What breaks: <concrete failing input/state -> wrong output>
Evidence: <quoted code, or measured browser result>
Fix: <smallest change that works>
```

Then a final section: **"What I checked and found healthy"** — so the clean
areas are on the record too, and a second reader knows what you covered.

Be blunt. If something is over-engineered, say delete it. If the app is
basically ready and the remaining list is cosmetic, say that clearly rather
than manufacturing work.
