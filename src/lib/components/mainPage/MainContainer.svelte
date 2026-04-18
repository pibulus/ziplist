<script>
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  import ContentContainer from './ContentContainer.svelte';
  import FooterComponent from './FooterComponent.svelte';
  import { geminiService } from '$lib/services/geminiService';
  import { modalService } from '$lib/services/modals';
  import { transcriptionService } from '$lib/services/transcription/transcriptionService.js';
  import { firstVisitService } from '$lib/services/first-visit';
  import { pwaService, deferredInstallPrompt, showPwaInstallPrompt } from '$lib/services/pwa';
  import {
    isRecording,
    isTranscribing,
    transcriptionProgress,
    recordingDuration,
    audioState,
    audioActions,
    uiState,
    uiActions
  } from '$lib/services/infrastructure/stores.js';
  import { AudioStates } from '$lib/services/audio/audioStates.js';
  import { PageLayout } from '$lib/components/layout';
  import { listsStore } from '$lib/services/lists/listsStore';
  import SwipeableLists from '../list/SwipeableLists.svelte';
  import RecordButtonWithTimer from './audio-transcript/RecordButtonWithTimer.svelte';
  import { fade } from 'svelte/transition';
  import { StorageUtils } from '$lib/services/infrastructure/storageUtils';
  import { STORAGE_KEYS } from '$lib/constants';
  import { simpleHybridService } from '$lib/services/transcription/simpleHybridService';

  import { AboutModal, ExtensionModal, IntroModal } from './modals';

  // Lazy load settings modal - only import when needed
  let SettingsModal;
  let loadingSettingsModal = false;

  // PWA Install Prompt component - lazy loaded
  let PwaInstallPrompt;
  let loadingPwaPrompt = false;

  let speechModelPreloaded = false;
  let mediaRecorder = null;
  let activeStream = null;
  let audioChunks = [];
  let isStartingRecording = false;
  let preloadCleanup = null;
  let visualizerAudioContext = null;
  let visualizerAnalyser = null;
  let visualizerFrameId = null;
  let settingsModalPreloadTimeout = null;
  let autoRecordTimeout = null;

  function stopStream(stream) {
    stream?.getTracks().forEach((track) => track.stop());
  }

  function resetRecordingSession() {
    stopWaveformMonitoring();
    stopStream(activeStream);
    activeStream = null;
    mediaRecorder = null;
    audioChunks = [];
    isStartingRecording = false;
  }

  // Modal functions
  function showAboutModal() {
    modalService.openModal('about_modal');
  }

  function showExtensionModal() {
    modalService.openModal('extension_modal');
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
        const module = await import('./settings/SettingsModal.svelte');
        SettingsModal = module.default;
      } catch (err) {
        console.error('Error loading SettingsModal:', err);
        loadingSettingsModal = false;
        return; // Don't proceed if loading failed
      } finally {
        loadingSettingsModal = false; // Ensure this is always reset
      }
    }

    // Open the settings modal
    modalService.openModal('settings_modal');
  }

  function closeSettingsModal() {
    modalService.closeModal();
  }

  function closeModal() {
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

      geminiService
        .preloadModel()
        .then(() => simpleHybridService.startBackgroundLoad())
        .catch((err) => {
          // Just log the error, don't block UI
          console.error('Error preloading speech model:', err);
          // Reset so we can try again
          speechModelPreloaded = false;
        });
    }
  }

  function handleSettingChanged(event) {
    if (event.detail && event.detail.setting === 'promptStyle') {
      geminiService.setPromptStyle(event.detail.value);
    }
  }

  function handleStorageError(event) {
    uiActions.setErrorMessage(event.detail.message);
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

  async function startWaveformMonitoring(stream) {
    stopWaveformMonitoring();

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      visualizerAudioContext = new AudioContextCtor();

      if (visualizerAudioContext.state === 'suspended') {
        await visualizerAudioContext.resume();
      }

      const source = visualizerAudioContext.createMediaStreamSource(stream);
      visualizerAnalyser = visualizerAudioContext.createAnalyser();
      visualizerAnalyser.fftSize = 128;
      source.connect(visualizerAnalyser);

      const waveformBuffer = new Uint8Array(visualizerAnalyser.frequencyBinCount);

      const pumpWaveform = () => {
        if (!visualizerAnalyser) return;

        visualizerAnalyser.getByteFrequencyData(waveformBuffer);
        audioActions.setWaveformData(Array.from(waveformBuffer));
        visualizerFrameId = requestAnimationFrame(pumpWaveform);
      };

      pumpWaveform();
    } catch (error) {
      console.warn('Waveform monitoring unavailable:', error);
      stopWaveformMonitoring();
    }
  }

  onDestroy(() => {
    if (typeof preloadCleanup === 'function') {
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

    if (mediaRecorder) {
      mediaRecorder.onstart = null;
      mediaRecorder.ondataavailable = null;
      mediaRecorder.onstop = null;
      mediaRecorder.onerror = null;

      if (mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop();
        } catch (error) {
          console.warn('Error stopping recorder during teardown:', error);
        }
      }
    }

    resetRecordingSession();

    if (browser) {
      window.removeEventListener('ziplist-setting-changed', handleSettingChanged);
      window.removeEventListener('ziplist-storage-error', handleStorageError);
    }
  });

  // Handle toggle recording
  async function handleToggleRecording() {

    if ($isRecording) {
      // Currently recording, so stop
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); // This will trigger onstop handler
      } else {
        resetRecordingSession();
        audioActions.updateState(AudioStates.IDLE);
      }
    } else {
      // Guard against rapid double-taps spawning multiple streams
      if (isStartingRecording) return;
      isStartingRecording = true;

      audioChunks = []; // Clear previous chunks

      let stream = null;

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error('getUserMedia not supported on this browser!');
          audioActions.updateState(AudioStates.ERROR, 'getUserMedia is not supported.');
          uiActions.setErrorMessage('Audio recording is not supported on this browser.');
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStream = stream;
        mediaRecorder = new MediaRecorder(stream);
        await startWaveformMonitoring(stream);

        mediaRecorder.onstart = () => {
          isStartingRecording = false;
          audioActions.updateState(AudioStates.RECORDING);
        };

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          audioActions.updateState(AudioStates.PROCESSING); // Indicate processing starts

          const audioBlob = new Blob(audioChunks, {
            type: mediaRecorder.mimeType || 'audio/webm'
          });
          audioChunks = [];

          try {
            if (audioBlob.size === 0) {
              audioActions.updateState(AudioStates.IDLE);
              return;
            }

            await transcriptionService.transcribeAudio(audioBlob);
            // Auto-scroll to lists after successful transcription to show new items
            setTimeout(scrollToLists, 100);
          } catch (transcriptionError) {
            console.error('Transcription failed in onstop:', transcriptionError);
          } finally {
            resetRecordingSession();
            if (get(audioState).state === AudioStates.PROCESSING) {
              audioActions.updateState(AudioStates.IDLE);
            }
          }
        };
        
        mediaRecorder.onerror = (event) => {
          isStartingRecording = false;
          console.error('MediaRecorder error:', event.error);
          audioActions.updateState(AudioStates.ERROR, event.error.message || 'MediaRecorder error');
          uiActions.setErrorMessage(`Recording error: ${event.error.name}`);
          resetRecordingSession();
        };

        mediaRecorder.start();

      } catch (err) {
        isStartingRecording = false;
        stopWaveformMonitoring();
        stopStream(stream);
        if (activeStream === stream) {
          activeStream = null;
        }
        mediaRecorder = null;
        audioChunks = [];
        console.error('Error starting recording (getUserMedia or MediaRecorder setup):', err);
        let errorMessage = 'Could not start recording.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          audioActions.updateState(AudioStates.PERMISSION_DENIED);
          errorMessage = 'Audio permission denied. Please allow microphone access.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          audioActions.updateState(AudioStates.NO_INPUT_DETECTED);
          errorMessage = 'No microphone found. Please connect a microphone.';
        } else {
          audioActions.updateState(AudioStates.ERROR, err.message);
          errorMessage = `Error: ${err.message}`;
        }
        uiActions.setErrorMessage(errorMessage);
      }
    }
  }

  
  // Scroll to lists container
  function scrollToLists() {
    if (browser) {
      const listsContainer = document.getElementById('lists-container');
      if (listsContainer) {
        listsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function closePwaInstallPrompt() {
    pwaService.dismissPrompt();
  }

  // Lifecycle hooks
  onMount(() => {
    // Initialize lists store from localStorage
    listsStore.initialize();

    if (browser) {
      const preloadOnInteraction = () => {
        preloadSpeechModel();
        window.removeEventListener('pointerdown', preloadOnInteraction);
        window.removeEventListener('keydown', preloadOnInteraction);
      };

      window.addEventListener('pointerdown', preloadOnInteraction, { once: true });
      window.addEventListener('keydown', preloadOnInteraction, { once: true });

      const preloadTimeout = window.setTimeout(preloadSpeechModel, 1500);

      preloadCleanup = () => {
        window.clearTimeout(preloadTimeout);
        window.removeEventListener('pointerdown', preloadOnInteraction);
        window.removeEventListener('keydown', preloadOnInteraction);
      };
    }

    // Pre-load the SettingsModal component after a short delay
    settingsModalPreloadTimeout = window.setTimeout(async () => {
      if (!SettingsModal && !loadingSettingsModal) {
        try {
          loadingSettingsModal = true;
          const module = await import('./settings/SettingsModal.svelte');
          SettingsModal = module.default;
          loadingSettingsModal = false;
        } catch (err) {
          console.error('Error pre-loading SettingsModal:', err);
          loadingSettingsModal = false;
        }
      }
      settingsModalPreloadTimeout = null;
    }, 1000);

    // Check for auto-record setting and start recording if enabled
    if (browser && StorageUtils.getBooleanItem(STORAGE_KEYS.AUTO_RECORD, false)) {
      // Wait minimal time for component initialization
      autoRecordTimeout = window.setTimeout(() => {
        if (!$isRecording) { // Check store directly
          handleToggleRecording(); // Use the main toggle function
        }
        autoRecordTimeout = null;
      }, 500);
    }

    // Listen for settings changes
    if (browser) {
      window.addEventListener('ziplist-setting-changed', handleSettingChanged);
      window.addEventListener('ziplist-storage-error', handleStorageError);
    }

    // Check if first visit to show intro
    firstVisitService.showIntroModal();
  });

  // Auto-stop recording when time limit is reached
  $: if ($audioState.timeLimit && mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }

  // Reactive statement for lazy loading PWA Install Prompt
  $: if (browser && $showPwaInstallPrompt && !PwaInstallPrompt && !loadingPwaPrompt) {
    (async () => {
      loadingPwaPrompt = true;
      try {
        const module = await import('./pwa/PwaInstallPrompt.svelte');
        PwaInstallPrompt = module.default;
      } catch (err) {
        console.error('Error loading PWA install prompt:', err);
      } finally {
        loadingPwaPrompt = false;
      }
    })();
  }
</script>

<PageLayout>
  <ContentContainer on:toggleRecording={handleToggleRecording} />

  <!-- RecordButtonWithTimer above the List with reduced spacing -->
  <div class="flex justify-center my-4">
    <RecordButtonWithTimer
      recording={$isRecording}
      transcribing={$isTranscribing}
      clipboardSuccess={$uiState.clipboardSuccess}
      recordingDuration={$recordingDuration}
      progress={$transcriptionProgress}
      on:click={handleToggleRecording}
      on:preload={preloadSpeechModel}
    />
  </div>

  <!-- Swipeable lists container -->
  <div class="mt-2" id="lists-container">
    <SwipeableLists />
  </div>

  <svelte:fragment slot="footer-buttons">
    <FooterComponent
      on:showAbout={showAboutModal}
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
  <svelte:component this={SettingsModal} closeModal={closeSettingsModal} on:close={closeSettingsModal} />
{/if}

<!-- PWA Install Prompt -->
{#if $showPwaInstallPrompt && PwaInstallPrompt && !loadingPwaPrompt}
  <div transition:fade={{ duration: 300 }}>
    <svelte:component
      this={PwaInstallPrompt}
      installPromptEvent={$deferredInstallPrompt}
      on:closeprompt={closePwaInstallPrompt}
    />
  </div>
{/if}
