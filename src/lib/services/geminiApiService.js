// Track model initialization state (conceptually, for the server)
let modelInitialized = false;
let initializationPromise = null;

// Function to preload/initialize the model for faster response
function preloadModel() {
  // Only initialize once
  if (modelInitialized || initializationPromise) {
    return initializationPromise;
  }

  if (import.meta.env.DEV) {

  }

  // We create a very small "ping" query to initialize the model
  // This warms up the Gemini API connection and loads necessary client-side resources
  // For the server-side implementation, we'll just send a dummy request to the endpoint
  // Note: This might fail if we don't send valid data, but it wakes up the function.
  // Alternatively, we can just skip this or implement a specific 'warmup' param.
  // For now, let's just mark it as initialized to avoid blocking.
  
  modelInitialized = true;
  return Promise.resolve();
}

function blobToGenerativePart(blob) {
  return new Promise((resolve) => {
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
    reader.readAsDataURL(blob);
  });
}

async function generateContent(promptData) {
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
        })
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
    console.error("❌ Error generating content:", error);
    throw new Error("Failed to generate content with Gemini");
  }
}

export const geminiApiService = {
  preloadModel,
  blobToGenerativePart,
  generateContent,

  // Method to get model status
  getModelStatus() {
    return {
      initialized: modelInitialized,
      initializing: !!initializationPromise && !modelInitialized,
    };
  },
};
