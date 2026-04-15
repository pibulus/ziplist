<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import AnimatedTitle from './AnimatedTitle.svelte';
  import AudioVisualizer from './audio-transcript/AudioVisualizer.svelte';
  import RecordButtonWithTimer from './audio-transcript/RecordButtonWithTimer.svelte';
  import TranscriptDisplay from './audio-transcript/TranscriptDisplay.svelte';
  import { transcriptionState, transcriptionActions, uiState } from '$lib/services/infrastructure/stores';
  import { transcriptionService } from '$lib/services/transcription/transcriptionService';
  import { audioService } from '$lib/services/audio/audioService';
  import { AUDIO_STATES } from '$lib/services/audio/audioStates';
  import { fade } from 'svelte/transition';

  // Event dispatcher to communicate with parent
  const dispatch = createEventDispatcher();

  // Component state
  let recording = false;
  let transcribing = false;
  let recordingDuration = 0;
  let transcript = '';
  let showTranscript = false;
  let clipboardSuccess = false;

  // Subscribe to stores
  const unsubscribeTranscription = transcriptionState.subscribe(state => {
    transcribing = state.inProgress;
    transcript = state.text;
    showTranscript = state.text !== '' || state.inProgress;
  });

  const unsubscribeUi = uiState.subscribe(state => {
    clipboardSuccess = state.clipboardSuccess;
  });

  const unsubscribeAudio = audioService.state.subscribe(state => {
    recording = state === AUDIO_STATES.RECORDING;
  });

  const unsubscribeTimer = audioService.duration.subscribe(duration => {
    recordingDuration = duration;
  });

  // Handle recording toggle
  async function handleToggleRecording() {
    try {
      if (recording) {
        await audioService.stopRecording();
        const audioBlob = audioService.getAudioBlob();
        if (audioBlob) {
          await transcriptionService.transcribeAudio(audioBlob);
        }
      } else {
        await audioService.startRecording();
      }
    } catch (error) {
      console.error('Recording/Transcription error:', error);
    }
  }

  // Handle copy
  function handleCopy(event) {
    transcriptionService.copyToClipboard(event.detail.text);
  }

  // Handle share
  function handleShare(event) {
    transcriptionService.shareTranscript(event.detail.text);
  }

  onMount(() => {
    return () => {
      unsubscribeTranscription();
      unsubscribeUi();
      unsubscribeAudio();
      unsubscribeTimer();
    };
  });

  // Animation state variables
  let titleAnimationComplete = false;
  let subtitleAnimationComplete = false;

  // Function to handle title animation complete
  function handleTitleAnimationComplete() {
    titleAnimationComplete = true;
    dispatch('titleAnimationComplete');
  }

  // Function to handle subtitle animation complete
  function handleSubtitleAnimationComplete() {
    subtitleAnimationComplete = true;
    dispatch('subtitleAnimationComplete');
  }
</script>

<div class="content-container flex flex-col items-center w-full max-w-2xl mx-auto px-4">
  <AnimatedTitle 
    on:titleAnimationComplete={handleTitleAnimationComplete}
    on:subtitleAnimationComplete={handleSubtitleAnimationComplete}
    on:toggleRecording={handleToggleRecording}
  />

  <div class="w-full mt-8 flex flex-col items-center gap-6">
    {#if recording || transcribing || showTranscript}
      <div class="w-full" transition:fade={{ duration: 300 }}>
        <AudioVisualizer {recording} />
      </div>
    {/if}

    <RecordButtonWithTimer 
      {recording} 
      {transcribing}
      {recordingDuration}
      {clipboardSuccess}
      on:click={handleToggleRecording}
    />

    {#if showTranscript}
      <div class="w-full" transition:fade={{ duration: 400 }}>
        <TranscriptDisplay 
          {transcript}
          on:copy={handleCopy}
          on:share={handleShare}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .content-container {
    min-height: 60vh;
    padding-bottom: 5rem;
  }
</style>