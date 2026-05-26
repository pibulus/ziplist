import { geminiApiService } from "./geminiApiService";
import { promptManager } from "./promptManager";
import { parseModelResponse } from "./responseParser";

// Export the original preloadModel function for backward compatibility
const preloadModel = geminiApiService.preloadModel;

// The main public geminiService object
export const geminiService = {
  // Expose the preload function for hover-based preloading
  preloadModel,

  // Get/set prompt style functions
  getPromptStyle: promptManager.getCurrentStyle,
  setPromptStyle: promptManager.setStyle,
  getAvailableStyles: promptManager.getAvailableStyles,
  subscribeToStyleChanges: promptManager.subscribe,

  async transcribeAudio(audioBlob, existingItems = []) {
    try {
      if (import.meta.env.DEV) {
        console.log("🎤 Transcribing audio with Gemini");
      }

      // Ensure model is preloaded if possible
      const { initialized } = geminiApiService.getModelStatus();
      if (!initialized) {
        try {
          if (import.meta.env.DEV) {
            console.log("🔍 Preloading model before transcription");
          }
          await preloadModel();
        } catch (err) {
          if (import.meta.env.DEV) {
            console.log(
              "⚠️ Preloading failed, continuing with transcription:",
              err,
            );
          }
        }
      }

      // Build context block for existing unchecked items
      const existingItemsContext =
        existingItems.length > 0
          ? `The current list has these unchecked items:\n${existingItems.map((t) => `- ${t}`).join("\n")}\n`
          : "The current list is empty.";

      // Get the appropriate prompt based on current style
      const prompt = promptManager.getPrompt("transcribeAudio", {
        existingItemsContext,
      });

      // Convert audio to format Gemini can use
      const audioPart = await geminiApiService.blobToGenerativePart(audioBlob);

      // Generate content with both prompt and audio data
      const response = await geminiApiService.generateContent([
        prompt,
        audioPart,
      ]);

      if (import.meta.env.DEV) {
        console.log("✅ Audio transcription complete");
      }

      // Get the raw response text
      const responseText = response.text();

      if (import.meta.env.DEV) {
        console.log("Raw response from Gemini:", responseText);
      }

      // Use our robust parser to handle various response formats
      const parsedResponse = parseModelResponse(responseText);

      if (import.meta.env.DEV) {
        console.log("Parsed response:", parsedResponse);
      }

      if (parsedResponse.success) {
        // Return structured result so callers can access both items and completions
        return {
          text: parsedResponse.items.join("\n"),
          items: parsedResponse.items,
          complete: parsedResponse.complete || [],
        };
      } else {
        // Fallback to raw text if parsing fails completely
        console.warn("Unable to extract structured items from response");
        return { text: responseText, items: [], complete: [] };
      }
    } catch (error) {
      console.error("❌ Error transcribing audio:", error);
      throw new Error(
        error.message || "Failed to transcribe audio with Gemini",
      );
    }
  },
};
