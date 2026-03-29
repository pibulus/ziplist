/**
 * No-op preload. The Gemini model runs server-side and is initialized lazily
 * on first request. This function exists for API compatibility.
 */
function preloadModel() {
  return Promise.resolve();
}

function blobToGenerativePart(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.split(",")[1];
      resolve({
        inlineData: {
          data: base64data,
          mimeType: blob.type,
        },
      });
    };
    reader.onerror = () => reject(new Error('Failed to read audio data'));
    reader.onabort = () => reject(new Error('Audio read was aborted'));
    reader.readAsDataURL(blob);
  });
}

/** @type {number} API timeout in milliseconds (default 30s) */
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10);

async function generateContent(promptData) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    // promptData is [prompt, audioPart]
    // audioPart is { inlineData: { data: ..., mimeType: ... } }

    const prompt = promptData[0];
    const audioPart = promptData[1];

    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: prompt,
            audioData: audioPart.inlineData.data,
            mimeType: audioPart.inlineData.mimeType
        }),
        signal: controller.signal
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch from API');
    }

    const data = await response.json();

    // Mocking the response object structure expected by the caller
    return {
        text: () => data.text
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error("Transcription timed out. Check your connection and try again.");
    }
    console.error("❌ Error generating content:", error);
    throw new Error("Failed to generate content with Gemini");
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
