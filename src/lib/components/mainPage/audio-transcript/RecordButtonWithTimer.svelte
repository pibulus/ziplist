<script>
  import { ANIMATION, CTA_PHRASES, COPY_MESSAGES, ZIPLIST_START_PHRASES, ZIPLIST_ADD_PHRASES, getRandomFromArray } from '$lib/constants';
  import { listsService } from '$lib/services/lists/listsService';
  import { activeListItems } from '$lib/services/lists/listsStore';
  import { waveformData } from '$lib/services';
  import { onMount, onDestroy } from 'svelte';
import { fade } from 'svelte/transition';

  export let recording = false;
  export let transcribing = false;
  export let clipboardSuccess = false;
  export let recordingDuration = 0;
  export let isPremiumUser = false;
  export let buttonLabel = '';
  export let progress = 0;

  let recordButtonElement;
  let audioVisualizerElement;
  const WAVE_BAR_COUNT = 12;
  const PULSE_FADE_RATE = 0.05;
  const WAVE_FADE_RATE = 0.9;
  const AUDIO_LEVEL_SENSITIVITY_FACTOR = 35;
  const PULSE_SMOOTHING_FACTOR_OLD = 0.8;
  const PULSE_SMOOTHING_FACTOR_NEW = 0.2;
  const RANDOM_PHRASE_HOVER_UPDATE_CHANCE = 0.3;

  let audioLevel = 0;
  let animationFrameId;
  let pulseIntensity = 0;
  let waveformLevels = Array(WAVE_BAR_COUNT).fill(0);
  const unsubscribeWaveform = waveformData.subscribe(data => {
    if (data && data.length) {
      const sum = data.reduce((acc, val) => acc + val, 0);
      audioLevel = sum / data.length;

      const step = Math.floor(data.length / waveformLevels.length);
      waveformLevels = waveformLevels.map((_, i) => {
        const dataIndex = i * step;
        return Math.min(100, data[dataIndex] || 0);
      });
    }
  });

  function updateVisualization() {
    if (!recording) {
      pulseIntensity = Math.max(0, pulseIntensity - PULSE_FADE_RATE);
      waveformLevels = waveformLevels.map(level => level * WAVE_FADE_RATE);
    } else {
      const targetIntensity = Math.min(1, audioLevel / AUDIO_LEVEL_SENSITIVITY_FACTOR);
      pulseIntensity = pulseIntensity * PULSE_SMOOTHING_FACTOR_OLD + targetIntensity * PULSE_SMOOTHING_FACTOR_NEW;
    }

    if (recordButtonElement) {
      recordButtonElement.style.setProperty('--pulse-intensity', pulseIntensity.toString());

      waveformLevels.forEach((level, i) => {
        recordButtonElement.style.setProperty(`--wave-level-${i}`, `${level}%`);
      });
    }

    animationFrameId = requestAnimationFrame(updateVisualization);
  }

  let hasActiveList = false;
  let currentStartPhrase = getRandomFromArray(ZIPLIST_START_PHRASES);
  let currentAddPhrase = getRandomFromArray(ZIPLIST_ADD_PHRASES);

  const unsubscribe = activeListItems.subscribe(items => {
    const wasActiveList = hasActiveList;
    hasActiveList = items && items.length > 0;

    if (!recording && wasActiveList !== hasActiveList) {
      buttonLabel = hasActiveList ? currentAddPhrase : currentStartPhrase;
    }
  });

  onMount(() => {
    buttonLabel = hasActiveList ? currentAddPhrase : currentStartPhrase;
    updateVisualization();
  });

  onDestroy(() => {
    if (unsubscribeWaveform) unsubscribeWaveform();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (unsubscribe) unsubscribe();
  });

  function updateRandomPhrases() {
    if (ZIPLIST_START_PHRASES.length > 1) {
      let newStartPhrase;
      do {
        newStartPhrase = getRandomFromArray(ZIPLIST_START_PHRASES);
      } while (newStartPhrase === currentStartPhrase);
      currentStartPhrase = newStartPhrase;
    }

    if (ZIPLIST_ADD_PHRASES.length > 1) {
      let newAddPhrase;
      do {
        newAddPhrase = getRandomFromArray(ZIPLIST_ADD_PHRASES);
      } while (newAddPhrase === currentAddPhrase);
      currentAddPhrase = newAddPhrase;
    }
  }
  export function animateButtonPress() {
    if (recordButtonElement) {
      recordButtonElement.classList.remove('button-press');
      void recordButtonElement.offsetWidth;
      recordButtonElement.classList.add('button-press');
      setTimeout(() => {
        if (recordButtonElement) {
          recordButtonElement.classList.remove('button-press');
        }
      }, ANIMATION.BUTTON.PRESS_DURATION);
    }
  }

  function handleKeyDown(event) {
    if ((event.key === 'Enter' || event.key === ' ') && !transcribing) {
      event.preventDefault();
      dispatch('click');
    }
  }

  function getTimeRemaining() {
    const timeLimit = isPremiumUser
      ? ANIMATION.RECORDING.PREMIUM_LIMIT
      : ANIMATION.RECORDING.FREE_LIMIT;
    return timeLimit - recordingDuration;
  }
  $: timeRemaining = getTimeRemaining();
  $: isWarning = timeRemaining <= ANIMATION.RECORDING.WARNING_THRESHOLD;
  $: isDanger = timeRemaining <= ANIMATION.RECORDING.DANGER_THRESHOLD;

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  const LISTENING_PHRASES = [
    'Listening...',
    'Taking notes...',
    'Capturing that...',
    'All ears...',
    'Catching your list...'
  ];

  let currentListeningPhrase = 'Listening...';
  let previousRecordingState = false;

  $: {
    if (recording && !previousRecordingState) {
      currentListeningPhrase = getRandomFromArray(LISTENING_PHRASES);
    }
    previousRecordingState = recording;
  }

  $: buttonLabel = recording ? currentListeningPhrase : (hasActiveList ? currentAddPhrase : currentStartPhrase);

  $: baseButtonClasses = "record-button duration-400 w-[75%] rounded-full transition-all ease-out sm:w-[85%] mx-auto max-w-[420px] px-6 py-5 flex items-center justify-center text-xl font-bold shadow-md focus:outline focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 sm:px-8 sm:py-5 sm:text-xl md:text-2xl text-black";

  $: clipboardSuccessClasses = clipboardSuccess ? "notification-pulse border border-purple-200 bg-purple-50" : "";

  $: progressStyle = recording
    ? `--progress: ${Math.min(recordingDuration / (isPremiumUser ? ANIMATION.RECORDING.PREMIUM_LIMIT : ANIMATION.RECORDING.FREE_LIMIT) * 100, 100)}%`
    : '';

  $: baseStyle = `min-width: 280px; min-height: 64px; transform-origin: center center; position: relative; ${progressStyle}`;
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<div class="fixed-button-container">
  {#if transcribing}
    <div
      class="progress-container h-[64px] w-[75%] max-w-[420px] overflow-hidden rounded-full bg-amber-200 shadow-md shadow-black/10 sm:h-[64px] sm:w-[85%] mx-auto"
      role="progressbar"
      aria-label="Transcription progress"
      aria-valuenow={progress}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="flex items-center justify-center h-full transition-all duration-300 progress-bar bg-gradient-to-r from-amber-400 to-rose-300"
        style="width: {progress}%;"
      >
        <span class="text-white font-bold z-10 relative">Processing...</span>
      </div>
    </div>
  {:else}
  <button
    bind:this={recordButtonElement}
    class="{baseButtonClasses} {clipboardSuccessClasses}"
    class:has-list-button={hasActiveList && !recording}
    class:pulse-subtle={!recording && !hasActiveList && !clipboardSuccess}
    class:recording-active={recording}
    class:audio-reactive={recording}
    class:recording-warning={isWarning && recording}
    class:recording-danger={isDanger && recording}
    style={baseStyle}
    on:click={() => {
      dispatch('click');
      // Only update phrases for next time after a click
      if (!recording) {
        updateRandomPhrases();
      }
    }}
    on:mouseenter={() => {
      dispatch('preload');
      // Don't update phrases on hover to prevent flicker
    }}
    on:keydown={handleKeyDown}
    disabled={transcribing}
    aria-label={recording ? 'Zip Your List' : (hasActiveList ? 'Add to your list' : 'Create a new list')}
    aria-pressed={recording}
    aria-busy={transcribing}
  >
    {#if recording}
      <div class="wave-visualization">
        {#each { length: WAVE_BAR_COUNT } as _, i}
          <div class="wave-bar" style="--index: {i}; --height: var(--wave-level-{i}, 0%);"></div>
        {/each}
      </div>
    {/if}

    <span
      class="cta-text relative inline-flex w-full justify-center items-center whitespace-nowrap transition-all duration-300 ease-out"
      style="letter-spacing: 0.02em;"
    >
      <span
        class="transform transition-all duration-300 ease-out scale-100 opacity-100"
      >
        <span class="button-content relative z-10">
          <span class="flex items-center justify-center relative w-full">
            <span class="cta__label relative z-10 px-1 py-0.5 rounded-lg" class:text-shadow-recording={recording} style="font-size: clamp(1rem, 0.5vw + 0.9rem, 1.25rem); letter-spacing: .02em; text-align: center; width: 100%;">
              {buttonLabel}
            </span>
            <span class="sr-only">
              {#if recording}
                {formatTime(recordingDuration)} of {formatTime(ANIMATION.RECORDING.FREE_LIMIT)}
              {/if}
            </span>
          </span>
        </span>
      </span>
    </span>

    {#if recording}
      <div class="recording-indicator"></div>
    {/if}
  </button>
  {/if}
</div>

<style>
  /* Base button styling */
  .record-button {
    position: relative;
    overflow: hidden;
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.5);
    background-size: 100% 100%;
    background-position: 0% 0%;
    transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
    transition-property: transform, box-shadow, background-image, background-position;
    
    /* Soft tangerine to pink gradient */
    background-image: linear-gradient(
      to right,
      rgba(251, 191, 36, 0.95),
      rgba(249, 168, 212, 0.8)
    );
    
    /* Better default shadow */
    box-shadow: 
      0 4px 6px -1px rgba(251, 191, 36, 0.2),
      0 2px 4px -1px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }
  
  /* Focus state */
  .record-button:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.4), 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  /* Enhanced focus ring for keyboard navigation */
  .record-button:focus-visible {
    outline: 3px solid #ffd65c;
    outline-offset: 2px;
  }
  
  /* Hover state */
  .record-button:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.02);
    box-shadow: 
      0 6px 10px -2px rgba(251, 191, 36, 0.25),
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  
  /* Non-recording hover effect - softer gradient with subtle pink */
  .record-button:not(.recording-active):hover:not(:disabled) {
    background-image: linear-gradient(
      to right,
      rgba(252, 211, 77, 0.9),
      rgba(244, 114, 182, 0.8)
    );
    transform: translateY(-2px);
    box-shadow: 0 8px 15px rgba(251, 191, 36, 0.3);
  }

  /* Styles for when we have an active list - tangerine to pink gradient */
  .has-list-button {
    background-image: linear-gradient(
      to right,
      rgba(251, 191, 36, 0.95),
      rgba(244, 114, 182, 0.7)
    );
  }

  .has-list-button:hover:not(:disabled) {
    background-image: linear-gradient(
      to right,
      rgba(251, 191, 36, 1),
      rgba(236, 72, 153, 0.8)
    );
  }

  /* Audio visualization pulse effect - Enhanced */
  .record-button {
    position: relative;
    --pulse-intensity: 0;
  }

  .record-button::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: inherit;
    background: radial-gradient(
      circle at center,
      rgba(251, 146, 60, calc(0.5 * var(--pulse-intensity))),
      rgba(249, 168, 212, calc(0.7 * var(--pulse-intensity))),
      rgba(251, 191, 36, 0)
    );
    opacity: calc(0.9 * var(--pulse-intensity));
    z-index: 1; /* Increased z-index to make it more visible */
    transition: opacity 0.1s ease-out;
    pointer-events: none;
  }

  /* Enhanced glow effect during recording */
  .recording-active::before {
    box-shadow:
      0 0 calc(20px * var(--pulse-intensity)) calc(8px * var(--pulse-intensity)) rgba(249, 168, 212, calc(0.5 * var(--pulse-intensity))),
      0 0 calc(15px * var(--pulse-intensity)) calc(5px * var(--pulse-intensity)) rgba(251, 191, 36, calc(0.6 * var(--pulse-intensity)));
  }
  
  /* Active/pressed state */
  .record-button:active:not(:disabled) {
    transform: translateY(1px) scale(0.98);
    box-shadow: 
      0 2px 4px -1px rgba(251, 191, 36, 0.15),
      0 1px 2px -1px rgba(0, 0, 0, 0.1),
      inset 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  /* Non-recording active effect */
  .record-button:not(.recording-active):active:not(:disabled) {
    background-image: linear-gradient(
      to right,
      rgba(245, 158, 11, 1),
      rgba(234, 88, 12, 0.95)
    );
  }
  
  /* Button press animation */
  .button-press {
    animation: button-press 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
  }
  
  @keyframes button-press {
    0% {
      transform: scale(1);
    }
    35% {
      transform: scale(0.98);
      background-color: #f59e0b;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    75% {
      transform: scale(1.01);
      background-color: #fbbf24;
    }
    100% {
      transform: scale(1);
      background-color: #fbbf24;
    }
  }
  
  /* Subtle breathing glow for button */
  .pulse-subtle {
    animation: button-breathe 3.5s ease-in-out infinite;
    transform-origin: center;
  }
  
  @keyframes button-breathe {
    0%, 100% {
      box-shadow: 0 0 12px 2px rgba(251, 191, 36, 0.35);
      transform: scale(1);
    }
    50% {
      box-shadow: 0 0 20px 6px rgba(251, 191, 36, 0.5);
      transform: scale(1.02);
    }
  }
  
  /* Notification pulse animation */
  .notification-pulse {
    animation: notification-glow 2.5s ease-in-out infinite;
    transform-origin: center;
    box-shadow: 
      0 0 15px 3px rgba(139, 92, 246, 0.2),
      0 0 5px 1px rgba(139, 92, 246, 0.1);
    background-image: linear-gradient(
      to bottom,
      rgba(250, 245, 255, 0.9),
      rgba(237, 233, 254, 0.9)
    );
    border: 1px solid rgba(167, 139, 250, 0.3);
  }
  
  @keyframes notification-glow {
    0%, 100% {
      box-shadow: 
        0 0 10px 1px rgba(139, 92, 246, 0.2),
        0 0 3px 0px rgba(139, 92, 246, 0.1);
      transform: scale(1);
    }
    50% {
      box-shadow: 
        0 0 18px 4px rgba(139, 92, 246, 0.3),
        0 0 8px 2px rgba(139, 92, 246, 0.15);
      transform: scale(1.003);
    }
  }
  
  /* Progress bar styling */
  .progress-container {
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  
  .progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    transition: width 0.3s ease;
    animation: pulse-glow 1.5s infinite ease-in-out;
  }
  
  @keyframes pulse-glow {
    0% {
      box-shadow: inset 0 0 5px rgba(255, 190, 60, 0.5);
    }
    50% {
      box-shadow: inset 0 0 15px rgba(255, 190, 60, 0.8);
    }
    100% {
      box-shadow: inset 0 0 5px rgba(255, 190, 60, 0.5);
    }
  }
  
  /* Whole-button progress indicator - Enhanced with softer, pinker gradient */
  .recording-active {
    position: relative;
    overflow: hidden;

    /* Soft tangerine to pink gradient for recording state */
    background-image:
      linear-gradient(to right,
        rgba(251, 191, 36, 0.9),
        rgba(251, 191, 36, 0.9) var(--progress, 0%),
        rgba(249, 168, 212, 0.7) calc(var(--progress, 0%) + 0.5%),
        rgba(244, 114, 182, 0.5) 100%
      ),
      /* Subtle noise texture overlay */
      url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.07'/%3E%3C/svg%3E");

    background-size: 100% 100%;
    box-shadow:
      0 4px 15px -1px rgba(251, 191, 36, 0.35),
      inset 0 0 10px rgba(251, 191, 36, 0.2),
      0 0 20px rgba(251, 191, 36, 0.2);
    border: 1px solid rgba(251, 191, 36, 0.3);
    /* Smoother & faster transitions for clearer state changes */
    transition:
      background-image 0.3s ease-out,
      box-shadow 0.3s ease-out,
      border 0.3s ease-out,
      transform 0.2s ease;
  }

  /* Audio reactive styling */
  .audio-reactive {
    z-index: 1;
  }

  .audio-reactive .cta-text, .audio-reactive .cta__label {
    position: relative;
    z-index: 5; /* Increased z-index for text to appear above effects */
  }
  
  /* Warning/danger gradients - tangerine with pink accents */
  .recording-warning {
    background-image: linear-gradient(to right, 
      rgb(251, 191, 36) var(--progress, 0%), 
      rgba(251, 191, 36, 0.7) var(--progress, 0%), 
      rgba(249, 168, 212, 0.6) 100%
    );
    box-shadow:
      0 4px 15px -1px rgba(251, 191, 36, 0.3),
      inset 0 0 10px rgba(251, 191, 36, 0.2),
      0 0 20px rgba(251, 191, 36, 0.2);
  }
  
  .recording-danger {
    background-image: linear-gradient(to right, 
      rgb(251, 191, 36) var(--progress, 0%), 
      rgba(251, 191, 36, 0.7) var(--progress, 0%), 
      rgba(244, 114, 182, 0.7) 100%
    );
    box-shadow:
      0 4px 15px -1px rgba(244, 114, 182, 0.3),
      inset 0 0 10px rgba(244, 114, 182, 0.2),
      0 0 20px rgba(244, 114, 182, 0.2);
    animation: danger-pulse 1s infinite alternate ease-in-out;
  }
  
  @keyframes danger-pulse {
    0% {
      box-shadow:
        0 4px 15px -1px rgba(244, 114, 182, 0.3),
        inset 0 0 10px rgba(244, 114, 182, 0.2),
        0 0 20px rgba(244, 114, 182, 0.2);
    }
    100% {
      box-shadow:
        0 4px 15px -1px rgba(244, 114, 182, 0.4),
        inset 0 0 15px rgba(244, 114, 182, 0.25),
        0 0 25px rgba(244, 114, 182, 0.25);
    }
  }
  
  .button-content {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Enhanced text visibility when recording */
  .text-shadow-recording {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 0 1px rgba(0, 0, 0, 0.1);
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-in-out;
  }
  
  /* Responsive adjustments for mobile */
  @media (max-width: 640px) {
    .button-content {
      font-size: 0.95em;
    }

    .timer-display {
      font-size: 0.9em;
    }
  }

  /* Wave visualization styles - Enhanced for better visibility */
  .wave-visualization {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 70%;
    display: flex;
    justify-content: space-evenly;
    align-items: flex-end;
    padding: 0 20px;
    pointer-events: none;
    z-index: 3; /* Increased z-index to appear above the pulse glow */
    overflow: hidden;
  }

  .wave-bar {
    width: 5px; /* Slightly wider for better visibility */
    height: var(--height, 0%);
    max-height: 80%;
    background: linear-gradient(to top, 
      rgba(255, 255, 255, 0.95), 
      rgba(255, 255, 255, 0.4)
    );
    border-radius: 2px 2px 0 0;
    transition: height 0.05s ease-out;
    animation: wave-animation 0.5s infinite alternate ease-in-out;
    animation-delay: calc(var(--index) * 0.1s);
    opacity: 0.9; /* Higher opacity for better visibility */
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.6); /* Enhanced glow around bars */
    transform-origin: bottom;
  }

  @keyframes wave-animation {
    0% {
      transform: scaleY(0.95);
    }
    100% {
      transform: scaleY(1.05);
    }
  }
  
  /* Fixed button container for consistent spacing and positioning */
  .fixed-button-container {
    display: flex;
    justify-content: center;
    width: 100%;
    height: 70px; /* Fixed height to prevent layout shifts */
    position: relative;
    margin: 1rem 0;
    z-index: 5; /* Ensure it stays on top during transitions */
  }
  
  /* Recording indicator - more noticeable pulsing dot */
  .recording-indicator {
    position: absolute;
    top: 50%;
    right: 28px;
    transform: translateY(-50%);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: linear-gradient(145deg, #f9a8d4, #ec4899);
    box-shadow: 0 0 12px rgba(236, 72, 153, 0.9);
    animation: recording-pulse 1.5s infinite ease-in-out;
    z-index: 10;
  }
  
  @keyframes recording-pulse {
    0%, 100% {
      opacity: 1;
      transform: translateY(-50%) scale(1);
      box-shadow: 0 0 8px rgba(236, 72, 153, 0.9);
    }
    50% {
      opacity: 1;
      transform: translateY(-50%) scale(1.4);
      box-shadow: 0 0 15px rgba(236, 72, 153, 1);
    }
  }
</style>