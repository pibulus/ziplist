import { GoogleGenAI } from "@google/genai";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { json } from "@sveltejs/kit";
import { enforceRateLimit } from "$lib/server/rateLimiter";
import { transcribeWithOpenRouter } from "$lib/server/openrouterFallback";
import { validateOrder } from "$lib/server/smartOrder.js";

let genAI = null;
let genAIKey = "";

const MAX_UPLOAD_BYTES = Number(env.MAX_UPLOAD_BYTES ?? "15728640");
const MAX_PROMPT_CHARS = 12000;
const DEFAULT_AUDIO_MIME_TYPE = "audio/webm";
const GENERATION_CONFIG = {
  temperature: 0.2,
  topP: 0.8,
  topK: 40,
  candidateCount: 1,
  maxOutputTokens: 2048,
  thinkingConfig: { thinkingLevel: "minimal" },
};

function getAllowedOrigins(eventOrigin) {
  const configured = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured.length > 0) return configured;
  if (dev) return [];
  const defaults = new Set(["https://ziplist.app"]);
  if (publicEnv.PUBLIC_APP_URL?.trim()) {
    defaults.add(publicEnv.PUBLIC_APP_URL.trim().replace(/\/+$/, ""));
  }
  if (eventOrigin) defaults.add(eventOrigin);
  return [...defaults];
}

function isOriginAllowed(request, eventOrigin) {
  const allowedOrigins = getAllowedOrigins(eventOrigin);
  if (!allowedOrigins.length) return true;

  const origin = request.headers.get("origin");
  // Same-origin fetches without Origin header are guarded by Sec-Fetch-Site when present
  if (!origin) {
    const fetchSite = request.headers.get("sec-fetch-site");
    return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
  }

  return allowedOrigins.includes(origin);
}

function estimateBase64Bytes(value) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function getGeminiClient() {
  const apiKey = env.GEMINI_API_KEY;

  // The POST handler guards this today, but don't rely on every future
  // caller remembering to — an undefined key throws deep inside the SDK.
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  if (!genAI || genAIKey !== apiKey) {
    if (typeof process !== "undefined") {
      process.env.GEMINI_API_KEY = apiKey;
      delete process.env.GOOGLE_API_KEY;
    }

    genAI = new GoogleGenAI({ apiKey });
    genAIKey = apiKey;
  }

  return genAI;
}

async function withRetry(fn, { tries = 3, baseMs = 600 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err?.message || err);
      const transient =
        /\b(503|429|overload|UNAVAILABLE|RESOURCE_EXHAUSTED)\b/i.test(msg);
      lastErr = err;
      if (!transient || i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw lastErr;
}

function transcriptionPayloadError(message, status = 400) {
  return Object.assign(new Error(message), {
    status,
    transcriptionPayloadError: true,
  });
}

function getGeminiErrorKind(error) {
  const message = `${error?.message || ""}`;

  if (message.includes("API_KEY_INVALID")) {
    return "invalid-key";
  }

  if (message.includes("RESOURCE_EXHAUSTED")) {
    return "quota";
  }

  if (error?.status === 429) {
    return "rate-limit";
  }

  return "unknown";
}

function normalizeMimeType(value) {
  const mimeType = typeof value === "string" ? value.trim() : "";
  return mimeType || DEFAULT_AUDIO_MIME_TYPE;
}

function getAudioExtension(mimeType) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("aac")) return "aac";
  return "webm";
}

function getTextFromGeminiResult(result) {
  if (typeof result?.text === "string") {
    return result.text;
  }

  return (result?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => (typeof part?.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

async function createFileFromBase64(audioData, mimeType) {
  const cleanAudioData = audioData.includes(",")
    ? audioData.split(",").pop()
    : audioData;
  const estimatedBytes = estimateBase64Bytes(cleanAudioData);

  if (estimatedBytes <= 0) {
    throw transcriptionPayloadError("Audio data is empty");
  }

  if (estimatedBytes > MAX_UPLOAD_BYTES) {
    throw transcriptionPayloadError(
      "Audio file is too large. Try a shorter recording.",
      413,
    );
  }

  const buffer = Buffer.from(cleanAudioData, "base64");
  const extension = getAudioExtension(mimeType);

  return new File([buffer], `recording-${Date.now()}.${extension}`, {
    type: mimeType,
  });
}

async function parseJsonBodyPayload(body) {
  const { prompt, audioData, mimeType } = body || {};

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw transcriptionPayloadError("Invalid transcription prompt");
  }
  const boundedPrompt = prompt.slice(0, MAX_PROMPT_CHARS);

  if (!audioData || typeof audioData !== "string" || !audioData.trim()) {
    return {
      prompt: boundedPrompt,
      file: null,
      mimeType: null,
      source: "json-text",
    };
  }

  const normalizedMimeType = normalizeMimeType(mimeType);
  const file = await createFileFromBase64(audioData, normalizedMimeType);

  return {
    prompt: boundedPrompt,
    file,
    mimeType: normalizedMimeType,
    source: "json-base64",
  };
}

async function readMultipartPayload(request) {
  const formData = await request.formData();
  const prompt = (formData.get("prompt")?.toString() || "").slice(
    0,
    MAX_PROMPT_CHARS,
  );
  const file = formData.get("audio_file");

  if (!prompt.trim()) {
    throw transcriptionPayloadError("Invalid transcription prompt");
  }

  if (
    !file ||
    typeof file === "string" ||
    typeof file.arrayBuffer !== "function"
  ) {
    throw transcriptionPayloadError("Invalid transcription audio");
  }

  if (typeof file.size === "number" && file.size <= 0) {
    throw transcriptionPayloadError("Audio data is empty");
  }

  if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
    throw transcriptionPayloadError(
      "Audio file is too large. Try a shorter recording.",
      413,
    );
  }

  return {
    prompt,
    file,
    mimeType: normalizeMimeType(file.type || formData.get("mime_type")),
    source: "multipart",
  };
}

async function readTranscriptionPayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    return readMultipartPayload(request);
  }

  throw transcriptionPayloadError("Unsupported transcription payload", 415);
}

// The Files API costs an upload AND a delete round trip on top of the generate
// - measured 2026-08-23, that is ~3.5s of the ~5s a user actually waits, while
// the model itself answers in ~1.6s. Recordings are capped at a minute (a few
// hundred KB), so they fit inline with room to spare and cost ONE round trip.
// The upload path stays for anything genuinely large.
const INLINE_LIMIT_BYTES = 6 * 1024 * 1024;

async function transcribeInline({ prompt, file, mimeType, source }) {
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  console.log(
    `[API /gemini] Inline ${file.size || "unknown"} bytes from ${source} as ${mimeType}`,
  );

  const result = await withRetry(() =>
    getGeminiClient().models.generateContent({
      model: env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
      contents: [
        { parts: [{ text: prompt }, { inlineData: { mimeType, data } }] },
      ],
      config: GENERATION_CONFIG,
    }),
  );

  return getTextFromGeminiResult(result);
}

async function transcribeWithGemini({ prompt, file, mimeType, source }) {
  if (!file) {
    const result = await withRetry(() =>
      getGeminiClient().models.generateContent({
        model: env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
        contents: [{ parts: [{ text: prompt }] }],
        config: GENERATION_CONFIG,
      }),
    );
    return getTextFromGeminiResult(result);
  }

  if (typeof file.size === "number" && file.size <= INLINE_LIMIT_BYTES) {
    return transcribeInline({ prompt, file, mimeType, source });
  }

  let uploadedFileName = null;

  try {
    const uploadResult = await getGeminiClient().files.upload({
      file,
      config: {
        mimeType,
        displayName: file.name || `ziplist-recording-${Date.now()}`,
      },
    });

    if (!uploadResult?.uri) {
      throw new Error("File upload to Gemini failed");
    }

    uploadedFileName = uploadResult?.name ?? uploadResult?.file?.name ?? null;

    console.log(
      `[API /gemini] Uploaded ${file.size || "unknown"} bytes from ${source} as ${
        uploadResult.mimeType || mimeType
      }`,
    );

    const result = await withRetry(() =>
      getGeminiClient().models.generateContent({
        model: env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
        contents: [
          {
            parts: [
              { text: prompt },
              {
                fileData: {
                  mimeType: uploadResult.mimeType || mimeType,
                  fileUri: uploadResult.uri,
                },
              },
            ],
          },
        ],
        config: GENERATION_CONFIG,
      }),
    );

    return getTextFromGeminiResult(result);
  } finally {
    if (uploadedFileName) {
      try {
        await getGeminiClient().files.delete(uploadedFileName);
      } catch (cleanupError) {
        console.warn(
          "[API /gemini] Failed to delete Gemini file",
          uploadedFileName,
          cleanupError,
        );
      }
    }
  }
}

// ── Smart order ───────────────────────────────────────────────────────────

async function orderItems(items) {
  const client = getGeminiClient();
  const prompt = `Put these checklist items in a sensible working order.
Rules:
- Return every id exactly once, no additions, no removals, no rewrites.
- Group things that belong together and put what blocks other work first.
- There is no single right answer; choose the order a calm person would work through.
Items:
${items.map((item) => `id=${item.id} :: ${item.text}`).join("\n")}`;

  const response = await client.models.generateContent({
    model: env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      ...GENERATION_CONFIG,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          order: { type: "array", items: { type: "string" } },
        },
        required: ["order"],
      },
    },
  });

  const raw = response?.text ?? "";
  const parsed = JSON.parse(raw);
  return parsed?.order ?? null;
}

export async function POST(event) {
  try {
    const rateLimitResponse = await enforceRateLimit(event);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!env.GEMINI_API_KEY) {
      return json(
        { error: "Transcription needs server setup before it can run here." },
        { status: 500 },
      );
    }

    if (!isOriginAllowed(event.request, event.url?.origin)) {
      return json({ error: "Request origin is not allowed" }, { status: 403 });
    }

    const contentType = event.request.headers.get("content-type") || "";
    let payload = null;

    if (contentType.includes("application/json")) {
      const body = await event.request.json().catch(() => null);
      if (body?.task === "order") {
        const items = (Array.isArray(body.items) ? body.items : [])
          .filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.text === "string",
          )
          .slice(0, 120)
          .map((item) => ({
            id: item.id.slice(0, 128),
            text: item.text.slice(0, 240),
          }));
        if (items.length < 2) {
          return json({ order: items.map((item) => item.id) });
        }

        const requested = await orderItems(items);
        const order = validateOrder(
          requested,
          items.map((item) => item.id),
        );
        if (!order) {
          return json({ order: items.map((item) => item.id), ignored: true });
        }
        return json({ order });
      }

      if (typeof body?.prompt === "string") {
        payload = await parseJsonBodyPayload(body);
      } else {
        return json({ error: "Unknown task" }, { status: 400 });
      }
    } else {
      payload = await readTranscriptionPayload(event.request);
    }

    let text;
    try {
      text = await transcribeWithGemini(payload);
    } catch (error) {
      if (getGeminiErrorKind(error) !== "quota") throw error;
      const rescued = await transcribeWithOpenRouter(payload);
      if (!rescued) throw error;
      console.warn(
        "[API /gemini] Primary quota depleted - served via fallback",
      );
      text = rescued;
    }

    return json({ text });
  } catch (error) {
    console.error("Error in transcription API route:", error);
    const geminiErrorKind = getGeminiErrorKind(error);

    if (error?.transcriptionPayloadError) {
      const message =
        error?.status === 413
          ? "Audio file is too large. Try a shorter recording."
          : "That take needs one more pass. Try recording again.";

      return json({ error: message }, { status: error?.status || 400 });
    }

    if (geminiErrorKind === "invalid-key") {
      return json(
        { error: "Transcription needs server setup before it can run here." },
        { status: 500 },
      );
    }

    if (geminiErrorKind === "quota") {
      return json(
        { error: "Voice list is resting right now. Try again shortly." },
        { status: 503 },
      );
    }

    if (geminiErrorKind === "rate-limit") {
      return json(
        { error: "Voice list is busy right now. Give it a moment." },
        { status: 429 },
      );
    }

    return json(
      { error: "That pass didn't come through. Give it one more try." },
      { status: error?.status === 400 ? 502 : error?.status || 500 },
    );
  }
}
