# ZipList PWA

ZipList is installable and local-first. The PWA layer should make the installed
app feel reliable without making the browser code clever.

## Current Behavior

- `static/manifest.json` defines the installable app shell and shortcuts.
- `src/service-worker.js` precaches app assets, keeps API/live/import routes out
  of the cache, and serves cached pages while offline.
- `pwaService` owns install-prompt state, standalone/mobile detection, persistent
  storage requests, and installed-device setup completion.
- `PwaInstallPrompt.svelte` is the post-use install nudge for browsers that can
  install the app.
- `PwaDeviceSetup.svelte` appears only inside an installed mobile PWA when setup
  is incomplete. One tap primes microphone permission, asks for persistent
  storage, and preloads the local Whisper model with progress feedback.
- `wakeLockService` requests Screen Wake Lock while recording and releases it
  when recording stops, errors, or tears down. Unsupported browsers silently skip
  it.
- `PermissionError.svelte` uses iPhone/Android-specific recovery copy when the
  microphone is blocked.

## Design Rules

- Keep PWA browser APIs in `src/lib/services/pwa/`.
- Keep setup UI small and contextual. It should not become onboarding.
- Do not cache model/CDN downloads in the service worker app cache. Let the
  Whisper/Transformers browser cache handle model assets.
- Treat install, permission, persistent storage, and model preload as optional
  upgrades. ZipList should still work as a normal web app when any one of them is
  unavailable.
- Test recording on real iPhone Safari and installed iOS PWA before claiming the
  PWA path is production-ready.

## Real-Device Checklist

- Add to Home Screen from iPhone Safari.
- Open the installed app and run the PWA setup pill on Wi-Fi.
- Deny microphone once, then verify the recovery copy points to iOS settings.
- Record, stop, and immediately record again.
- Let a recording run near the time limit and confirm the screen does not lock on
  browsers that support wake lock.
- Toggle Airplane Mode after setup and confirm the app shell and local lists
  still open.
- Try privacy/offline transcription only after confirming the Whisper model
  loaded successfully.
