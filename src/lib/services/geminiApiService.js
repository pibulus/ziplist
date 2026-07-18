/**
 * No-op preload. The Gemini model runs server-side and is initialized lazily
 * on first request. This function exists for API compatibility.
 */
function preloadModel() {
  return Promise.resolve();
}

const DEFAULT_AUDIO_MIME_TYPE = "audio/webm";

function getSafeMimeType(blob) {
  return typeof blob?.type === "string" && blob.type.trim()
    ? blob.type.trim()
    : DEFAULT_AUDIO_MIME_TYPE;
}

function getAudioExtension(mimeType) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("aac")) return "aac";
  return "webm";
}

function getAudioFileName(mimeType) {
  return `ziplist-recording-${Date.now()}.${getAudioExtension(mimeType)}`;
}

function blobToGenerativePart(blob) {
  if (!(blob instanceof Blob) || blob.size <= 0) {
    return Promise.reject(new Error("Invalid audio data"));
  }

  // Blink-tap floor (family pattern): a sub-1KB blob is a container header
  // with no real speech — bail kindly before burning the Gemini round-trip.
  if (blob.size < 1000) {
    return Promise.reject(
      new Error("That tap was a blink — speak a touch longer."),
    );
  }

  const mimeType = getSafeMimeType(blob);

  return Promise.resolve({
    audioFile: blob,
    mimeType,
  });
}

/** @type {number} API timeout in milliseconds (default 60s) */
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || "60000", 10);

async function generateContent(promptData) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const prompt = promptData[0];
    const audioPart = promptData[1];
    const audioFile = audioPart?.audioFile;
    const mimeType = audioPart?.mimeType || getSafeMimeType(audioFile);

    if (typeof prompt !== "string" || !prompt.trim()) {
      throw new Error("Missing transcription prompt");
    }

    if (!(audioFile instanceof Blob) || audioFile.size <= 0) {
      throw new Error("Invalid audio data");
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("mime_type", mimeType);
    formData.append(
      "audio_file",
      audioFile,
      audioFile.name || getAudioFileName(mimeType),
    );

    const response = await fetch("/api/gemini", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));

      // A 413 can come from the proxy/adapter layer (plain-text body) before
      // the route's own size check runs — still tell the user what happened.
      if (response.status === 413) {
        throw new Error(
          err.error || "That recording is too long to send. Try a shorter one.",
        );
      }

      throw new Error(err.error || "Failed to fetch from API");
    }

    const data = await response.json();

    // Mocking the response object structure expected by the caller
    return {
      text: () => data.text,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "Transcription timed out. Check your connection and try again.",
      );
    }
    console.error("❌ Error generating content:", error);
    throw new Error(error.message || "Failed to generate content with Gemini");
  } finally {
    clearTimeout(timeoutId);
  }
}

export const geminiApiService = {
  preloadModel,
  blobToGenerativePart,
  generateContent,

  /** @returns {{ initialized: boolean, initializing: boolean }} */
  getModelStatus() {
    return { initialized: true, initializing: false };
  },
};
