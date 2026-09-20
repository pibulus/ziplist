# ZipList Next

Release baseline:

- Current package version: `1.0.0`
- Production deploy: `https://ziplist.app` (Netlify Edge)
- Branch: `main` — green on `npm run check`, `npm run lint`, `npm run build`
- ⚠️ `npm run build` needs an **arm64** node. `.nvmrc` asks for 22.22.2; the
  nvm copy on this Mac is 20.18.1 built for **x64**, so rollup hunts
  `@rollup/rollup-darwin-x64` while `rollup-darwin-arm64` sits right there in
  `node_modules`. The error blames the npm optional-deps bug; it is not that.
  `/opt/homebrew/bin/node` builds it fine. Netlify is unaffected.
- ✅ **Resolved 2026-09-19.** `prettier --check .` used to skip every
  `.svelte` file (no prettier config → `prettier-plugin-svelte` never
  loaded). There is a `.prettierrc` now and all 44 components are checked.
  The reason this stalled so long was a second fault hiding behind the
  first: adding the config alone throws `getVisitorKeys is not a function`
  on every component, because `prettier-plugin-tailwindcss` 0.6.14 cannot
  wrap the svelte plugin on prettier 3.9. Bumped to 0.8.1.
- ✅ **Resolved 2026-09-19.** Six routes — including the homepage — were
  silently exempt from eslint. A literal `<script type="application/ld+json">`
  inside `{@html`…`}` in markup makes svelte-eslint-parser read the rest of
  the file as JS, so each died at `Parsing error: Unexpected token {` and an
  unparseable file is an unlinted file. The tag is assembled in the module
  block now.
- ✅ **Resolved 2026-09-19. Duplicate page metadata, not just JSON-LD.**
  The Messenger/OG bug in CHANGELOG.md was never actually fixed — every
  indexed page was still shipping two of every `og:`/`twitter:` tag and
  THREE canonicals. Sources: `app.html` hardcoded `canonical=ziplist.app`
  (so every /es and /for page told Google it was really the homepage),
  `PageLayout` emitted its English-homepage defaults because
  `MainContainer` passed it nothing, and each route hand-rolled a third
  correct set. PageLayout is the single emitter now; routes feed it
  `seo={{…}}` through MainContainer, and it learned `ogLocale`/`hreflangEn`
  /`hreflangEs` since those are per-route. Verified: 0 duplicate tags, one
  route-correct canonical per page, bidirectional hreflang, Spanish pages
  carrying Spanish og:titles. Old note follows for history:
- ⚠️ ~~**Duplicate JSON-LD on every page — needs a call, not a fix.**~~
  `src/app.html:197` injects a global `WebApplication` block into every
  route, and each route's `<svelte:head>` emits its own. So every page ships
  two `WebApplication` schemas with the same `name` and _different_ bodies
  (14 keys each). Both are valid JSON, which is why nothing caught it. This
  is the same shape as the duplicate `og:image` bug in CHANGELOG.md, and
  Google picks a winner arbitrarily. Deciding which one is canonical — the
  global or the per-route — is an SEO call, so it is parked here and was
  raised in conversation rather than quietly patched.
- Launch Arsenal score: 21 PASS / 0 FAIL

What is shipped & live:

- **RiffRap pastel waterfall gradient** with 12:1 WCAG AAA text contrast
- **1-layer modular hierarchy**: `## Section` headers, movable divider bars (`##` / `---`), and `→ List Portals` with spring roulette flipping
- **Tag engine & resampling**: `#tag` filtering + 1-tap `[ ✂️ Resample to new list ]`
- **1-Tap 'Clear done' & 'Clear list'**: instant list cleanup with a 5.5s tactile Undo toast safety net
- **Zero-shift silky modals**: stable `scrollbar-gutter` + tactile pop-in/pop-out animations across all dialogs
- **Live Room Voice Capture**: collaborate and speak items straight into shared rooms (`/live/[roomId]`)
- **Hold-to-talk Mascot Quick Capture**: long-press / hold on the mascot anywhere for instant walkie-talkie recording
- **1-Tap magic link auto-unlock**: `?unlock=<code>` unlocks on device without manual typing
- **Square AUD production checkout**: live Apple Pay / Google Pay / Card processing
- **Bespoke Contributor Passport email hook**: auto-sends 4-word code + magic link via Resend
- **Sovereign device sync**: 4-word phrase (`/j/[phrase]`) over ephemeral memory pipes with zero logins
- **Pull-down-to-add**: tug the top of a list, a ghost draft row grows under the finger, release past the detent to start typing

Visual-pass decisions (2026-09-19), so they stop resurfacing:

- **Footer trimmed on phones: ~90px → ~78px.** Nav buttons go 44px → 38px
  under 640px wide, plus the top padding and row gap. 44 is Apple's
  recommendation for _primary_ targets and WCAG 2.2 AA asks 24; these are
  tertiary links in permanently-visible chrome, so 38 is a fair call rather
  than a compromise. `env(safe-area-inset-bottom)` (~34px of home-indicator
  clearance) is the rest and genuinely has to stay — a flat value there once
  put the footer under the home indicator, see the comment in
  PageLayout.svelte.
- **Remaining footer lever, if it still reads tall:** stop it being `fixed`
  on phones. A permanently-docked bar spends ~78px of a small screen on
  three things nobody taps often. Scrolling it with the page gives that back
  to the list. Not done — it changes the feel of the app, so it wants a
  deliberate yes.
- **Footer stays frozen at sm and up.** The bar is shared with TalkType and
  two siblings (Pablo's call, 2026-08-12). The trim is inside
  `@media (max-width: 640px)` only.
- **Checkbox glow follows the list, not the vibe.** Was
  `--zl-primary-color-rgb`, identical on every list, so a yellow list wore a
  pink halo. Now derived from `--zl-item-accent`.
- **Item tag chips only appear while a filter is on**, and the filtered-by
  tag is dropped from each row since every visible row carries it.

SEO/head findings (2026-09-20):

- ✅ **/about shipped** — a real content page (how it works, what it refuses
  to do, six FAQs) at `https://ziplist.app/about`, prerendered, in the
  sitemap, linked from inside the About modal rather than given its own
  footer button. Its FAQ copy and its FAQPage schema are generated from one
  array, so they cannot drift.
- ✅ **app.html was shadowing every route's title and description.** Both
  were hardcoded there, and app.html is emitted before `%sveltekit.head%`,
  so they won. Every page in the site — including the Spanish ones — showed
  the English homepage title in the tab and in search. Removed; PageLayout
  owns head metadata now.
- ✅ **Removed a visually-hidden top-level heading from app.html** that put
  the English homepage headline on every route, duplicating the real hero
- ✅ **Resolved 2026-09-20. The verticals are pages now, not app clones.**
  All six SEO routes mounted `MainContainer`, so they shipped byte-identical
  visible text — six URLs, one page, nothing for a crawler to tell apart, and
  Spanish routes with no Spanish words on them. `/for/groceries`,
  `/for/couples`, `/es/mandado` and `/es/parejas` are real pages now: heading,
  lede and three Q&As each, all of it copy that already existed in their
  schema and had simply never been rendered. They link to the app rather than
  being it. `VerticalPage.svelte` is the shared chassis; `/about` uses it too.
- ⚠️ **`/es` is still a byte-identical copy of `/`.** It is the Spanish entry
  point but renders the English app, so it competes with the homepage and
  cannot rank for Spanish queries. Three ways out: make it a vertical (needs
  Spanish copy written — no FAQ exists for it, and that is Pablo's voice, not
  mine to invent), leave it as the app and drop it from the sitemap, or let
  `/es/mandado` and `/es/parejas` carry Spanish SEO alone. Wants a decision.
- ⚠️ **"sub-10ms via WebSockets"** is now visible copy on `/for/groceries`. It
  was harmless while invisible; as a public claim it is hard to stand behind
  for a network round trip. Worth a rewrite in Pablo's words.
- Minor: app pages carry two h1s (the hero, plus IntroModal's). A dialog
  heading should probably be an h2. Cosmetic, not urgent.

What wants love next (ranked):

1. Set `RESEND_API_KEY` in Netlify production env to activate automatic email dispatch.
2. Real-world iPhone PWA test of 1-tap magic link from email.
3. Real-thumb test of pull-down-to-add. The gesture math is covered by
   `scripts/check-pull-to-add.mjs`, but resistance and the 94px commit
   distance are feel, and feel does not survive a unit test.

See `CHANGELOG.md` for complete version notes.
