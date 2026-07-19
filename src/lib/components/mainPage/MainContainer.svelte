<script>
  import { onMount, onDestroy, tick } from "svelte";
  import { get } from "svelte/store";
  import { browser } from "$app/environment";
  import ContentContainer from "./ContentContainer.svelte";
  import FooterComponent from "./FooterComponent.svelte";
  import { geminiService } from "$lib/services/geminiService";
  import { modalService } from "$lib/services/modals";
  import { transcriptionService } from "$lib/services/transcription/transcriptionService.js";
  import { firstVisitService } from "$lib/services/first-visit";
  import {
    pwaService,
    deferredInstallPrompt,
    showPwaInstallPrompt,
    wakeLockService,
  } from "$lib/services/pwa";
  import {
    isRecording,
    isTranscribing,
    transcriptionProgress,
    recordingDuration,
    audioState,
    audioActions,
    uiState,
    uiActions,
  } from "$lib/services/infrastructure/stores.js";
  import { AudioStates } from "$lib/services/audio/audioStates.js";
  import { PageLayout } from "$lib/components/layout";
  import { listFirstMode, soundCues } from "$lib";
  import { listsStore } from "$lib/services/lists/listsStore";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import SwipeableLists from "../list/SwipeableLists.svelte";
  import PermissionError from "./audio-transcript/PermissionError.svelte";
  import RecordButtonWithTimer from "./audio-transcript/RecordButtonWithTimer.svelte";
  import { fade } from "svelte/transition";
  import { StorageUtils } from "$lib/services/infrastructure/storageUtils";
  import { STORAGE_KEYS } from "$lib/constants";
  import * as liveListsService from "$lib/services/realtime/liveListsService";

  import { AboutModal, ExtensionModal, IntroModal } from "./modals";

  const AUDIO_CAPTURE_CONSTRAINTS = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };
  const RECORDER_CHUNK_INTERVAL_MS = 1000;
  const LAUNCH_RECORD_ACTION = "record";

  // Lazy load settings modal - only import when needed
  let SettingsModal;
  let loadingSettingsModal = false;

  // Lazy load contributor modal - only import when needed
  let ContributorModal;
  let loadingContributorModal = false;

  // PWA Install Prompt component - lazy loaded
  let PwaInstallPrompt;
  let loadingPwaPrompt = false;
  let PwaDeviceSetup;
  let loadingPwaDeviceSetup = false;
  let showPwaDeviceSetup = false;

  let speechModelPreloaded = false;
  let mediaRecorder = null;
  let activeStream = null;
  let audioChunks = [];
  let isStartingRecording = false;
  let isStoppingRecording = false;
  let preloadCleanup = null;
  let visualizerAudioContext = null;
  let visualizerAnalyser = null;
  let visualizerFrameId = null;
  let settingsModalPreloadTimeout = null;
  let autoRecordTimeout = null;
  let postTranscriptionScrollTimeout = null;
  let soundCuesUnsubscribe = null;
  let recordingLiveListId = null;

  function stopStream(stream) {
    stream?.getTracks().forEach((track) => track.stop());
  }

  function getActiveLiveListId() {
    const activeListId = get(listsStore).activeListId;
    return activeListId && liveListsService.isLive(activeListId)
      ? activeListId
      : null;
  }

  function broadcastLiveVoiceActivity(data) {
    if (!recordingLiveListId) return;
    liveListsService.broadcastVoiceActivity(recordingLiveListId, data);
  }

  function clearLiveVoiceActivity() {
    if (!recordingLiveListId) return;

    liveListsService.broadcastVoiceActivity(recordingLiveListId, {
      active: false,
    });
    recordingLiveListId = null;
  }

  function resetRecordingSession() {
    clearLiveVoiceActivity();
    stopWaveformMonitoring();
    wakeLockService.release();
    stopStream(activeStream);
    activeStream = null;
    mediaRecorder = null;
    audioChunks = [];
    isStartingRecording = false;
    isStoppingRecording = false;
  }

  function getRecorderOptions() {
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

  // Modal functions
  function showAboutModal() {
    soundService.open();
    modalService.openModal("about_modal");
  }

  function showExtensionModal() {
    soundService.open();
    modalService.openModal("extension_modal");
  }

  async function openSettingsModal() {
    // First, ensure any open dialogs are closed
    if (modalService.isModalOpen()) {
      modalService.closeModal();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Check if we're already loading the modal
    if (loadingSettingsModal) {
      return;
    }

    // Dynamically import the SettingsModal component if not already loaded
    if (!SettingsModal) {
      loadingSettingsModal = true;

      try {
        // Import the component dynamically
        const module = await import("./settings/SettingsModal.svelte");
        SettingsModal = module.default;
      } catch (err) {
        console.error("Error loading SettingsModal:", err);
        loadingSettingsModal = false;
        return; // Don't proceed if loading failed
      } finally {
        loadingSettingsModal = false; // Ensure this is always reset
      }
    }

    await tick();

    // Open the settings modal
    soundService.open();
    modalService.openModal("settings_modal");
  }

  function closeSettingsModal() {
    soundService.close();
    modalService.closeModal();
  }

  async function openContributorModal() {
    if (modalService.isModalOpen()) {
      modalService.closeModal();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (loadingContributorModal) {
      return;
    }

    if (!ContributorModal) {
      loadingContributorModal = true;

      try {
        const module = await import("./modals/ContributorModal.svelte");
        ContributorModal = module.default;
      } catch (err) {
        console.error("Error loading ContributorModal:", err);
        loadingContributorModal = false;
        return;
      } finally {
        loadingContributorModal = false;
      }
    }

    await tick();

    soundService.open();
    modalService.openModal("contributor_modal");
  }

  function closeContributorModal() {
    soundService.close();
    modalService.closeModal();
  }

  function closeModal() {
    soundService.close();
    modalService.closeModal();
  }

  // Function to preload speech model for faster initial response
  function preloadSpeechModel() {
    if (!speechModelPreloaded && browser) {
      speechModelPreloaded = true;

      const savedStyle = StorageUtils.getItem(STORAGE_KEYS.PROMPT_STYLE);
      if (savedStyle) {
        geminiService.setPromptStyle(savedStyle);
      }

      geminiService.preloadModel().catch((err) => {
        // Just log the error, don't block UI
        console.error("Error preloading speech model:", err);
        // Reset so we can try again
        speechModelPreloaded = false;
      });
    }
  }

  function handleSettingChanged(event) {
    if (event.detail && event.detail.setting === "promptStyle") {
      geminiService.setPromptStyle(event.detail.value);
    }
  }

  function handleStorageError(event) {
    uiActions.setErrorMessage(event.detail.message);
  }

  function hasLaunchRecordIntent() {
    if (!browser) return false;
    return (
      new URLSearchParams(window.location.search).get("action") ===
      LAUNCH_RECORD_ACTION
    );
  }

  function prepareRecorderOnLaunch() {
    preloadSpeechModel();

    autoRecordTimeout = window.setTimeout(() => {
      const recordButton = document.querySelector("[data-record-button]");

      recordButton?.scrollIntoView({ behavior: "smooth", block: "center" });
      recordButton?.focus({ preventScroll: true });
      uiActions.setScreenReaderMessage(
        "Recorder ready. Tap the record button to allow microphone access.",
      );

      autoRecordTimeout = null;
    }, 500);
  }

  function clearPostTranscriptionScroll() {
    if (postTranscriptionScrollTimeout) {
      clearTimeout(postTranscriptionScrollTimeout);
      postTranscriptionScrollTimeout = null;
    }
  }

  function schedulePostTranscriptionScroll() {
    clearPostTranscriptionScroll();
    postTranscriptionScrollTimeout = setTimeout(() => {
      scrollToLists();
      postTranscriptionScrollTimeout = null;
    }, 100);
  }

  function stopWaveformMonitoring() {
    if (visualizerFrameId) {
      cancelAnimationFrame(visualizerFrameId);
      visualizerFrameId = null;
    }

    visualizerAnalyser = null;
    audioActions.setWaveformData([]);

    if (visualizerAudioContext) {
      visualizerAudioContext.close().catch(() => {});
      visualizerAudioContext = null;
    }
  }

  function isStartableAudioState(state) {
    return [
      AudioStates.IDLE,
      AudioStates.ERROR,
      AudioStates.PERMISSION_DENIED,
      AudioStates.NO_INPUT_DETECTED,
    ].includes(state);
  }

  function stopActiveRecording() {
    if (isStoppingRecording) return;
    isStoppingRecording = true;
    soundService.stopRecording({ force: true });

    if (mediaRecorder && mediaRecorder.state === "recording") {
      audioActions.updateState(AudioStates.STOPPING);
      mediaRecorder.stop();
      wakeLockService.release();
      return;
    }

    resetRecordingSession();
    audioActions.updateState(AudioStates.IDLE);
  }

  function closePermissionError() {
    soundService.close();
    uiActions.setPermissionError(false);
    uiActions.clearErrorMessage();

    if (get(audioState).state === AudioStates.PERMISSION_DENIED) {
      audioActions.updateState(AudioStates.IDLE);
    }
  }

  async function startWaveformMonitoring(stream) {
    stopWaveformMonitoring();

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      visualizerAudioContext = new AudioContextCtor();

      if (visualizerAudioContext.state === "suspended") {
        await visualizerAudioContext.resume();
      }

      const source = visualizerAudioContext.createMediaStreamSource(stream);
      visualizerAnalyser = visualizerAudioContext.createAnalyser();
      visualizerAnalyser.fftSize = 128;
      source.connect(visualizerAnalyser);

      const waveformBuffer = new Uint8Array(
        visualizerAnalyser.frequencyBinCount,
      );

      const pumpWaveform = () => {
        if (!visualizerAnalyser) return;

        visualizerAnalyser.getByteFrequencyData(waveformBuffer);
        audioActions.setWaveformData(Array.from(waveformBuffer));
        visualizerFrameId = requestAnimationFrame(pumpWaveform);
      };

      pumpWaveform();
    } catch (error) {
      console.warn("Waveform monitoring unavailable:", error);
      stopWaveformMonitoring();
    }
  }

  function playTranscriptionResultCue(result) {
    const addedCount = Array.isArray(result?.items) ? result.items.length : 0;
    const completedCount = Array.isArray(result?.complete)
      ? result.complete.length
      : 0;

    if (addedCount > 0 && completedCount > 0) {
      soundService.complete({ force: true });
    } else if (completedCount > 0) {
      soundService.check({ force: true });
    } else if (addedCount > 0) {
      soundService.add({ force: true });
    } else {
      soundService.select();
    }
  }

  onDestroy(() => {
    if (typeof preloadCleanup === "function") {
      preloadCleanup();
    }

    if (settingsModalPreloadTimeout) {
      clearTimeout(settingsModalPreloadTimeout);
      settingsModalPreloadTimeout = null;
    }

    if (autoRecordTimeout) {
      clearTimeout(autoRecordTimeout);
      autoRecordTimeout = null;
    }

    clearPostTranscriptionScroll();

    if (soundCuesUnsubscribe) {
      soundCuesUnsubscribe();
      soundCuesUnsubscribe = null;
    }

    if (mediaRecorder) {
      mediaRecorder.onstart = null;
      mediaRecorder.ondataavailable = null;
      mediaRecorder.onstop = null;
      mediaRecorder.onerror = null;

      if (mediaRecorder.state !== "inactive") {
        try {
          mediaRecorder.stop();
        } catch (error) {
          console.warn("Error stopping recorder during teardown:", error);
        }
      }
    }

    resetRecordingSession();
    firstVisitService.cancelPendingIntroModal();
    modalService.cleanup();
    pwaService.cleanup();

    if (browser) {
      window.removeEventListener(
        "ziplist-setting-changed",
        handleSettingChanged,
      );
      window.removeEventListener("ziplist-storage-error", handleStorageError);
      window.removeEventListener(
        "ziplist-open-contributor",
        openContributorModal,
      );
    }
  });

  // Handle toggle recording
  async function handleToggleRecording() {
    if ($isRecording) {
      stopActiveRecording();
    } else {
      if (
        isStartingRecording ||
        $isTranscribing ||
        !isStartableAudioState($audioState.state)
      ) {
        soundService.locked();
        return;
      }

      // Guard against rapid double-taps spawning multiple streams
      isStartingRecording = true;
      uiActions.clearErrorMessage();
      uiActions.setPermissionError(false);

      audioChunks = []; // Clear previous chunks

      let stream = null;

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error("getUserMedia not supported on this browser!");
          isStartingRecording = false;
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
        activeStream = stream;

        const recorderOptions = getRecorderOptions();
        const recorder = new MediaRecorder(stream, recorderOptions);
        mediaRecorder = recorder;
        await startWaveformMonitoring(stream);
        await wakeLockService.request();

        recorder.onstart = () => {
          isStartingRecording = false;
          isStoppingRecording = false;
          audioActions.updateState(AudioStates.RECORDING);
          recordingLiveListId = getActiveLiveListId();
          broadcastLiveVoiceActivity({
            active: true,
            stage: "recording",
          });
        };

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        recorder.onstop = async () => {
          audioActions.updateState(AudioStates.PROCESSING); // Indicate processing starts
          broadcastLiveVoiceActivity({
            active: true,
            stage: "transcribing",
          });
          isStoppingRecording = false;
          stopWaveformMonitoring();
          wakeLockService.release();
          stopStream(stream);
          if (activeStream === stream) {
            activeStream = null;
          }

          const audioBlob = new Blob(audioChunks, {
            type: recorder.mimeType || recorderOptions.mimeType || "audio/webm",
          });
          audioChunks = [];

          try {
            if (audioBlob.size === 0) {
              audioActions.updateState(AudioStates.IDLE);
              soundService.locked({ force: true });
              return;
            }

            const transcriptionResult =
              await transcriptionService.transcribeAudio(audioBlob);
            playTranscriptionResultCue(transcriptionResult);
            pwaService.incrementTranscriptionCount();
            // Auto-scroll to lists after successful transcription to show new items
            schedulePostTranscriptionScroll();
          } catch (transcriptionError) {
            console.error(
              "Transcription failed in onstop:",
              transcriptionError,
            );
            soundService.error({ force: true });
          } finally {
            resetRecordingSession();
            if (get(audioState).state === AudioStates.PROCESSING) {
              audioActions.updateState(AudioStates.IDLE);
            }
          }
        };

        recorder.onerror = (event) => {
          isStartingRecording = false;
          isStoppingRecording = false;
          console.error("MediaRecorder error:", event.error);
          soundService.error({ force: true });
          audioActions.updateState(
            AudioStates.ERROR,
            event.error.message || "MediaRecorder error",
          );
          uiActions.setErrorMessage(`Recording error: ${event.error.name}`);
          resetRecordingSession();
        };

        recorder.start(RECORDER_CHUNK_INTERVAL_MS);
      } catch (err) {
        isStartingRecording = false;
        isStoppingRecording = false;
        stopWaveformMonitoring();
        wakeLockService.release();
        stopStream(stream);
        if (activeStream === stream) {
          activeStream = null;
        }
        mediaRecorder = null;
        audioChunks = [];
        console.error(
          "Error starting recording (getUserMedia or MediaRecorder setup):",
          err,
        );
        soundService.error({ force: true });
        let errorMessage = "Recording needs one more try.";
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          audioActions.updateState(AudioStates.PERMISSION_DENIED);
          uiActions.setPermissionError(true);
          errorMessage =
            "Microphone access needs a quick settings change before recording.";
        } else if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          audioActions.updateState(AudioStates.NO_INPUT_DETECTED);
          uiActions.setPermissionError(false);
          errorMessage = "ZipList needs a microphone before recording.";
        } else {
          audioActions.updateState(AudioStates.ERROR, err.message);
          uiActions.setPermissionError(false);
          errorMessage = err.message || "Recording needs one more try.";
        }
        uiActions.setErrorMessage(errorMessage);
      }
    }
  }

  $: recordButtonDisabled =
    !$isRecording &&
    (isStartingRecording ||
      $isTranscribing ||
      !isStartableAudioState($audioState.state));

  // Scroll to lists container
  function scrollToLists() {
    if (browser) {
      const listsContainer = document.getElementById("lists-container");
      if (listsContainer) {
        listsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function closePwaInstallPrompt() {
    soundService.close();
    pwaService.dismissPrompt();
  }

  async function maybeLoadPwaDeviceSetup() {
    if (!browser || !pwaService.shouldShowDeviceSetup()) {
      showPwaDeviceSetup = false;
      return;
    }

    showPwaDeviceSetup = true;

    if (PwaDeviceSetup || loadingPwaDeviceSetup) return;

    loadingPwaDeviceSetup = true;

    try {
      const module = await import("./pwa/PwaDeviceSetup.svelte");
      PwaDeviceSetup = module.default;
    } catch (err) {
      console.error("Error loading PWA device setup:", err);
      showPwaDeviceSetup = false;
    } finally {
      loadingPwaDeviceSetup = false;
    }
  }

  function handlePwaDeviceSetupDone() {
    soundService.success();
    showPwaDeviceSetup = false;
  }

  function handlePwaDeviceSetupDismissed() {
    soundService.close();
    showPwaDeviceSetup = false;
  }

  // Lifecycle hooks
  onMount(() => {
    // Initialize lists store from localStorage
    listsStore.initialize();

    if (browser) {
      soundCuesUnsubscribe = soundCues.subscribe((value) => {
        soundService.setEnabled(value !== "false");
      });

      const preloadOnInteraction = () => {
        preloadSpeechModel();
        window.removeEventListener("pointerdown", preloadOnInteraction);
        window.removeEventListener("keydown", preloadOnInteraction);
      };

      window.addEventListener("pointerdown", preloadOnInteraction, {
        once: true,
      });
      window.addEventListener("keydown", preloadOnInteraction, { once: true });

      const preloadTimeout = window.setTimeout(preloadSpeechModel, 1500);

      preloadCleanup = () => {
        window.clearTimeout(preloadTimeout);
        window.removeEventListener("pointerdown", preloadOnInteraction);
        window.removeEventListener("keydown", preloadOnInteraction);
      };
    }

    // Pre-load the SettingsModal component after a short delay
    settingsModalPreloadTimeout = window.setTimeout(async () => {
      if (!SettingsModal && !loadingSettingsModal) {
        try {
          loadingSettingsModal = true;
          const module = await import("./settings/SettingsModal.svelte");
          SettingsModal = module.default;
          loadingSettingsModal = false;
        } catch (err) {
          console.error("Error pre-loading SettingsModal:", err);
          loadingSettingsModal = false;
        }
      }
      settingsModalPreloadTimeout = null;
    }, 1000);

    // Mobile PWAs cannot reliably open the microphone on launch without a fresh tap.
    // Treat launch intents as "ready the recorder" instead of forcing a permission prompt.
    if (
      browser &&
      (StorageUtils.getBooleanItem(STORAGE_KEYS.AUTO_RECORD, false) ||
        hasLaunchRecordIntent())
    ) {
      prepareRecorderOnLaunch();
    }

    // Listen for settings changes
    if (browser) {
      window.addEventListener("ziplist-setting-changed", handleSettingChanged);
      window.addEventListener("ziplist-storage-error", handleStorageError);
      window.addEventListener("ziplist-open-contributor", openContributorModal);
      pwaService.setupEventListeners();
      void pwaService.checkIfRunningAsPwa();
      maybeLoadPwaDeviceSetup();
    }

    // Auto-open the intro on first visit. The historic root-scrollbar jump
    // (showModal() hiding the scrollbar mid-open) is now neutralised: app.css
    // pins `html { overflow-y: scroll }` so the gutter is always reserved, and
    // `html.modal-active { width: 100vw; padding-right: 0 }` holds width steady
    // while the modalService body-locks. showIntroModal() no-ops for returning
    // visitors and routes through modalService (so the skeleton open/close
    // animations apply).
    void firstVisitService.showIntroModal("intro_modal", 500);
  });

  // Auto-stop recording when time limit is reached
  $: if (
    $audioState.timeLimit &&
    mediaRecorder &&
    mediaRecorder.state === "recording"
  ) {
    soundService.stopRecording({ force: true });
    mediaRecorder.stop();
  }

  // Reactive statement for lazy loading PWA Install Prompt
  $: if (
    browser &&
    $showPwaInstallPrompt &&
    !PwaInstallPrompt &&
    !loadingPwaPrompt
  ) {
    (async () => {
      loadingPwaPrompt = true;
      try {
        const module = await import("./pwa/PwaInstallPrompt.svelte");
        PwaInstallPrompt = module.default;
      } catch (err) {
        console.error("Error loading PWA install prompt:", err);
      } finally {
        loadingPwaPrompt = false;
      }
    })();
  }
</script>

<PageLayout listFirst={$listFirstMode === "true"}>
  {#if $listFirstMode !== "true"}
    <ContentContainer on:toggleRecording={handleToggleRecording} />
  {/if}

  <!-- RecordButtonWithTimer above the List with reduced spacing -->
  <div
    class="my-1 flex justify-center sm:my-3"
    class:list-first-record-button={$listFirstMode === "true"}
  >
    <RecordButtonWithTimer
      recording={$isRecording}
      transcribing={$isTranscribing}
      disabled={recordButtonDisabled}
      clipboardSuccess={$uiState.clipboardSuccess}
      recordingDuration={$recordingDuration}
      progress={$transcriptionProgress}
      on:click={handleToggleRecording}
      on:preload={preloadSpeechModel}
    />
  </div>

  {#if $uiState.showPermissionError || $audioState.state === AudioStates.PERMISSION_DENIED}
    <div class="mb-3 px-4" transition:fade={{ duration: 180 }}>
      <PermissionError on:close={closePermissionError} />
    </div>
  {:else if $uiState.errorMessage}
    <div
      class="mx-auto mb-3 flex w-[min(100%,30rem)] items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white/85 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur"
      role="alert"
      transition:fade={{ duration: 180 }}
    >
      <span>{$uiState.errorMessage}</span>
      <button
        class="shrink-0 rounded-lg bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-normal text-slate-700"
        type="button"
        on:click={uiActions.clearErrorMessage}
      >
        Dismiss
      </button>
    </div>
  {/if}

  {#if showPwaDeviceSetup && PwaDeviceSetup && !loadingPwaDeviceSetup}
    <div class="mb-3 px-4" transition:fade={{ duration: 180 }}>
      <svelte:component
        this={PwaDeviceSetup}
        on:complete={handlePwaDeviceSetupDone}
        on:dismiss={handlePwaDeviceSetupDismissed}
      />
    </div>
  {/if}

  <!-- Swipeable lists container -->
  <div class="mt-0 w-full max-w-full sm:mt-2" id="lists-container">
    <SwipeableLists />
  </div>

  <svelte:fragment slot="footer-buttons">
    <FooterComponent
      on:showAbout={showAboutModal}
      on:showContributor={openContributorModal}
      on:showSettings={openSettingsModal}
      on:showExtension={showExtensionModal}
    />
  </svelte:fragment>
</PageLayout>

<!-- Modals -->
<AboutModal {closeModal} />
<ExtensionModal {closeModal} />
<IntroModal
  {closeModal}
  markIntroAsSeen={() => firstVisitService.markIntroAsSeen()}
  triggerGhostClick={handleToggleRecording}
/>

<!-- Settings Modal - lazy loaded -->
{#if SettingsModal}
  <svelte:component
    this={SettingsModal}
    closeModal={closeSettingsModal}
    on:close={closeSettingsModal}
  />
{/if}

<style>
  /* List-first: the voice button docks above the footer like a compose
     bar — thumb zone on phones, grounded instead of orphaned top-middle
     on desktop. Normal mode keeps it in the hero flow. */
  .list-first-record-button {
    position: fixed;
    bottom: calc(4rem + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    margin: 0;
    width: min(92vw, 380px);
    filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.14));
  }

  /* The picker dots dock too, just above the pill — both are chrome in
     list-first, so neither fights the layout for its spot */
  :global(.list-first-shell .pagination-dots) {
    position: fixed;
    bottom: calc(9.9rem + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    z-index: 39;
    margin: 0;
  }
</style>

{#if ContributorModal}
  <svelte:component
    this={ContributorModal}
    closeModal={closeContributorModal}
    on:close={closeContributorModal}
  />
{/if}

<!-- PWA Install Prompt — retired in favor of the family PwaInstallCard
     (chassis kernel, rendered in +layout.svelte). The old pwa service stays
     intact; re-enable by restoring this block. -->
{#if false && $showPwaInstallPrompt && PwaInstallPrompt && !loadingPwaPrompt}
  <div transition:fade={{ duration: 300 }}>
    <svelte:component
      this={PwaInstallPrompt}
      installPromptEvent={$deferredInstallPrompt}
      on:closeprompt={closePwaInstallPrompt}
    />
  </div>
{/if}
