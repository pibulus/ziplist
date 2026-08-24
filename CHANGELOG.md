# Changelog

## 1.0.0 — The 1-Layer Modular Hierarchy & Resampling Release

- **RiffRap Pastel Waterfall**: Restored rich saturated gradient cards with 12:1 WCAG AAA text contrast.
- **Fluid 1:1 Touch Drag & Drop**: Eliminated touch delta offsets and dedicated 40px touch targets for grab handles.
- **Zero-Jump Inline Editing**: Replaced edit modal sheets with in-place zero-pixel shift editing.
- **`## Section` Headers & `##` Divider Bars**: Type `## Category` for uppercase headers, or `##` / `---` for movable divider bars.
- **`→ Portals`**: Type `→ Target` to link lists with spring carousel navigation and on-demand list minting.
- **Interactive `#Tags` & Resampling**: In-place filtering by tag and 1-tap `[ ✂️ Resample to new list ]` extraction.
- **Coherent Self-Consolidating Tag Engine**: Local singular/plural stemming (`cohereTag`) + memory-aware Gemini prompts.
- **Magic AI List Import**: Unstructured text paste extraction via Gemini.
- **Zero-Glitch Initial Carousel Mount**: Instant snap on mount without phantom slide animations.
- **Playable Starter Cartridge**: 3-item interactive manual pre-filled on first install.

## 0.9.0 — Security & correctness hardening

- **CSP headers**: full Content-Security-Policy with `frame-ancestors 'none'`,
  `object-src 'none'`, and PartyKit `connect-src` scoping.
- **Rate limiter**: eviction cap + background sweep so a flood of unique IPs
  can't grow the bucket map unboundedly.
- **PartyKit room**: SHA-256 password hashing at rest, timing-safe comparison,
  and legacy plaintext upgrade path. `ITEM_FOCUS` now returns null on bad
  input instead of emitting garbage.
- **Contributor tokens**: single `CONTRIBUTOR_LICENSE_SECRET` source, 32-char
  minimum enforced, no silent fallback to unrelated secrets.
- **Square webhook**: `createLicenseForCheckout` failure no longer surfaces as
  a 500 to Square — caught, logged, payment stays marked paid.
- **Import/share**: item text length capped at `MAX_ITEM_TEXT_LENGTH` (140).
- **Response parser**: `$`-sequence replacement in prompt templates fixed
  (replacer function, not direct string replace).
- **Live protocol**: `sanitizeLiveListData` builds fresh object literals
  (verified prototype-pollution safe). Completion-matching dual-guard prevents
  false positives.

## 0.8.0 — Live sharing & completion detection

- PartyKit live list collaboration with full-list snapshots and ephemeral
  presence.
- Voice completion detection — Gemini can mark existing items as done when
  the speaker indicates completion.
- Whisper Tiny local model integration with privacy mode and Gemini fallback.
- Contributor checkout flow via Square.
- PWA install flow, wake lock, and device-setup pill.
- Five themes (focus, chill, zen, nocturne, neo) + Chunky Mode overlay.
- Canvas confetti celebrations on list completion.
