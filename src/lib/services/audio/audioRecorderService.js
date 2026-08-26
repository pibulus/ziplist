import { get } from "svelte/store";
import {
  audioState,
  audioActions,
  isRecording,
  isTranscribing,
  uiActions,
} from "../infrastructure/stores";
import { soundService } from "../infrastructure/soundService";
import { wakeLockService } from "../pwa/wakeLockService";
import { transcriptionService } from "../transcription/transcriptionService";
import { AudioStates } from "./audioStates";
import { listsStore } from "../lists/listsStore";
import * as liveListsService from "../realtime/liveListsService";
import { pwaService } from "../pwa/pwaService";

const AUDIO_CAPTURE_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};
const RECORDER_CHUNK_INTERVAL_MS = 1000;

class AudioRecorderService {
  constructor() {
    this.mediaRecorder = null;
    this.activeStream = null;
    this.audioChunks = [];
    this.isStartingRecording = false;
    this.isStoppingRecording = false;
    this.visualizerAudioContext = null;
    this.visualizerAnalyser = null;
    this.visualizerFrameId = null;
    this.recordingLiveListId = null;
    this.retryAudioBlob = null;
    this.holdReleasedWhilePending = false;
    this.holdPendingExpiry = null;
  }

  isStartableAudioState(state) {
    return [
      AudioStates.IDLE,
      AudioStates.ERROR,
      AudioStates.PERMISSION_DENIED,
      AudioStates.NO_INPUT_DETECTED,
    ].includes(state);
  }

  getActiveLiveListId() {
    const activeListId = get(listsStore).activeListId;
    return activeListId && liveListsService.isLive(activeListId)
      ? activeListId
      : null;
  }

  broadcastLiveVoiceActivity(data) {
    if (!this.recordingLiveListId) return;
    liveListsService.broadcastVoiceActivity(this.recordingLiveListId, data);
  }

  clearLiveVoiceActivity() {
    if (!this.recordingLiveListId) return;
    liveListsService.broadcastVoiceActivity(this.recordingLiveListId, {
      active: false,
    });
    this.recordingLiveListId = null;
  }

  stopStream(stream) {
    stream?.getTracks().forEach((track) => track.stop());
  }

  stopWaveformMonitoring() {
    if (this.visualizerFrameId) {
      cancelAnimationFrame(this.visualizerFrameId);
      this.visualizerFrameId = null;
    }
    this.visualizerAnalyser = null;
    audioActions.setWaveformData([]);

    if (this.visualizerAudioContext) {
      this.visualizerAudioContext.close().catch(() => {});
      this.visualizerAudioContext = null;
    }
  }

  async startWaveformMonitoring(stream) {
    this.stopWaveformMonitoring();

    const AudioContextCtor =
      typeof window !== "undefined"
        ? window.AudioContext || window.webkitAudioContext
        : null;
    if (!AudioContextCtor) return;

    try {
      this.visualizerAudioContext = new AudioContextCtor();

      if (this.visualizerAudioContext.state === "suspended") {
        await this.visualizerAudioContext.resume();
      }

      const source =
        this.visualizerAudioContext.createMediaStreamSource(stream);
      const analyser = this.visualizerAudioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      this.visualizerAnalyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateWaveform = () => {
        if (!this.visualizerAnalyser) return;

        this.visualizerAnalyser.getByteFrequencyData(dataArray);
        audioActions.setWaveformData(Array.from(dataArray));
        this.visualizerFrameId = requestAnimationFrame(updateWaveform);
      };

      updateWaveform();
    } catch (err) {
      console.warn("Waveform audio visualizer setup failed:", err);
      this.stopWaveformMonitoring();
    }
  }

  getRecorderOptions() {
    if (
      typeof MediaRecorder === "undefined" ||
      !MediaRecorder.isTypeSupported
    ) {
      return {};
    }

    const supportedMimeType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

    return supportedMimeType ? { mimeType: supportedMimeType } : {};
  }

  resetRecordingSession() {
    this.clearLiveVoiceActivity();
    this.stopWaveformMonitoring();
    wakeLockService.release();
    this.stopStream(this.activeStream);
    this.activeStream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isStartingRecording = false;
    this.isStoppingRecording = false;
  }

  handleHoldStart() {
    soundService.impact?.("medium");
    if (!get(isRecording)) this.toggleRecording();
  }

  handleHoldEnd() {
    if (get(isRecording)) {
      this.stopActiveRecording();
      return;
    }
    if (this.isStartingRecording) {
      this.holdReleasedWhilePending = true;
      if (this.holdPendingExpiry) clearTimeout(this.holdPendingExpiry);
      this.holdPendingExpiry = setTimeout(() => {
        this.holdReleasedWhilePending = false;
      }, 1200);
    }
  }

  stopActiveRecording() {
    if (this.isStoppingRecording) return;
    this.isStoppingRecording = true;
    soundService.stopRecording({ force: true });

    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      audioActions.updateState(AudioStates.STOPPING);
      this.mediaRecorder.stop();
      wakeLockService.release();
      return;
    }

    this.resetRecordingSession();
    audioActions.updateState(AudioStates.IDLE);
  }

  async toggleRecording() {
    if (get(isRecording)) {
      this.stopActiveRecording();
    } else {
      const state = get(audioState).state;
      if (
        this.isStartingRecording ||
        get(isTranscribing) ||
        !this.isStartableAudioState(state)
      ) {
        soundService.locked();
        return;
      }

      this.isStartingRecording = true;
      uiActions.clearErrorMessage();
      uiActions.setPermissionError(false);
      this.audioChunks = [];

      let stream = null;

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error("getUserMedia not supported on this browser!");
          this.isStartingRecording = false;
          soundService.error({ force: true });
          audioActions.updateState(
            AudioStates.ERROR,
            "getUserMedia is not supported.",
          );
          uiActions.setErrorMessage(
            "Voice recording needs a browser with microphone support.",
          );
          return;
        }

        soundService.startRecording({ force: true });
        audioActions.updateState(AudioStates.REQUESTING_PERMISSIONS);
        stream = await navigator.mediaDevices.getUserMedia(
          AUDIO_CAPTURE_CONSTRAINTS,
        );
        this.activeStream = stream;

        const recorderOptions = this.getRecorderOptions();
        const recorder = new MediaRecorder(stream, recorderOptions);
        this.mediaRecorder = recorder;
        await this.startWaveformMonitoring(stream);
        await wakeLockService.request();

        recorder.onstart = () => {
          this.isStartingRecording = false;
          this.isStoppingRecording = false;
          audioActions.updateState(AudioStates.RECORDING);
          this.recordingLiveListId = this.getActiveLiveListId();
          this.broadcastLiveVoiceActivity({
            active: true,
            stage: "recording",
          });

          if (this.holdReleasedWhilePending) {
            this.holdReleasedWhilePending = false;
            if (this.holdPendingExpiry) clearTimeout(this.holdPendingExpiry);
            this.stopActiveRecording();
          }
        };

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        recorder.onstop = async () => {
          audioActions.updateState(AudioStates.PROCESSING);
          this.broadcastLiveVoiceActivity({
            active: true,
            stage: "transcribing",
          });
          this.isStoppingRecording = false;
          this.stopWaveformMonitoring();
          wakeLockService.release();
          this.stopStream(stream);
          if (this.activeStream === stream) {
            this.activeStream = null;
          }

          const audioBlob = new Blob(this.audioChunks, {
            type: recorder.mimeType || recorderOptions.mimeType || "audio/webm",
          });
          this.audioChunks = [];

          try {
            if (audioBlob.size === 0) {
              audioActions.updateState(AudioStates.IDLE);
              soundService.locked({ force: true });
              uiActions.setErrorMessage(
                "That take came through empty — check the mic and give it another go.",
              );
              return;
            }

            const transcriptionResult =
              await transcriptionService.transcribeAudio(audioBlob);
            this.playTranscriptionCue(transcriptionResult);
            pwaService.incrementTranscriptionCount();
            this.retryAudioBlob = null;
          } catch (transcriptionError) {
            console.error(
              "Transcription failed in onstop:",
              transcriptionError,
            );
            soundService.error({ force: true });
            this.retryAudioBlob = audioBlob;
          } finally {
            this.resetRecordingSession();
            if (get(audioState).state === AudioStates.PROCESSING) {
              audioActions.updateState(AudioStates.IDLE);
            }
          }
        };

        recorder.onerror = (event) => {
          this.isStartingRecording = false;
          this.isStoppingRecording = false;
          console.error("MediaRecorder error:", event.error);
          soundService.error({ force: true });
          audioActions.updateState(
            AudioStates.ERROR,
            event.error.message || "MediaRecorder error",
          );
          uiActions.setErrorMessage(`Recording error: ${event.error.name}`);
          this.resetRecordingSession();
        };

        recorder.start(RECORDER_CHUNK_INTERVAL_MS);
      } catch (err) {
        this.isStartingRecording = false;
        this.isStoppingRecording = false;
        this.resetRecordingSession();

        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          soundService.error({ force: true });
          audioActions.updateState(AudioStates.PERMISSION_DENIED);
          uiActions.setPermissionError(true);
          uiActions.setErrorMessage(
            "Microphone permission was denied. Enable it in your browser settings to record.",
          );
        } else {
          soundService.error({ force: true });
          audioActions.updateState(AudioStates.ERROR, err.message);
          uiActions.setErrorMessage(
            "Couldn't access the microphone. Check your audio settings.",
          );
        }
      }
    }
  }

  playTranscriptionCue(result) {
    const rawText = typeof result === "string" ? result : result?.text || "";
    const items = Array.isArray(result?.items) ? result.items : [];
    const commands = Array.isArray(result?.commands) ? result.commands : [];
    const complete = Array.isArray(result?.complete) ? result.complete : [];

    if (
      items.length > 0 ||
      commands.length > 0 ||
      complete.length > 0 ||
      rawText.trim().length > 0
    ) {
      soundService.add({ force: true });
    } else {
      soundService.locked({ force: true });
    }
  }
}

export const audioRecorderService = new AudioRecorderService();
