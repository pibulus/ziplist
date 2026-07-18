import { AudioStateManager, AudioStates } from "./audioStates";
import { audioState, audioActions, uiActions } from "../infrastructure/stores";
import { wakeLockService } from "../pwa/wakeLockService";

// Speech doesn't need music bitrates. Browsers default MediaRecorder to
// ~128kbps, which blows through the server's request-body limit in ~30s of
// talking; 48kbps keeps transcription quality identical for voice while a
// couple of minutes of rambling stays comfortably uploadable. (Same value as
// the TalkType chassis.)
const SPEECH_AUDIO_BITS_PER_SECOND = 48000;

export const AudioEvents = {
  RECORDING_STARTED: "audio:recordingStarted",
  RECORDING_STOPPED: "audio:recordingStopped",
  RECORDING_ERROR: "audio:recordingError",
  STATE_CHANGED: "audio:stateChanged",
  WAVEFORM_DATA: "audio:waveformData",
};

export class AudioService {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioContext = null;
    this.isIOS =
      typeof window !== "undefined" &&
      /iPhone|iPad|iPod/.test(navigator.userAgent);
    this.stream = null;
    this.analyser = null;
    this.cleanupPromise = null;
    this.animationFrameId = null;
    this.visibilityChangeHandler = null;

    this.stateManager = new AudioStateManager();

    this.stateManager.addListener(({ newState, error }) => {
      // Update the store instead of emitting event
      audioActions.updateState(newState, error);
    });

    this.ensureVisibilityListener();
  }

  ensureVisibilityListener() {
    if (typeof document === "undefined" || this.visibilityChangeHandler) {
      return;
    }

    this.visibilityChangeHandler = () => {
      if (document.visibilityState !== "visible") return;

      this.initializeAudioContext().catch((error) => {
        console.warn(
          "Failed to resume audio context on visibility change:",
          error,
        );
      });

      if (this.stateManager.getState() === AudioStates.RECORDING) {
        void wakeLockService.request();
      }
    };

    document.addEventListener("visibilitychange", this.visibilityChangeHandler);
  }

  removeVisibilityListener() {
    if (typeof document === "undefined" || !this.visibilityChangeHandler) {
      return;
    }

    document.removeEventListener(
      "visibilitychange",
      this.visibilityChangeHandler,
    );
    this.visibilityChangeHandler = null;
  }

  async initializeAudioContext() {
    if (!this.audioContext && typeof window !== "undefined") {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
    }

    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }

    return this.audioContext?.state === "running";
  }

  async checkMediaDevices() {
    if (typeof window === "undefined") return false;
    if (!navigator?.mediaDevices?.getUserMedia) return false;
    return true;
  }

  async requestPermissions() {
    try {
      if (!(await this.checkMediaDevices())) {
        throw new Error("MediaDevices API not available");
      }

      if (this.isIOS) {
        const contextReady = await this.initializeAudioContext();
        if (!contextReady) {
          throw new Error("Failed to initialize audio context");
        }

        const constraints = {
          audio: {
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
          },
        };

        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream && stream.active) {
            return { granted: true, stream };
          } else {
            stream?.getTracks().forEach((track) => track.stop());
            return {
              granted: false,
              error: new Error("No active audio stream after permission"),
            };
          }
        } catch (iosSpecificError) {
          console.warn(
            "iOS specific constraints failed, trying fallback:",
            iosSpecificError.message,
          );
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          if (stream && stream.active) {
            return { granted: true, stream };
          } else {
            stream?.getTracks().forEach((track) => track.stop());
            return {
              granted: false,
              error: new Error(
                "No active audio stream after fallback permission",
              ),
            };
          }
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (stream && stream.active) {
          return { granted: true, stream };
        } else {
          stream?.getTracks().forEach((track) => track.stop());
          return {
            granted: false,
            error: new Error("No active audio stream after permission"),
          };
        }
      } catch (detailedConstraintError) {
        console.warn(
          "Detailed constraints failed, falling back to simple audio:",
          detailedConstraintError.message,
        );
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          if (stream && stream.active) {
            return { granted: true, stream };
          } else {
            stream?.getTracks().forEach((track) => track.stop());
            return {
              granted: false,
              error: new Error("No active audio stream after permission"),
            };
          }
        } catch (fallbackError) {
          return { granted: false, error: fallbackError };
        }
      }
    } catch (error) {
      console.error("Error requesting audio permissions:", error);
      return { granted: false, error };
    }
  }

  async startRecording() {
    try {
      if (this.stateManager.getState() !== AudioStates.IDLE) {
        await this.cleanup();
      }

      this.ensureVisibilityListener();
      this.stateManager.setState(AudioStates.INITIALIZING);
      this.stateManager.setState(AudioStates.REQUESTING_PERMISSIONS);

      const { granted, stream, error } = await this.requestPermissions();

      if (!granted) {
        this.stateManager.setState(AudioStates.PERMISSION_DENIED);
        uiActions.setPermissionError(true);
        throw error || new Error("Permission not granted");
      }

      if (!stream) {
        throw new Error("No audio stream available");
      }

      this.stateManager.setState(AudioStates.READY);
      this.audioChunks = [];

      if (typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder not supported");
      }

      try {
        const mimeTypes = this.isIOS
          ? ["audio/mp4", "audio/aac", "audio/webm", ""]
          : ["audio/webm", "audio/ogg", ""];

        let mediaRecorderOptions = {
          audioBitsPerSecond: SPEECH_AUDIO_BITS_PER_SECOND,
        };

        for (const mimeType of mimeTypes) {
          if (!mimeType || MediaRecorder.isTypeSupported(mimeType)) {
            mediaRecorderOptions = mimeType
              ? { mimeType, audioBitsPerSecond: SPEECH_AUDIO_BITS_PER_SECOND }
              : { audioBitsPerSecond: SPEECH_AUDIO_BITS_PER_SECOND };
            break;
          }
        }

        this.stream = stream;
        this.mediaRecorder = new MediaRecorder(
          this.stream,
          mediaRecorderOptions,
        );

        // iOS reroutes the mic hardware (usually to 48kHz) once capture
        // starts. A context created before getUserMedia keeps its old rate
        // and stays 'running', but createMediaStreamSource then feeds the
        // analyser pure silence — flat bars while the recording works fine.
        // Recreate the context at the mic's real rate. (Safe after the
        // grant: WebKit lets contexts run while capture is active.)
        const micRate = this.stream
          .getAudioTracks()[0]
          ?.getSettings?.()?.sampleRate;
        if (
          this.audioContext &&
          micRate &&
          this.audioContext.sampleRate !== micRate
        ) {
          console.warn(
            `AudioContext rate ${this.audioContext.sampleRate} != mic rate ${micRate} — recreating context`,
          );
          try {
            await this.audioContext.close();
          } catch {
            // A dying context that refuses to close still gets replaced below.
          }
          this.audioContext = null;
        }

        if (!this.audioContext) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          this.audioContext = new AudioContext();
        }
        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume().catch(() => {});
        }

        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);

        this.startWaveformMonitoring();
      } catch (mrError) {
        stream.getTracks().forEach((track) => track.stop());
        throw mrError;
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      await wakeLockService.request();
      this.mediaRecorder.start(1000);
      this.stateManager.setState(AudioStates.RECORDING);

      // Update the store with mimeType
      audioState.update((current) => ({
        ...current,
        mimeType: this.mediaRecorder.mimeType || "audio/webm",
      }));

      return true;
    } catch (error) {
      console.error("Error starting recording:", error);
      this.stateManager.setState(AudioStates.ERROR, { error });

      uiActions.setErrorMessage(
        `Recording error: ${error.message || "Unknown error"}`,
      );

      await this.cleanup();
      throw error;
    }
  }

  startWaveformMonitoring() {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const updateWaveform = () => {
      if (this.stateManager.getState() !== AudioStates.RECORDING) {
        cancelAnimationFrame(this.animationFrameId);
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      // Update store instead of emitting event
      audioActions.setWaveformData(Array.from(dataArray));

      this.animationFrameId = requestAnimationFrame(updateWaveform);
    };

    this.animationFrameId = requestAnimationFrame(updateWaveform);
  }

  async stopRecording() {
    return new Promise((resolve) => {
      // Update recording state to STOPPING
      audioActions.updateState(AudioStates.STOPPING);

      // Check recorder state - attempt to stop even if internal state doesn't match
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        wakeLockService.release();
        this.stateManager.setState(AudioStates.IDLE);
        resolve(null); // No active recording to stop
        return;
      }

      // The mimeType should be determined before onstop is set up.
      const mimeType = this.mediaRecorder.mimeType || "audio/webm";

      // MediaRecorder.stop() can wedge and never fire onstop (family-wide
      // lesson) — onstop and a 5s watchdog both funnel through this guarded
      // finalizer; whoever arrives first wins, the other no-ops.
      let settled = false;
      let wedgeTimeout = null;

      const finalize = () => {
        if (settled) return;
        settled = true;
        if (wedgeTimeout) clearTimeout(wedgeTimeout);
        wakeLockService.release();

        // Create the Blob from this.audioChunks — on the normal path this
        // includes the final chunk from the last dataavailable event; on the
        // wedge path it's whatever made it in (better than hanging forever).
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });

        // Update store with audio blob
        audioActions.setAudioBlob(audioBlob, mimeType);

        // Immediately stop all tracks to ensure browser recording indicator is removed
        if (this.stream) {
          this.stream.getTracks().forEach((track) => {
            track.stop();
          });
          // Clear the stream reference
          this.stream = null;
        }

        this.audioChunks = [];
        this.mediaRecorder = null;

        // Ensure state is properly reset
        this.stateManager.setState(AudioStates.IDLE);

        resolve(audioBlob);
      };

      this.mediaRecorder.onstop = finalize;

      try {
        this.mediaRecorder.stop();
        wedgeTimeout = setTimeout(() => {
          if (!settled) {
            console.warn(
              "MediaRecorder onstop never fired — salvaging recorded chunks",
            );
            finalize();
          }
        }, 5000);
      } catch (error) {
        console.warn("Error stopping MediaRecorder:", error.message);
        if (settled) return;
        settled = true;

        // Ensure tracks are stopped even if MediaRecorder stop fails
        if (this.stream) {
          this.stream.getTracks().forEach((track) => {
            track.stop();
          });
          this.stream = null;
        }

        // Force state reset on error
        wakeLockService.release();
        this.stateManager.setState(AudioStates.IDLE);
        resolve(null);
      }
    });
  }

  async cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.cleanupPromise) {
      return this.cleanupPromise;
    }

    const currentState = this.stateManager.getState();
    const allowedCleanupStates = [
      AudioStates.RECORDING,
      AudioStates.STOPPING,
      AudioStates.ERROR,
      AudioStates.PAUSED,
    ];

    if (
      !allowedCleanupStates.includes(currentState) &&
      currentState !== AudioStates.IDLE
    ) {
      return Promise.resolve();
    }

    if (
      currentState === AudioStates.IDLE &&
      !this.mediaRecorder &&
      !this.stream &&
      !this.audioContext
    ) {
      return Promise.resolve();
    }

    this.stateManager.setState(AudioStates.CLEANING);
    this.cleanupPromise = this.#doCleanup().finally(() => {
      this.cleanupPromise = null;
    });

    return this.cleanupPromise;
  }

  async #doCleanup() {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 1000);

          this.mediaRecorder.onstop = () => {
            clearTimeout(timeout);
            resolve();
          };

          try {
            this.mediaRecorder.stop();
          } catch (stopError) {
            console.warn("Error stopping MediaRecorder:", stopError.message);
            resolve();
          }
        });
      }

      if (this.stream) {
        const tracks = this.stream.getTracks();
        await Promise.all(
          tracks.map((track) => {
            return new Promise((resolve) => {
              track.onended = resolve;
              track.stop();
              setTimeout(resolve, 500);
            });
          }),
        );
        this.stream = null;
      }

      if (this.audioContext) {
        if (this.analyser) {
          try {
            this.analyser.disconnect();
          } catch (analyserError) {
            console.warn(
              "Error disconnecting analyser:",
              analyserError.message,
            );
          }
          this.analyser = null;
        }

        if (this.isIOS) {
          try {
            await this.audioContext.suspend();
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (suspendError) {
            console.warn(
              "Error suspending iOS audio context:",
              suspendError.message,
            );
          }
        }

        try {
          await this.audioContext.close();
        } catch (closeError) {
          console.warn("Error closing audio context:", closeError.message);
        }
        this.audioContext = null;
      }

      this.mediaRecorder = null;
      this.audioChunks = [];

      if (this.isIOS) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } finally {
      wakeLockService.release();
      this.removeVisibilityListener();
      this.stateManager.setState(AudioStates.IDLE);
    }
  }

  getRecordingState() {
    return this.stateManager.getState();
  }

  isRecording() {
    return this.stateManager.getState() === AudioStates.RECORDING;
  }
}

export const audioService = new AudioService();
