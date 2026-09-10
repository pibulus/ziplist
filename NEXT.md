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
- ⚠️ `prettier --check .` silently **skips every `.svelte` file** — there is no
  prettier config, so `prettier-plugin-svelte` never loads and prettier has no
  parser for the extension. 90-odd components have never been format-checked.
  eslint does cover them. Turning this on means reformatting all of them at
  once, so it is a decision, not a chore.
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

What wants love next (ranked):

1. Set `RESEND_API_KEY` in Netlify production env to activate automatic email dispatch.
2. Real-world iPhone PWA test of 1-tap magic link from email.
3. Real-thumb test of pull-down-to-add. The gesture math is covered by
   `scripts/check-pull-to-add.mjs`, but resistance and the 94px commit
   distance are feel, and feel does not survive a unit test.

See `CHANGELOG.md` for complete version notes.
