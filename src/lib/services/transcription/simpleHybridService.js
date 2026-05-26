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

  getLocalFlag(key) {
    if (!browser) return null;
    return localStorage.getItem(key);
  }

  setLocalFlag(key, value) {
    if (!browser) return;
    localStorage.setItem(key, value);
  }

  shouldLoadWhisperInBackground() {
    if (!browser) return false;

    const connection = navigator.connection;
    if (connection?.saveData) return false;

    const effectiveType = connection?.effectiveType;
    if (effectiveType === "slow-2g" || effectiveType === "2g") {
      return false;
    }

    const deviceMemory = navigator.deviceMemory;
    if (deviceMemory && deviceMemory < 4) {
      return false;
    }

    return true;
  }

  /**
   * Start loading Whisper in the background
   */
  async startBackgroundLoad({ force = false } = {}) {
    if (this.whisperLoadPromise || this.whisperReady) {
      return; // Already loading or loaded
    }

    if (!force && !this.shouldLoadWhisperInBackground()) {
      return { success: false, skipped: true };
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
  async transcribeAudio(audioBlob, existingItems = []) {
    // Check privacy mode preference
    const privacyMode = this.getLocalFlag("ziplist_privacy_mode") === "true";

    if (privacyMode) {
      await this.startBackgroundLoad({ force: true });
    } else {
      this.startBackgroundLoad();
    }

    // If privacy mode is on, wait for Whisper or fail
    // Whisper returns plain text so wrap in consistent shape
    if (privacyMode) {
      if (this.whisperReady && whisperService) {
        this.setLocalFlag("last_transcription_method", "whisper");
        const text = await whisperService.transcribeAudio(audioBlob);
        return { text, items: [], complete: [] };
      } else if (this.whisperLoadPromise) {
        const result = await this.whisperLoadPromise;
        if (result.success && whisperService) {
          this.setLocalFlag("last_transcription_method", "whisper");
          const text = await whisperService.transcribeAudio(audioBlob);
          return { text, items: [], complete: [] };
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
      this.setLocalFlag("last_transcription_method", "whisper");
      const text = await whisperService.transcribeAudio(audioBlob);
      return { text, items: [], complete: [] };
    }

    // Otherwise use Gemini API for instant results (passes context for completion detection)
    this.setLocalFlag("last_transcription_method", "gemini");
    return await this.transcribeWithGemini(audioBlob, existingItems);
  }

  /**
   * Transcribe using Gemini service (ZipList's direct integration)
   */
  async transcribeWithGemini(audioBlob, existingItems = []) {
    try {
      const transcription = await geminiService.transcribeAudio(audioBlob, existingItems);
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
