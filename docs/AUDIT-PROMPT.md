# ZipList v1.0 Audit Prompt

_Last calibrated 2026-07-31. The "already fixed" list below is the part that
rots — refresh it before each run or the auditor wastes its pass re-finding
solved problems._

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

## Already fixed 2026-07-30→31 — do NOT report these

All of these were found, fixed, and verified in production in the session
before yours. Confirm them if you like, but do not present them as findings:

- **Live sharing 403.** Netlify's `PARTYKIT_CREATE_SECRET` had drifted from the
  PartyKit room server's. Re-synced; `/api/live/create` returns 200 in prod.
- **Card shadow clipped on mobile.** `.swipe-container` clipped the card's hard
  shadow because `overflow-x: clip` landed on the slide's 4px padding edge.
  Fixed with `overflow-clip-margin` in `SwipeableLists.svelte`.
- **Sluggishness / "memory hungry".** Never memory (JS heap ~4MB).
  `gradient-shift` animates `background-position` (non-compositable) on all
  three carousel cards forever. Paused on inactive slides: 3 running → 1.
- **Footer safe-area.** The `max-width:640px` block overrode
  `padding-bottom: max(1rem, env(safe-area-inset-bottom))` with a flat
  `0.5rem`, killing the inset on notched phones.
- **Header icon tap targets** 40px → 44px. **Empty-state void** softened via
  `min-height` in the 480px block (the base rule was being overridden).
- **Offline Whisper REMOVED entirely** (2026-07-31). Do not suggest restoring
  it. Gemini returns transcript + parsed items in ONE pass; Whisper produced
  text only, so item splitting fell back to `listParser`'s regex and semantic
  completion detection was lost. 117MB for a worse list.
- **The CSP was never being applied at all.** `hooks.server.js` and
  `hooks.server.ts` both existed; Vite resolves `.js` first, so the `.ts`
  holding the CSP was dead code. Consolidated to one `hooks.server.js`, plus a
  `netlify.toml` `[[headers]]` block for the prerendered homepage that no hook
  can reach. A stray `_headers` file was removed for the same reason.
- **Sound Cues + Ready Mic settings removed** (Ready Mic wrote a preference
  nothing read). **Header "+" removed**, new-list moved into Options.
  **Chunky mode bumped** and de-blackened.
- **`BODY_SIZE_LIMIT` is not a blocker.** That was a Pi concern; this app is on
  Netlify. 120s cap at 48kbps → ~1MB base64 requests, well under the 6MB
  function limit.

### Two traps this codebase has already fallen into twice

Both are worth checking for elsewhere, and neither is theoretical here:

1. **A second file silently shadowing the first.** Two `hooks.server.*` files,
   then two static header sources. Each time the "extra" file won by an
   extension/precedence rule nobody remembers, and disabled the real one.
2. **CSP quietly killing a feature.** Nothing crashes. The app just does less —
   offline transcription silently falling back, fonts silently substituting.
   Load every route and assert **zero** CSP violations in console; that check
   found real bugs in three sibling apps.

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
