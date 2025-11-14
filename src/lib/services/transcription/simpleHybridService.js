import { geminiService } from "../geminiService";
import { STORAGE_KEYS } from "$lib/constants";

class SimpleHybridService {
  constructor() {
    this.geminiQueue = Promise.resolve();
  }

  async transcribeAudio(audioBlob) {
    console.log("☁️ Using Gemini API for transcription");
    this.#recordMethod("gemini");
    return await this.transcribeWithGemini(audioBlob);
  }

  async transcribeWithGemini(audioBlob) {
    this.geminiQueue = this.geminiQueue
      .catch(() => {})
      .then(() => this.#transcribeWithGeminiInternal(audioBlob));

    return this.geminiQueue;
  }

  async #transcribeWithGeminiInternal(audioBlob) {
    try {
      return await geminiService.transcribeAudio(audioBlob);
    } catch (error) {
      console.error("Gemini transcription error:", error);
      throw error;
    }
  }

  #recordMethod(method) {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEYS.LAST_TRANSCRIPTION_METHOD, method);
    } catch (error) {
      console.warn("Failed to record transcription method:", error);
    }
  }
}

export const simpleHybridService = new SimpleHybridService();
