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

  async transcribeAudio(audioBlob, existingItems = [], existingTags = []) {
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

      const existingTagsContext =
        existingTags && existingTags.length > 0
          ? `Existing tag vocabulary across user's lists: [${existingTags.map((t) => `#${t}`).join(", ")}]. Prefer reusing these tags for consistency.\n`
          : "";

      // Get the appropriate prompt based on current style
      const prompt = promptManager.getPrompt("transcribeAudio", {
        existingItemsContext,
        existingTagsContext,
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
          title: parsedResponse.title || "",
          structured: true,
          raw: parsedResponse.raw,
        };
      } else if (parsedResponse.structuredResponse) {
        // JSON-looking responses that fail parsing should not be reparsed as
        // plain commands/items; fail closed to avoid destructive commands.
        console.warn("Structured Gemini response could not be parsed");
        return { text: "", items: [], complete: [], structured: true };
      } else {
        // Fallback to raw text if parsing fails completely
        console.warn("Unable to extract structured items from response");
        return {
          text: responseText,
          items: [],
          complete: [],
          structured: false,
        };
      }
    } catch (error) {
      console.error("❌ Error transcribing audio:", error);
      throw new Error(
        error.message || "Failed to transcribe audio with Gemini",
      );
    }
  },

  async parseUnstructuredText(rawText, existingItems = [], existingTags = []) {
    try {
      if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
        return { items: [], title: "", complete: [], structured: false };
      }

      const existingItemsContext =
        existingItems.length > 0
          ? `The current list has these unchecked items:\n${existingItems.map((t) => `- ${t}`).join("\n")}\n`
          : "The current list is empty.";

      const existingTagsContext =
        existingTags && existingTags.length > 0
          ? `Existing tag vocabulary across user's lists: [${existingTags.map((t) => `#${t}`).join(", ")}].
TAG COHERENCE RULES:
- Strongly PREFER REUSING these existing tags if an item fits (e.g. reuse #groceries instead of #supermarket or #grocery; reuse #music instead of #songs or #tunes).
- Only create a new tag if none of the existing tags apply.`
          : "";

      const prompt = `You are an expert list extraction AI. Analyze the following unstructured text (which could be a recipe, an email, a chat message, meeting notes, or a brain dump).
Extract all distinct, actionable checklist items. Clean them up to be concise, punchy list items.
If appropriate, append a relevant short hashtag (e.g. #produce, #dairy, #hardware, #urgent, #work) to each item.
If the text describes a coherent theme or recipe, provide a short, catchy title (max 4 words) in the "title" field.

${existingTagsContext}

Return a valid JSON object ONLY, with this schema:
{
  "title": "Short title for the list, or empty string",
  "items": ["Item 1 #tag", "Item 2 #tag"],
  "complete": []
}

Current list context:
${existingItemsContext}

Text to parse:
"""
${rawText}
"""`;

      const response = await geminiApiService.generateTextContent(prompt);
      const responseText = response.text();
      const parsedResponse = parseModelResponse(responseText);

      if (parsedResponse.success) {
        return {
          text: parsedResponse.items.join("\n"),
          items: parsedResponse.items,
          complete: parsedResponse.complete || [],
          title: parsedResponse.title || "",
          structured: true,
          raw: parsedResponse.raw,
        };
      }

      return {
        text: responseText,
        items: parsedResponse.items || [],
        complete: [],
        title: "",
        structured: false,
      };
    } catch (error) {
      console.error("❌ Error parsing unstructured text with Gemini:", error);
      throw new Error(error.message || "Failed to parse text with Gemini");
    }
  },
};
