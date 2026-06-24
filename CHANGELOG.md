# Changelog

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
