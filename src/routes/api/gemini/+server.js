import { GoogleGenAI } from "@google/genai";
import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import { enforceRateLimit } from "$lib/server/rateLimiter";

let genAI = null;
let genAIKey = "";

const MAX_UPLOAD_BYTES = Number(env.MAX_UPLOAD_BYTES ?? "15728640");
const DEFAULT_AUDIO_MIME_TYPE = "audio/webm";
const GENERATION_CONFIG = {
  temperature: 0.2,
  topP: 0.8,
  topK: 40,
  candidateCount: 1,
  maxOutputTokens: 8192,
};

function getAllowedOrigins() {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(request) {
  const allowedOrigins = getAllowedOrigins();
  if (!allowedOrigins.length) return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

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
    try { return await fn(); }
    catch (err) {
      const msg = String(err?.message || err);
      const transient = /\b(503|429|overload|UNAVAILABLE|RESOURCE_EXHAUSTED)\b/i.test(msg);
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

async function readJsonPayload(request) {
  const { prompt, audioData, mimeType } = await request.json();

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw transcriptionPayloadError("Invalid transcription prompt");
  }

  if (typeof audioData !== "string" || !audioData.trim()) {
    throw transcriptionPayloadError("Invalid transcription audio");
  }

  const normalizedMimeType = normalizeMimeType(mimeType);
  const file = await createFileFromBase64(audioData, normalizedMimeType);

  return {
    prompt,
    file,
    mimeType: normalizedMimeType,
    source: "json-base64",
  };
}

async function readMultipartPayload(request) {
  const formData = await request.formData();
  const prompt = formData.get("prompt")?.toString() || "";
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

  if (contentType.includes("application/json")) {
    return readJsonPayload(request);
  }

  throw transcriptionPayloadError("Unsupported transcription payload", 415);
}

async function transcribeWithGemini({ prompt, file, mimeType, source }) {
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

export async function POST(event) {
  try {
    const rateLimitResponse = enforceRateLimit(event);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
    }

    if (!isOriginAllowed(event.request)) {
      return json({ error: "Request origin is not allowed" }, { status: 403 });
    }

    const payload = await readTranscriptionPayload(event.request);
    const text = await transcribeWithGemini(payload);

    return json({ text });
  } catch (error) {
    console.error("Error in Gemini API route:", error);
    const geminiErrorKind = getGeminiErrorKind(error);

    if (error?.transcriptionPayloadError) {
      const message =
        error?.status === 413
          ? "Audio file is too large. Try a shorter recording."
          : "Hmm, the audio needs one more pass. Try recording again.";

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
        { error: "Transcription is out of server credits right now." },
        { status: 503 },
      );
    }

    if (geminiErrorKind === "rate-limit") {
      return json(
        { error: "Gemini is busy right now. Try again in a moment." },
        { status: 429 },
      );
    }

    return json(
      { error: "Transcription failed. Please try again." },
      { status: error?.status === 400 ? 502 : error?.status || 500 },
    );
  }
}
