import { geminiService as defaultGeminiService } from "$lib/services/geminiService";
import { simpleHybridService } from "./simpleHybridService";
import { listParser } from "../listParser.js"; // Import the listParser
import { listsService } from "../lists/listsService"; // Import the listsService
import { listsStore } from "../lists/listsStore";
import { get } from "svelte/store";
import {
  transcriptionState,
  transcriptionActions,
  uiActions,
} from "../infrastructure/stores";
import { COPY_MESSAGES, ATTRIBUTION, getRandomFromArray } from "$lib/constants";

export const TranscriptionEvents = {
  TRANSCRIPTION_STARTED: "transcription:started",
  TRANSCRIPTION_PROGRESS: "transcription:progress",
  TRANSCRIPTION_COMPLETED: "transcription:completed",
  TRANSCRIPTION_ERROR: "transcription:error",
  TRANSCRIPTION_COPIED: "transcription:copied",
  TRANSCRIPTION_SHARED: "transcription:shared",
};

export class TranscriptionService {
  constructor(dependencies = {}) {
    this.geminiService = dependencies.geminiService || defaultGeminiService;
    this.browser = typeof window !== "undefined";
    this.lastTranscriptionTimestamp = null;
  }

  async transcribeAudio(audioBlob) {
    try {
      if (!audioBlob || !(audioBlob instanceof Blob)) {
        throw new Error("Invalid audio data provided");
      }

      // Update transcription state to show in-progress
      transcriptionActions.startTranscribing();
      this.lastTranscriptionTimestamp = Date.now();

      // Start progress animation
      this.startProgressAnimation();

      // Collect unchecked items from the active list to give Gemini context
      const storeState = get(listsStore);
      const activeList = storeState.lists.find(
        (l) => l.id === storeState.activeListId,
      );
      const targetListId = activeList?.id || storeState.activeListId;
      const existingItems = activeList
        ? activeList.items
            .filter((item) => !item.checked)
            .map((item) => item.text)
        : [];

      // Transcribe using hybrid service (Whisper if ready, Gemini API as fallback)
      // Returns { text, items, complete } — items/complete may be empty for Whisper
      const transcriptResult = await simpleHybridService.transcribeAudio(
        audioBlob,
        existingItems,
      );
      const normalizedTranscript =
        typeof transcriptResult === "string"
          ? { text: transcriptResult, complete: [] }
          : transcriptResult || {};
      const transcriptText = normalizedTranscript.text || "";
      const aiComplete = normalizedTranscript.complete || [];
      const hasStructuredResult = normalizedTranscript.structured === true;
      const parsedResult = hasStructuredResult
        ? {
            items: Array.isArray(normalizedTranscript.items)
              ? normalizedTranscript.items
              : [],
            commands: [],
          }
        : listParser.parse(transcriptText);

      // Complete progress animation with smooth transition
      this.completeProgressAnimation();

      // Update transcription state with completed text and parsed data
      transcriptionActions.completeTranscription({
        rawText: transcriptText,
        items: parsedResult.items,
        commands: parsedResult.commands,
      });

      // Send parsed result to listsService — include AI-identified completions
      listsService.processTranscription({
        ...parsedResult,
        complete: aiComplete,
        existingItems,
        targetListId,
      });

      return { rawText: transcriptText, ...parsedResult, complete: aiComplete };
    } catch (error) {
      console.error("Transcription error:", error);

      // Update state to show error
      transcriptionActions.setTranscriptionError(
        error.message || "Unknown transcription error",
      );

      throw error;
    }
  }

  startProgressAnimation() {
    let progress = 0;
    const animate = () => {
      if (!get(transcriptionState).inProgress) return;

      progress = Math.min(95, progress + 1);

      // Update store with current progress
      transcriptionActions.updateProgress(progress);

      if (progress < 95) {
        setTimeout(animate, 50);
      }
    };

    // Start animation loop
    animate();
  }

  completeProgressAnimation() {
    let progress = 95;

    const complete = () => {
      progress = Math.min(100, progress + (100 - progress) * 0.2);

      // Update store with current progress
      transcriptionActions.updateProgress(progress);

      if (progress < 99.5) {
        requestAnimationFrame(complete);
      } else {
        transcriptionActions.updateProgress(100);
      }
    };

    // Start completion animation
    requestAnimationFrame(complete);
  }

  async copyToClipboard(text) {
    if (!text) {
      text = get(transcriptionState).text;
    }

    if (!text || text.trim() === "") {
      uiActions.setErrorMessage("No text available to copy");
      return false;
    }

    try {
      // Add attribution
      const textWithAttribution = `${text}\n\n${ATTRIBUTION.SIMPLE_TAG}`;

      // Try the modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textWithAttribution);
        uiActions.showClipboardSuccess();
        uiActions.setScreenReaderMessage("Transcript copied to clipboard");
        return true;
      }

      // Fallback: Use document.execCommand (legacy method)
      const textArea = document.createElement("textarea");
      textArea.value = textWithAttribution;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const success = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (success) {
        uiActions.showClipboardSuccess();
        uiActions.setScreenReaderMessage("Transcript copied to clipboard");
      } else {
        uiActions.setScreenReaderMessage(
          "Unable to copy. Please try clicking in the window first.",
        );
      }

      return success;
    } catch (error) {
      console.error("Clipboard copy error:", error);

      uiActions.setErrorMessage(
        `Copy failed: ${error.message || "Unknown error"}`,
      );
      uiActions.setScreenReaderMessage(
        "Unable to copy. Please try clicking in the window first.",
      );

      return false;
    }
  }

  async shareTranscript(text) {
    if (!text) {
      text = get(transcriptionState).text;
    }

    if (!text || text.trim() === "") {
      uiActions.setErrorMessage("No text available to share");
      return false;
    }

    try {
      // Check if Web Share API is available
      if (!navigator.share) {
        throw new Error("Web Share API not supported");
      }

      // Add attribution
      const textWithAttribution = `${text}${ATTRIBUTION.SHARE_POSTFIX}`;

      // Share using Web Share API
      await navigator.share({
        title: "ZipList Transcription",
        text: textWithAttribution,
      });

      uiActions.showClipboardSuccess();
      uiActions.setScreenReaderMessage("Transcript shared successfully");
      return true;
    } catch (error) {
      // Don't treat user cancellation as an error
      if (error.name === "AbortError") {
        return false;
      }

      console.error("Share error:", error);

      // Try fallback to clipboard if sharing fails
      if (error.message === "Web Share API not supported") {
        return this.copyToClipboard(text);
      }

      uiActions.setErrorMessage(
        `Share failed: ${error.message || "Unknown error"}`,
      );
      return false;
    }
  }

  isTranscribing() {
    return get(transcriptionState).inProgress;
  }

  getCurrentTranscript() {
    return get(transcriptionState).text;
  }

  clearTranscript() {
    // Pass an empty structure to clear all relevant fields in the store
    transcriptionActions.completeTranscription({
      rawText: "",
      items: [],
      commands: [],
    });
  }

  getRandomCopyMessage() {
    return getRandomFromArray(COPY_MESSAGES);
  }

  isShareSupported() {
    return (
      this.browser &&
      typeof navigator !== "undefined" &&
      navigator.share &&
      typeof navigator.share === "function"
    );
  }
}

export const transcriptionService = new TranscriptionService();
