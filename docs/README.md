# ZipList Docs

This folder is for current project orientation. Historical audits and old cleanup
plans live under `docs/archive/`.

## Current Docs

- `../CLAUDE.md` - AI-agent coding standards and current implementation notes.
- `../GLOSSARY.md` - Current product/component/service glossary.
- `PRODUCT_POSITIONING.md` - Product language, scope, and what ZipList is not.
- `ARCHITECTURE.md` - Current codebase map and ownership boundaries.
- `PWA.md` - Installable app, offline shell, wake lock, and installed-device
  setup notes.
- `TRANSCRIPTION.md` - Single-pass Gemini audio transcription, parser, and item-completion flow.
- `LIVE_SHARING.md` - Cloudflare Durable Object live-list architecture and deploy notes.
- `DEVICE_SYNC_SPEC.md` - End-to-end encrypted (`AES-GCM`) multi-list Device Sync protocol, field-level merge, and verification commands.

## Archive

- `archive/` - Older audits, implementation notes, and historical cleanup plans.
- `archive/legacy-audits/` - Former active docs that referenced deleted
  components or completed cleanup work.

When adding new docs, prefer one maintained current document over a timestamped
handoff unless the file is intentionally historical.
