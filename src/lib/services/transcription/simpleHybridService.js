/**
 * Simple Hybrid Transcription Service
 * Uses Gemini API for instant results while Whisper loads in background
 */

import { geminiService } from "../geminiService";
import { browser } from "$app/environment";

// Lazy-loaded whisper modules — avoids bundling @xenova/transformers in main chunk
let whisperService = null;
let whisperStatus = null;

async function loadWhisper() {
  if (!whisperService) {
    const mod = await import("./whisper/whisperService");
    whisperService = mod.whisperService;
    whisperStatus = mod.whisperStatus;
  }
  return { whisperService, whisperStatus };
}

class SimpleHybridService {
  constructor() {
    this.whisperReady = false;
    this.whisperLoadPromise = null;
    this._statusUnsubscribe = null;
  }

  /**
   * Start loading Whisper in the background
   */
  async startBackgroundLoad() {
    if (this.whisperLoadPromise || this.whisperReady) {
      return; // Already loading or loaded
    }

    try {
      const { whisperService: ws, whisperStatus: status } = await loadWhisper();

      // Subscribe to whisper status once loaded
      if (browser && !this._statusUnsubscribe) {
        this._statusUnsubscribe = status.subscribe((s) => {
          this.whisperReady = s.isLoaded;
        });
      }

      this.whisperLoadPromise = ws
        .preloadModel()
        .then((result) => {
          if (result.success) {
            console.log("Whisper model ready for offline use");
          }
          return result;
        })
        .catch((err) => {
          console.warn("Whisper load failed, will continue with API:", err);
          return { success: false, error: err };
        });
    } catch (err) {
      console.warn("Failed to load whisper module:", err);
      this.whisperLoadPromise = Promise.resolve({ success: false, error: err });
    }
  }

  /**
   * Transcribe audio using best available method
   */
  async transcribeAudio(audioBlob) {
    // Check privacy mode preference
    const privacyMode = localStorage.getItem("ziplist_privacy_mode") === "true";

    // Start loading Whisper in background if not already
    this.startBackgroundLoad();

    // If privacy mode is on, wait for Whisper or fail
    if (privacyMode) {
      if (this.whisperReady && whisperService) {
        localStorage.setItem("last_transcription_method", "whisper");
        return await whisperService.transcribeAudio(audioBlob);
      } else if (this.whisperLoadPromise) {
        const result = await this.whisperLoadPromise;
        if (result.success && whisperService) {
          localStorage.setItem("last_transcription_method", "whisper");
          return await whisperService.transcribeAudio(audioBlob);
        }
        throw new Error(
          "Privacy mode enabled but offline model failed to load",
        );
      } else {
        throw new Error("Privacy mode enabled but offline model not available");
      }
    }

    // Normal mode: If Whisper is ready, use it (offline, fast, free)
    if (this.whisperReady && whisperService) {
      localStorage.setItem("last_transcription_method", "whisper");
      return await whisperService.transcribeAudio(audioBlob);
    }

    // Otherwise use Gemini API for instant results
    localStorage.setItem("last_transcription_method", "gemini");
    return await this.transcribeWithGemini(audioBlob);
  }

  /**
   * Transcribe using Gemini service (ZipList's direct integration)
   */
  async transcribeWithGemini(audioBlob) {
    try {
      const transcription = await geminiService.transcribeAudio(audioBlob);
      return transcription;
    } catch (error) {
      console.error("Gemini transcription error:", error);

      // If Gemini fails and Whisper is still loading, wait for it
      if (this.whisperLoadPromise && !this.whisperReady) {
        const result = await this.whisperLoadPromise;
        if (result.success && whisperService) {
          return await whisperService.transcribeAudio(audioBlob);
        }
      }

      throw error;
    }
  }

  /**
   * Check current status
   */
  getStatus() {
    return {
      whisperReady: this.whisperReady,
      usingAPI: !this.whisperReady,
      method: this.whisperReady ? "Offline (Whisper)" : "Online (Gemini API)",
    };
  }
}

// Export singleton instance
export const simpleHybridService = new SimpleHybridService();
