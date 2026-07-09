# Fable Audit — 2026-07-05

Launch-readiness audit-and-fix pass on branch `fable-audit-2026-07-05`
(6 commits on top of `fc6371a`). Four read-only audit sweeps (server/payments,
realtime, UI/a11y, dead-code/docs) + manual deep-read of the voice→list core.
Every agent finding was re-verified against the code before fixing; two agent
claims were rejected as false positives (noted at the bottom).

`npm run build` ✅ and `npm run lint` ✅ green at every commit and at HEAD.

---

## ⚠️ PRODUCTION-BREAKING — needs one action outside this repo

**1. `BODY_SIZE_LIMIT` is not set in production.** adapter-node rejects request
bodies over **512KB by default** — before the Gemini route's own 15MB check
ever runs. Browsers record MediaRecorder audio at ~128kbps by default, so
~30 seconds of talking already 413'd in production with a generic error.
This audit cut the recording bitrate to 48kbps (TalkType chassis value), which
extends the safe window to ~85s — **but the app's own cap is 120s, so long
rambles still die at the adapter**.

→ **Fix: add `BODY_SIZE_LIMIT=16M` to `ZIPLIST_EXTRA_ENV` in
`~/.config/fleet/keys.env`, then `keys-sync ziplist`.** Documented in KEYS.md.
I could not verify the Pi's current env — `pibulus.local` was unreachable from
this network — so treat it as unset until proven otherwise. Do this before any
demo where someone dictates a long list. (TalkType likely has the same latent
gap; worth checking its `/etc/talktype.env` too.)

**2. `.env.example` teaches a broken secret.** It says
`CONTRIBUTOR_LICENSE_SECRET=replace_with_at_least_16_random_chars`, but
`licenseCrypto.js` enforces **minimum 32**. Anyone following the example gets
a 500 on _every_ contributor flow (checkout, redeem, success poll). I could
not edit `.env.example` (blocked by session file permissions) — change the
placeholder text to say 32+. Also worth documenting there:
`CONTRIBUTOR_UNLOCK_CODE` (singular) is read by redeem alongside the
documented plural form.

---

## Fixed on this branch (ranked by launch impact)

### Commit `0360a9b` — audio uploads (the core job)

- **48kbps speech bitrate** on MediaRecorder (was browser default ~128kbps).
  Same transcription quality for voice, ~2.7× more talk time per byte.
- Client now shows "recording too long" when a proxy/adapter-level 413 arrives
  with a non-JSON body (previously: generic "Failed to fetch from API").

### Commit `08591b6` — server correctness (payments/licenses)

- **Atomic store writes** (write-then-rename): a crash mid-write could
  truncate `contributor-licenses.json`, after which _every license silently
  vanished_ (corrupt JSON read as `null` → empty store).
- **Mutation lock** (`storeLock.js`): checkout/license stores do full-file
  read-modify-write; two concurrent webhook deliveries (or webhook + success
  poll — a guaranteed race at every purchase) could clobber each other and
  drop a paid checkout.
- **Rate limiter keyed on `cf-connecting-ip`**: behind the Cloudflare tunnel
  every visitor shared ONE bucket — a single heavy user could 429 the whole
  site's transcription. No `ADDRESS_HEADER` env needed.
- **Webhook order-matching fallback**: if Square omits `order_id` at
  payment-link creation, the webhook now matches via the checkoutId embedded
  in `payment_note` and backfills the order id. Unmatched COMPLETED payments
  log at error level (someone paid and got nothing — must be loud).
- **Paid-but-license-failed is no longer terminal**: the checkout-status GET
  returns `{status:"processing"}` instead of a raw 500 (the success page stops
  polling on non-OK, which stranded paying customers on transient hiccups).
- Success page tolerates 4 consecutive transient poll failures before giving
  up (one flaky mobile request right after paying no longer kills the poll).
- Reads that fail for reasons other than file-not-found now log loudly
  (disk/permission outage previously looked identical to an empty store).

### Commit `3b920d8` — live sharing

- **Dead-room reconnect loop killed**: when a room expires/evicts mid-session,
  partysocket reconnected _forever_ (default `maxRetries: Infinity`) against a
  room that kept closing it — battery/network drain while the user believed
  they were still collaborating. Terminal close codes (4004/4005/1008) now
  stop the loop, surface a "this room has popped" notice, and clean up.
- Inbound `LIST_UPDATE` payloads re-sanitized client-side; `sender` objects
  shape-checked before `.id` access (defense-in-depth — server already
  sanitizes, but the client had zero validation of the wire).
- Double-connect window closed (connection registered before the socket
  opens); sync socket-creation failures settle the join promise instead of
  leaving the 12s timeout to reject into nothing.
- **120-item live cap is no longer silent**: the room truncates snapshots past
  `MAX_ITEMS: 120` without telling anyone; the client now warns once per
  connection when the local list exceeds the cap.
- `avatarService` survives throwing `localStorage` (privacy modes previously
  aborted the room join with a generic error).

### Commit `0b58bb6` — a11y + console hygiene + lint

- PermissionError dialog: Space anywhere no longer dismisses it mid-read;
  backdrop-only click (`click|self`) + Escape to close.
- Live room page text colors aligned to the success-page palette
  (`#111827`/`#4b5563` — was `#333`/`#666` on a tinted card).
- Removed prod console noise: PWA install-choice logs, a store debug log that
  **printed the user's transcript text**, prompt-style migration log, per-
  connect PartyKit logs; Whisper download chatter is now dev-only.
- Fixed two pre-existing `npm run lint` failures (empty catch in
  weightless.js, unformatted modalService.js + gemini route). **Lint was red
  on main; it is green now.**

### Commit `0e7ce85` — dead code (−2,173 lines, all verified zero-ref)

- The dead audio-transcript subtree: `AudioVisualizer`, `TranscriptDisplay`,
  `states/{Downloading,Transcribing}State`, `Ghost.svelte`,
  `performanceUtils.js`, `appActive.js`.
- `eventBus.js` + the top-level `services/index.js` barrel (zero importers;
  its one real consumer now imports `waveformData` from
  `$lib/services/infrastructure`).
- Legacy `List.svelte` + `ListItem.svelte` + `list.css` (superseded by
  `SingleList`).
- Three orphaned mascot SVGs in `static/assets/`.

### Commit (docs) — docs truth pass

- Killed the `themeService` ghost from CLAUDE.md / README / GLOSSARY /
  services README (deleted weeks ago in `72d9bce`; four docs still taught it).
- CLAUDE.md's Ghost/TranscriptDisplay copy-button description replaced with
  the real Mascot component story.
- NEXT.md rewritten (was: package 0.8.0, "PartyKit deploy pending" — both
  stale) with the ranked remaining-work list.
- KEYS.md gained the production-env section (`BODY_SIZE_LIMIT`).

---

## Deliberately left alone (and why)

- **Last-writer-wins snapshot sync.** Concurrent edits during a disconnect
  resolve by wall-clock `updatedAt` — the loser's edits vanish silently. This
  is inherent to the intentionally-simple full-snapshot protocol; CLAUDE.md
  says keep it until real usage proves otherwise. A "list updated from another
  device" toast would be the cheap first step if it bites.
- **No "reconnecting…" indicator** during transient live-share outages; the
  list just freezes until the socket returns. Real gap, but it wants a small
  connection-state store + UI treatment — a design decision, not a patch.
- **Server-side `sync_rejected` ack** for structurally invalid snapshots.
  Would touch the deployed PartyKit room (`party/listRoom.ts`); the client-side
  120-item warning covers the only case a legitimate client can hit. Bundle
  it with the next PartyKit deploy.
- **Client-side navigation between two `/live/[roomId]` rooms** doesn't
  re-join (join runs in `onMount`). Unreachable today — there are no in-app
  links between live rooms; joins arrive via full page loads.
- **`GEMINI_MODEL`/`gemini-flash-lite-latest`, keys, payments pricing** — all
  fleet-system territory; policy says never hand-touch.
- **Dependency bumps** (`partykit`, `partysocket`) — NEXT.md already schedules
  them after device-proof; not launch-blocking.
- **`routes/clear-cache`** has zero inbound links but is a functional recovery
  URL — kept as intentional support tooling.

## Audit-agent claims rejected after verification

- "geminiService.js has 6 unconditional stray console.logs" — false; all are
  inside `if (import.meta.env.DEV)` blocks.
- "ListItem.svelte needs Space-key a11y fix" — moot; its only importer was
  the dead `List.svelte`. Both deleted instead.

## Verification

- `npm run build` — passes (adapter-node, warnings-free).
- `npm run lint` — passes (prettier + eslint; was failing on main).
- Not run: real-device pass, live two-device sync, sandbox checkout — these
  need hardware/browser/Square-sandbox and are the top of NEXT.md.

## Follow-up pass — 2026-07-09 (UX/ergonomics + two latent bugs)

Live-audited at 390×844, 820×1180, 1440×900 with Playwright against dev.

- **Backdrop ate every tap inside Intro/About/Extension modals.** The custom
  `.modal-backdrop` (fixed, z:0, full viewport) painted above the z:auto
  `.modal-box`, so "Zip it up" never ran its handler — the modal only closed
  because the backdrop itself is a close button (intro therefore never marked
  seen). `.modal-box` now stacks at z:1. Settings modal was unaffected (own
  layering).
- **Page could freeze forever after closing a modal.** modalService's unlock
  hung off one fragile `once` close-listener; orphan it (node replacement,
  modal→modal switch racing the 220ms close timer) and the body stayed
  `position:fixed`. Replaced with a document-level capture listener that
  force-unlocks when the last dialog closes; switches no longer clobber the
  scroll snapshot.
- **Sound cues could throw on a fresh AudioContext** (negative humanize
  jitter at currentTime 0 → `setValueAtTime` RangeError). Clamped.
- **Options modal reorganized**: Vibe first (Chunky Mode as its sibling),
  FLOW for behavior toggles, Contributor behind a dashed divider; 58rem cap
  (iPad shows it whole), scroll resets between opens, slimmer close X.
- **Item-row family DNA**: reorder ≡ and delete × are twin 44px ghost
  buttons; checked boxes draw a real white tick. Delete circle no longer
  outweighs the checkbox.
- **All DaisyUI modals `modal-middle`** — intro was bottom-docked on phones.
  Dead bottom-sheet CSS + dead delete-button theme vars pruned.

## Coherence pass — 2026-07-09 evening (color / type / frames)

- Cream page ground made constant across themes (was repainted mint/
  lavender/slate per theme); footer follows.
- CTA gradient retired → flat theme primary. Record button fully
  de-hardcoded (was amber→pink everywhere, amber→cyan transcribing).
- Nocturne's animated rainbow .app suffix and focus's pink stray → each
  theme's own gradient pair (--zl-cta-grad-start/end tokens).
- Item rows near-solid white vs tinted card; card wash softened by a
  --zl-card-veil layer (nocturne opts down).
- List header: name always visible, gap ratios fixed, [+ live share] as
  ghost stroke-icon buttons with tooltips (no more emoji pills).
- Neo soft-mode token gaps filled (9 vars were falling back to purple).
- Modal frames unified (30rem, card-radius token); settings modal on the
  fluid type scale; stray radii snapped.

## Share/PWA coherence — 2026-07-09 late (same evening)

- Header ratios: title 1.02rem full-strength, trio clustered (40px ghost
  boxes, 0.1rem gap).
- /import rewritten in product voice: list name is the title, "Add to my
  lists" / "Not now" actions (flat primary, ink text — was unreadable
  white-on-yellow), theme-token checkboxes + tick, ghost X.
- /live/[roomId] btn-primary flat (was amber→teal + red hover shadow).
- PwaDeviceSetup: flat primary button + progress (was gradient + white
  text). manifest.json already cream.
