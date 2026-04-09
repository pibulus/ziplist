import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import { enforceRateLimit } from "$lib/server/rateLimiter";

let genAI = null;
let model = null;

const MAX_UPLOAD_BYTES = Number(env.MAX_UPLOAD_BYTES ?? "15728640");

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

function getModel() {
  if (!model) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL ?? "gemini-2.0-flash",
    });
  }
  return model;
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

    const { request } = event;
    const { prompt, audioData, mimeType } = await request.json();
    if (
      typeof prompt !== "string" ||
      typeof audioData !== "string" ||
      typeof mimeType !== "string" ||
      !prompt.trim() ||
      !audioData.trim() ||
      !mimeType.trim()
    ) {
      return json({ error: "Invalid transcription payload" }, { status: 400 });
    }

    if (estimateBase64Bytes(audioData) > MAX_UPLOAD_BYTES) {
      return json(
        { error: "Audio file is too large. Try a shorter recording." },
        { status: 413 },
      );
    }

    const result = await getModel().generateContent([
      prompt,
      {
        inlineData: {
          data: audioData,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    return json({ text });
  } catch (error) {
    console.error("Error in Gemini API route:", error);
    const message =
      error?.status === 429
        ? "Gemini is busy right now. Try again in a moment."
        : "Transcription failed. Please try again.";

    return json({ error: message }, { status: error?.status || 500 });
  }
}
