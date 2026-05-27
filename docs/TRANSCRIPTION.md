# Transcription And Completion

ZipList turns recordings into list mutations. The current path supports both new
items and completion detection.

## Services

- `transcriptionService.js` - Main orchestrator. Captures the target list before
  transcription starts so late list switches do not send results to the wrong
  list.
- `simpleHybridService.js` - Chooses the transcription backend.
- `geminiService.js` - Sends audio/context to Gemini and normalizes structured
  responses.
- `responseParser.js` - Parses model JSON/text responses.
- `listParser.js` - Parses plain transcript text and simple commands.
- `listsService.js` - Applies parsed items, commands, and completion matches.
- `whisper/whisperService.js` - Local Whisper Tiny model loading/transcription.

## Backend Selection

```text
recording
  -> active unchecked items collected as context
  -> Gemini when completion context is needed or Whisper is not ready
  -> Whisper when local model is ready and semantic completion is not needed
```

Gemini can return structured JSON:

```json
{
  "items": ["Buy eggs"],
  "complete": ["Buy milk"]
}
```

Whisper returns transcript text only:

```json
{
  "text": "buy eggs",
  "items": [],
  "complete": [],
  "structured": false
}
```

## Completion Matching

Completion detection is intentionally conservative:

- Match against the captured target list, not whatever list is active later.
- Prefer exact normalized matches.
- Use substring matching only when it resolves to one unique unchecked item.
- Toggle only unchecked items.

This supports phrases like "I bought the milk" ticking `Buy milk` without turning
ambiguous speech into destructive list commands.

## Parser Safety

- Structured JSON-looking responses fail closed if they cannot be parsed.
- Structured Gemini `items` bypass the command parser so text like `Clear list`
  can be added as an item when it came from the model's `items` array.
- Plain transcript text can still use command parsing.

## Local Whisper

- Model: Whisper Tiny English through Transformers.js.
- The local model loads in the background.
- Gemini remains the fallback while Whisper is loading or when semantic
  completion context is needed.
- Privacy/offline behavior should be tested on real devices before strong public
  claims.

## Verification Checklist

- Say new items and verify they append to the active list.
- Switch lists while transcription is running; result should land in the
  original target list.
- Say "I bought the milk" with `Buy milk` unchecked; it should tick the item.
- Say a completion phrase that could match two items; it should avoid ambiguous
  toggles.
- Test once with Whisper still loading and once after Whisper is ready.
