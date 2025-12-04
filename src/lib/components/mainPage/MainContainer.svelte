<script>
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  import ContentContainer from './ContentContainer.svelte';
  import FooterComponent from './FooterComponent.svelte';
  import { geminiService } from '$lib/services/geminiService';
  import { themeService } from '$lib/services/theme';
  import { modalService } from '$lib/services/modals';
  import { transcriptionService } from '$lib/services/transcription/transcriptionService.js';
  import { firstVisitService, isFirstVisit } from '$lib/services/first-visit';
  import { pwaService, deferredInstallPrompt, showPwaInstallPrompt } from '$lib/services/pwa';
  import {
    isRecording,
    isTranscribing,
    transcriptionProgress,
    recordingDuration,
    audioState,
    audioActions,
    uiState,
    uiActions,
    userPreferences
  } from '$lib/services/infrastructure/stores.js';
  import { AudioStates } from '$lib/services/audio/audioStates.js';
  import { ghostStateStore } from '$lib/components/ghost/stores/ghostStateStore.js';
  import { PageLayout } from '$lib/components/layout';
  import { listsStore } from '$lib/services/lists/listsStore';
  import SwipeableLists from '../list/SwipeableLists.svelte';
  import RecordButtonWithTimer from './audio-transcript/RecordButtonWithTimer.svelte';
  import { fade } from 'svelte/transition';
  import { StorageUtils } from '$lib/services/infrastructure/storageUtils';
  import { STORAGE_KEYS } from '$lib/constants';

  import { AboutModal, ExtensionModal, IntroModal } from './modals';

  // Lazy load settings modal - only import when needed
  let SettingsModal;
  let loadingSettingsModal = false;

  // PWA Install Prompt component - lazy loaded
  let PwaInstallPrompt;
  let loadingPwaPrompt = false;

  let speechModelPreloaded = false;
  let mediaRecorder = null;
  let audioChunks = [];

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

      // Log available prompt styles
      const availableStyles = geminiService.getAvailableStyles();

      geminiService
        .preloadModel()
        .then(() => {
        })
        .catch((err) => {
          // Just log the error, don't block UI
          console.error('Error preloading speech model:', err);
          // Reset so we can try again
          speechModelPreloaded = false;
        });
    } else if (speechModelPreloaded) {
    }
  }

  // Handle toggle recording from ghost
  async function handleToggleRecording() {

    if ($isRecording) {
      // Currently recording, so stop
      ghostStateStore.setRecording(false); // Visually stop ghost recording animations
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); // This will trigger onstop handler
        // audioActions.updateState will be called in onstop
      } else {
        // Fallback if mediaRecorder state is inconsistent
        audioActions.updateState(AudioStates.IDLE);
      }
    } else {
      // Not recording, so start
      ghostStateStore.setRecording(true); // Visually start ghost recording animations
      audioChunks = []; // Clear previous chunks

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error('getUserMedia not supported on this browser!');
          ghostStateStore.setRecording(false);
          audioActions.updateState(AudioStates.ERROR, 'getUserMedia is not supported.');
          uiActions.setErrorMessage('Audio recording is not supported on this browser.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.onstart = () => {
          audioActions.updateState(AudioStates.RECORDING);
        };

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          audioActions.updateState(AudioStates.PROCESSING); // Indicate processing starts
          
          const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          audioChunks = [];

          if (audioBlob.size === 0) {
            audioActions.updateState(AudioStates.IDLE);
            return;
          }

          try {
            await transcriptionService.transcribeAudio(audioBlob);
          } catch (transcriptionError) {
            console.error('Transcription failed in onstop:', transcriptionError);
          } finally {
            stream.getTracks().forEach(track => track.stop());
            if (get(audioState).state === AudioStates.PROCESSING) {
              audioActions.updateState(AudioStates.IDLE);
            }
          }
        };
        
        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event.error);
          ghostStateStore.setRecording(false);
          audioActions.updateState(AudioStates.ERROR, event.error.message || 'MediaRecorder error');
          uiActions.setErrorMessage(`Recording error: ${event.error.name}`);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();

      } catch (err) {
        console.error('Error starting recording (getUserMedia or MediaRecorder setup):', err);
        ghostStateStore.setRecording(false); // Revert visual state
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

  // Function to trigger ghost click
  function triggerGhostClick() {
    // Forward to the toggle recording handler
    handleToggleRecording();
  }

  function closePwaInstallPrompt() {
    pwaService.dismissPrompt();
  }

  // Lifecycle hooks
  onMount(() => {
    // Initialize lists store from localStorage
    listsStore.initialize();
    
    // Preload speech model on mount
    preloadSpeechModel();

    // Pre-load the SettingsModal component after a short delay
    setTimeout(async () => {
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
    }, 1000);

    // Check for auto-record setting and start recording if enabled
    if (browser && StorageUtils.getBooleanItem(STORAGE_KEYS.AUTO_RECORD, false)) {
      // Wait minimal time for component initialization
      setTimeout(() => {
        if (!$isRecording) { // Check store directly
          handleToggleRecording(); // Use the main toggle function
        } else {
        }
      }, 500);
    } else {
    }

    // Listen for settings changes
    if (browser) {
      window.addEventListener('ziplist-setting-changed', (event) => {
        if (event.detail && event.detail.setting === 'autoRecord') {
          // No immediate action needed, setting will apply on next page load/refresh
        }

        if (event.detail && event.detail.setting === 'promptStyle') {
          // Update the prompt style in the service
          geminiService.setPromptStyle(event.detail.value);
        }
      });
    }

    // Check if first visit to show intro
    firstVisitService.showIntroModal();
  });

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
  <ContentContainer />

  <!-- RecordButtonWithTimer above the List with reduced spacing -->
  <div class="flex justify-center my-4">
    <RecordButtonWithTimer
      recording={$isRecording}
      transcribing={$isTranscribing}
      clipboardSuccess={$uiState.clipboardSuccess}
      recordingDuration={$recordingDuration}
      isPremiumUser={$userPreferences.isPremiumUser}
      progress={$transcriptionProgress}
      on:click={handleToggleRecording}
      on:preload={preloadSpeechModel}
    />
  </div>

  <!-- Swipeable lists container -->
  <div class="mt-2">
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
  {triggerGhostClick}
/>

<!-- Settings Modal - lazy loaded -->
{#if SettingsModal}
  <!-- Pass the close function down to the component -->
  <svelte:component this={SettingsModal} on:close={closeSettingsModal} />
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