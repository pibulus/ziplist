# Transcription And Completion

ZipList turns recordings into list mutations in a single server-side Gemini audio pass, supporting both new items and semantic completion detection.

## Services

- `transcriptionService.js` - Main orchestrator. Captures the target list before
  transcription starts so late list switches do not send results to the wrong
  list.
- `geminiService.js` - Sends audio and active-list context to `/api/gemini` and normalizes structured
  responses.
- `geminiApiService.js` - Server/client boundary for Gemini API calls.
- `responseParser.js` - Parses model JSON/text responses.
- `listParser.js` - Fallback regex splitter for unstructured text responses and simple commands.
- `listsService.js` - Applies parsed items, commands, and completion matches.

## Single-Pass Audio Flow

```text
recording
  -> active unchecked items collected as context
  -> /api/gemini (single-pass audio + context prompt)
  -> structured JSON { items, complete }
```

Gemini returns structured JSON directly from the audio:

```json
{
  "items": ["Buy eggs"],
  "complete": ["Buy milk"]
}
```

If an unstructured text response is returned, `listParser.js` splits it into items as a safe fallback:

```json
{
  "text": "buy eggs",
  "items": ["Buy eggs"],
  "complete": [],
  "structured": false
}
```

_(Note: The legacy 117MB local Whisper fallback was removed on 2026-07-31 because raw transcript text lost semantic item splitting and completion matching.)_

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

## Verification Checklist

- Say new items and verify they append to the active list.
- Switch lists while transcription is running; result should land in the
  original target list.
- Say "I bought the milk" with `Buy milk` unchecked; it should tick the item.
- Say a completion phrase that could match two items; it should avoid ambiguous
  toggles.
