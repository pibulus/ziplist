# ZipList Next

Release baseline:
- Current release target: `0.8.0`
- `main` now points at the hardened Gemini route build using `gemini-3.1-flash-lite-preview`

What looks solid:
- Build passes
- Gemini API key has been verified live against Google
- Route now has rate limiting, upload guards, and optional origin allowlisting
- Recording time-limit flow is less racey than before

What still wants attention:
- `npm run lint` still fails on broad Prettier drift across unrelated files
- Existing Svelte warnings remain in swipe UI and some modal markup
- `MainContainer.svelte` still owns more recording orchestration than ideal
- This still feels like a strong public test build, not as mature as TalkType

Obvious next moves:
- Test real phone capture/transcription latency and failure behavior
- Clean the a11y warnings in swipe/list and modal components
- Thin `MainContainer` and move more recorder ownership into services/components
- Decide after testing whether the next step is `0.8.1` polish or `0.9.0`
