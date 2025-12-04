import { writable, derived, get } from "svelte/store";
import { AudioStates } from "../audio/audioStates";
import { ANIMATION } from "$lib/constants";
import { ghostStateStore } from "$lib/components/ghost/stores/ghostStateStore.js";

// Core audio state store
export const audioState = writable({
  state: AudioStates.IDLE,
  error: null,
  previousState: null,
  timestamp: Date.now(),
  mimeType: null,
  waveformData: [],
});

// Recording state
export const recordingState = writable({
  isRecording: false,
  duration: 0,
  audioBlob: null,
  audioURL: null,
});

// Transcription state
export const transcriptionState = writable({
  inProgress: false,
  progress: 0,
  text: "", // Stores the raw, full transcript
  parsedItems: [], // Stores items extracted by ListParser
  parsedCommands: [], // Stores commands extracted by ListParser
  error: null,
  timestamp: null,
});

// UI state
export const uiState = writable({
  clipboardSuccess: false,
  errorMessage: "",
  showPermissionError: false,
  transcriptionCopied: false,
  screenReaderMessage: "",
});

// User options
export const userPreferences = writable({
  isPremiumUser: false,
  promptStyle: "standard",
});

// Derived stores for easier consumption
export const isRecording = derived(
  audioState,
  ($audioState) => $audioState.state === AudioStates.RECORDING,
);

export const isTranscribing = derived(
  transcriptionState,
  ($state) => $state.inProgress,
);

export const transcriptionProgress = derived(
  transcriptionState,
  ($state) => $state.progress,
);

export const transcriptionText = derived(
  transcriptionState,
  ($state) => $state.text,
);

export const parsedListItems = derived(
  transcriptionState,
  ($state) => $state.parsedItems || [],
);

export const parsedListCommands = derived(
  transcriptionState,
  ($state) => $state.parsedCommands || [],
);

export const hasPermissionError = derived(
  audioState,
  ($state) => $state.state === AudioStates.PERMISSION_DENIED,
);

export const recordingDuration = derived(
  recordingState,
  ($state) => $state.duration,
);

export const errorMessage = derived(uiState, ($state) => $state.errorMessage);

export const waveformData = derived(
  audioState,
  ($state) => $state.waveformData || [],
);

// Action functions to update the stores
export const audioActions = {
  updateState(state, error = null) {
    audioState.update((current) => ({
      ...current,
      previousState: current.state,
      state,
      error,
      timestamp: Date.now(),
    }));

    // Update recording state when audio state changes
    if (state === AudioStates.RECORDING) {
      recordingState.update((current) => ({ ...current, isRecording: true }));
      this.startRecordingTimer();
    } else if (state !== AudioStates.RECORDING) {
      recordingState.update((current) => ({ ...current, isRecording: false }));
      this.stopRecordingTimer();
    }
  },

  setWaveformData(dataArray) {
    audioState.update((current) => ({
      ...current,
      waveformData: dataArray,
    }));
  },

  setAudioBlob(blob, mimeType) {
    recordingState.update((current) => ({
      ...current,
      audioBlob: blob,
    }));

    if (mimeType) {
      audioState.update((current) => ({
        ...current,
        mimeType,
      }));
    }
  },

  // Timer management for recording duration
  recordingTimer: null,
  startTime: null,

  startRecordingTimer() {
    this.stopRecordingTimer();
    this.startTime = Date.now();
    recordingState.update((current) => ({ ...current, duration: 0 }));

    this.recordingTimer = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      // Use float for more precise duration - will appear smoother in UI
      const duration = elapsed / 1000;

      recordingState.update((current) => ({
        ...current,
        duration,
      }));

      // Check if we've reached the time limit (still use integer for the limit check)
      const isPremium = get(userPreferences).isPremiumUser;
      const timeLimit = isPremium
        ? ANIMATION.RECORDING.PREMIUM_LIMIT
        : ANIMATION.RECORDING.FREE_LIMIT;

      if (Math.floor(duration) >= timeLimit) {
        // Signal that recording should stop due to time limit
        this.recordingTimeLimitReached();
      }
    }, 50); // Update 20 times per second for ultra-smooth animation
  },

  stopRecordingTimer() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  },

  recordingTimeLimitReached() {
    // This function can be subscribed to for stopping recording
    audioState.update((current) => ({
      ...current,
      timeLimit: true,
    }));

    // For reliable auto-stop, we also immediately update the recording state
    // so that subscribers can react to it

  },
};

export const transcriptionActions = {
  startTranscribing() {
    transcriptionState.update((current) => ({
      ...current,
      inProgress: true,
      progress: 0,
      error: null,
      timestamp: Date.now(),
    }));
  },

  updateProgress(progress) {
    transcriptionState.update((current) => ({
      ...current,
      progress: Math.min(progress, 100),
    }));
  },

  completeTranscription(data) {
    // data is expected to be { rawText, items, commands }
    transcriptionState.update((current) => ({
      ...current,
      inProgress: false,
      progress: 100,
      text: data.rawText,
      parsedItems: data.items || [],
      parsedCommands: data.commands || [],
      error: null, // Clear any previous error on successful completion
      timestamp: Date.now(),
    }));

    // Trigger ghost feedback for relevant commands
    const hasAddItemCommand =
      data.commands && data.commands.some((cmd) => cmd.command === "ADD_ITEM");
    const hasClearListCommand =
      data.commands &&
      data.commands.some((cmd) => cmd.command === "CLEAR_LIST");
    const hasItems = data.items && data.items.length > 0;

    if ((hasAddItemCommand && hasItems) || hasClearListCommand) {
      ghostStateStore.triggerReaction();
    }
  },

  setTranscriptionError(error) {
    transcriptionState.update((current) => ({
      ...current,
      inProgress: false,
      error,
    }));

    uiState.update((current) => ({
      ...current,
      errorMessage: `Transcription error: ${error || "Unknown error"}`,
    }));
  },
};

export const uiActions = {
  setErrorMessage(message) {
    uiState.update((current) => ({
      ...current,
      errorMessage: message,
    }));
  },

  clearErrorMessage() {
    uiState.update((current) => ({
      ...current,
      errorMessage: "",
    }));
  },

  setPermissionError(show) {
    uiState.update((current) => ({
      ...current,
      showPermissionError: show,
    }));
  },

  showClipboardSuccess(duration = ANIMATION.COPY.SUCCESS_TIMER) {
    uiState.update((current) => ({
      ...current,
      clipboardSuccess: true,
      transcriptionCopied: true,
    }));

    setTimeout(() => {
      uiState.update((current) => ({
        ...current,
        clipboardSuccess: false,
      }));
    }, duration);
  },

  setScreenReaderMessage(message) {
    uiState.update((current) => ({
      ...current,
      screenReaderMessage: message,
    }));
  },
};

// Reset function for when component unmounts
export function resetStores() {
  audioState.set({
    state: AudioStates.IDLE,
    error: null,
    previousState: null,
    timestamp: Date.now(),
    mimeType: null,
    waveformData: [],
  });

  recordingState.set({
    isRecording: false,
    duration: 0,
    audioBlob: null,
    audioURL: null,
  });

  transcriptionState.set({
    inProgress: false,
    progress: 0,
    text: "",
    parsedItems: [],
    parsedCommands: [],
    error: null,
    timestamp: null,
  });

  uiState.set({
    clipboardSuccess: false,
    errorMessage: "",
    showPermissionError: false,
    transcriptionCopied: false,
    screenReaderMessage: "",
  });

  audioActions.stopRecordingTimer();
}

// New event store for transcription completion
export const transcriptionCompletedEvent = (() => {
  const { subscribe, set } = writable(null); // Event store, emits text on completion then null
  let _previousInProgress = get(transcriptionState).inProgress; // Initialize with current state

  transcriptionState.subscribe((currentState) => {
    if (
      _previousInProgress === true &&
      currentState.inProgress === false &&
      currentState.text &&
      currentState.text.trim() !== ""
    ) {
      // Condition: Was transcribing, now finished, and there's actual text.
      console.log(
        "[Store DEBUG] transcriptionCompletedEvent: Firing with text -",
        currentState.text
      );
      set(currentState.text); // Emit the text value
      // Reset to null in a microtask to ensure current subscribers process the text value first
      // and to make it a true "event" store for the next completion.
      Promise.resolve().then(() => set(null));
    }
    _previousInProgress = currentState.inProgress;
  });

  return { subscribe };
})();
