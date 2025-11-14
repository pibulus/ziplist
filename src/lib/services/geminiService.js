import { promptManager } from "./promptManager";
import { parseModelResponse } from "./responseParser";

const API_ENDPOINT = "/api/transcribe";
const API_TIMEOUT_MS = 30000;

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function callTranscriptionApi({
  audioData,
  mimeType,
  prompt,
  promptStyle,
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audioData,
        mimeType,
        prompt,
        promptStyle,
      }),
      signal: controller.signal,
      keepalive: true,
    });

    clearTimeout(timeoutId);

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || "Transcription failed");
    }

    return payload?.transcription || "";
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("Transcription timed out (30s). Try again?");
    }

    throw error;
  }
}

export const geminiService = {
  // Client no longer initializes Gemini directly, but keep API for backward compatibility
  preloadModel: () => Promise.resolve(),

  getPromptStyle: promptManager.getCurrentStyle,
  setPromptStyle: promptManager.setStyle,
  getAvailableStyles: promptManager.getAvailableStyles,
  subscribeToStyleChanges: promptManager.subscribe,

  async transcribeAudio(audioBlob) {
    if (!(audioBlob instanceof Blob)) {
      throw new Error("Invalid audio data provided");
    }

    try {
      if (import.meta.env.DEV) {
        console.log("🎤 Transcribing audio via /api/transcribe");
      }

      const promptStyle = promptManager.getCurrentStyle();
      const prompt = promptManager.getPrompt("transcribeAudio");
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = audioBlob.type || "audio/webm";

      const transcription = await callTranscriptionApi({
        audioData: base64Audio,
        mimeType,
        prompt,
        promptStyle,
      });

      if (import.meta.env.DEV) {
        console.log("Raw response from Gemini:", transcription);
      }

      const parsedResponse = parseModelResponse(transcription);

      if (parsedResponse.success && parsedResponse.items.length > 0) {
        return parsedResponse.items.join("\n");
      }

      console.warn(
        "Unable to extract structured items from response, returning raw text",
      );
      return transcription;
    } catch (error) {
      console.error("❌ Error transcribing audio:", error);
      throw error;
    }
  },
};
