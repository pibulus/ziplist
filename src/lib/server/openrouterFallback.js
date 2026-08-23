// ===================================================================
// openrouterFallback.js — the second door, for when the till is empty
// ===================================================================
// Every Gemini-powered app in the fleet draws on ONE prepay balance. On
// 2026-08-23 that balance hit zero and took all seven down together while
// every individual key was still perfectly valid. OpenRouter bills a
// different account entirely, so a QUOTA failure - and only a quota failure -
// can be rescued by sending the same audio somewhere else.
//
// Deliberately narrow. A bad key, a malformed request or a model outage is
// not something a second provider fixes, and retrying those would only add
// latency before the user sees the same error anyway.
//
// Silent when unconfigured: no OPENROUTER_API_KEY means null, and the caller
// shows the honest message it would have shown regardless.

import { env } from "$env/dynamic/private";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 45000;

// OpenRouter wants a bare format name, not a MIME type.
const AUDIO_FORMATS = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

function audioFormat(mimeType = "") {
  return AUDIO_FORMATS[mimeType.toLowerCase().split(";")[0].trim()] ?? "webm";
}

/**
 * Re-run one transcription through OpenRouter. Returns the text, or null if
 * the fallback is unconfigured or fails - it never throws, because it runs
 * inside a catch block that already holds an error worth reporting.
 */
export async function transcribeWithOpenRouter({ prompt, file, mimeType }) {
  const key = env.OPENROUTER_API_KEY;
  if (!key) return null;

  // A rolling alias on purpose (the anti-drift law): OpenRouter resolves "~"
  // aliases to Google's current flash tier, so this cannot rot into a
  // withdrawn dated model. Verified audio-capable 2026-08-23.
  const model = env.OPENROUTER_MODEL ?? "~google/gemini-flash-latest";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // so the spend shows up as ZipList in the OpenRouter dashboard
        "HTTP-Referer": env.PUBLIC_APP_URL ?? "https://ziplist.app",
        "X-Title": "ZipList",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "input_audio",
                input_audio: { data, format: audioFormat(mimeType) },
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.warn(`[openrouter] fallback returned ${response.status}`);
      return null;
    }

    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) return null;

    console.log(
      `[openrouter] rescued a transcription via ${payload.model ?? model}`,
    );
    return text;
  } catch (error) {
    console.warn("[openrouter] fallback failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
