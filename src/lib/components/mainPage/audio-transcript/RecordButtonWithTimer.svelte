<script>
  import { ANIMATION, CTA_PHRASES, COPY_MESSAGES, ZIPLIST_START_PHRASES, ZIPLIST_ADD_PHRASES, getRandomFromArray } from '$lib/constants';
  import { listsService } from '$lib/services/lists/listsService';
  import { activeListItems } from '$lib/services/lists/listsStore';
  import { waveformData } from '$lib/services';
  import { onMount, onDestroy } from 'svelte';

  // Props
  export let recording = false;
  export let transcribing = false;
  export let clipboardSuccess = false;
  export let recordingDuration = 0;
  export let isPremiumUser = false;
  export let buttonLabel = ZIPLIST_START_PHRASES[0];
  export let progress = 0; // For transcription progress

  // Element refs
  let recordButtonElement;
  let audioVisualizerElement;

  // Visualization constants
  const WAVE_BAR_COUNT = 12;
  const PULSE_FADE_RATE = 0.05;
  const WAVE_FADE_RATE = 0.9;
  const AUDIO_LEVEL_SENSITIVITY_FACTOR = 35; // Lower is more sensitive
  const PULSE_SMOOTHING_FACTOR_OLD = 0.8; // Weight of current intensity
  const PULSE_SMOOTHING_FACTOR_NEW = 0.2; // Weight of new audio level
  const RANDOM_PHRASE_HOVER_UPDATE_CHANCE = 0.3;

  // Audio visualization state
  let audioLevel = 0;
  let animationFrameId;
  let pulseIntensity = 0;
  let waveformLevels = Array(WAVE_BAR_COUNT).fill(0); // For wave bars visualization

  // Subscribe to waveform data for visualization
  const unsubscribeWaveform = waveformData.subscribe(data => {
    if (data && data.length) {
      // Calculate average level for pulse effect
      const sum = data.reduce((acc, val) => acc + val, 0);
      audioLevel = sum / data.length;

      // Update waveform levels for wave bars
      // Sample a subset of the frequency data for our visualization bars
      const step = Math.floor(data.length / waveformLevels.length);
      waveformLevels = waveformLevels.map((_, i) => {
        const dataIndex = i * step;
        return Math.min(100, data[dataIndex] || 0); // Scale to max 100%
      });
    }
  });

  // Audio visualization animation
  function updateVisualization() {
    if (!recording) {
      // Fade out when not recording
      pulseIntensity = Math.max(0, pulseIntensity - PULSE_FADE_RATE);
      waveformLevels = waveformLevels.map(level => level * WAVE_FADE_RATE); // Fade out bars
    } else {
      // Smooth the audio level changes for more natural animation
      const targetIntensity = Math.min(1, audioLevel / AUDIO_LEVEL_SENSITIVITY_FACTOR);
      pulseIntensity = pulseIntensity * PULSE_SMOOTHING_FACTOR_OLD + targetIntensity * PULSE_SMOOTHING_FACTOR_NEW;
    }

    // Apply the visualization effect when element exists
    if (recordButtonElement) {
      recordButtonElement.style.setProperty('--pulse-intensity', pulseIntensity.toString());

      // Update wave bars CSS custom properties
      waveformLevels.forEach((level, i) => {
        recordButtonElement.style.setProperty(`--wave-level-${i}`, `${level}%`);
      });
    }

    // Continue animation
    animationFrameId = requestAnimationFrame(updateVisualization);
  }

  // Local state
  let hasActiveList = false;
  let currentStartPhrase = ZIPLIST_START_PHRASES[0];
  let currentAddPhrase = ZIPLIST_ADD_PHRASES[0];

  // Initialize random phrases on mount
  onMount(() => {
    updateRandomPhrases();
    // Start visualization animation
    updateVisualization();
  });

  // Clean up on component destroy
  onDestroy(() => {
    if (unsubscribeWaveform) unsubscribeWaveform();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  });

  // Subscribe to active list items to detect if we have a list
  const unsubscribe = activeListItems.subscribe(items => {
    hasActiveList = items && items.length > 0;
    // Update button label based on list state if not recording
    if (!recording) {
      buttonLabel = hasActiveList ? currentAddPhrase : currentStartPhrase;
    }
  });

  // Get random phrases for both states
  function updateRandomPhrases() {
    // Safely get a new start phrase different from the current one
    if (ZIPLIST_START_PHRASES.length > 1) {
      let newStartPhrase;
      do {
        newStartPhrase = getRandomFromArray(ZIPLIST_START_PHRASES);
      } while (newStartPhrase === currentStartPhrase);
      currentStartPhrase = newStartPhrase;
    }

    // Safely get a new add phrase different from the current one
    if (ZIPLIST_ADD_PHRASES.length > 1) {
      let newAddPhrase;
      do {
        newAddPhrase = getRandomFromArray(ZIPLIST_ADD_PHRASES);
      } while (newAddPhrase === currentAddPhrase);
      currentAddPhrase = newAddPhrase;
    }

    // Update button label if not recording
    if (!recording) {
      buttonLabel = hasActiveList ? currentAddPhrase : currentStartPhrase;
    }
  }

  // Handlers
  export function animateButtonPress() {
    if (recordButtonElement) {
      recordButtonElement.classList.remove('button-press');
      void recordButtonElement.offsetWidth; // Force reflow
      recordButtonElement.classList.add('button-press');
      setTimeout(() => {
        if (recordButtonElement) {
          recordButtonElement.classList.remove('button-press');
        }
      }, ANIMATION.BUTTON.PRESS_DURATION);
    }
  }

  function handleKeyDown(event) {
    // Space or Enter key to toggle recording when focused
    if ((event.key === 'Enter' || event.key === ' ') && !transcribing) {
      event.preventDefault(); // Prevent default space/enter behavior
      dispatch('click');
    }
  }

  // Calculate time remaining
  function getTimeRemaining() {
    const timeLimit = isPremiumUser
      ? ANIMATION.RECORDING.PREMIUM_LIMIT
      : ANIMATION.RECORDING.FREE_LIMIT;
    return timeLimit - recordingDuration;
  }

  // Reactive variables for timer states
  $: timeRemaining = getTimeRemaining();
  $: isWarning = timeRemaining <= ANIMATION.RECORDING.WARNING_THRESHOLD;
  $: isDanger = timeRemaining <= ANIMATION.RECORDING.DANGER_THRESHOLD;

  // Format timer display (MM:SS)
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Update button label based on recording state and active list
  $: buttonLabel = recording ? 'Stop Recording' : (hasActiveList ? currentAddPhrase : currentStartPhrase);

  // Compute CSS classes reactively for better organization
  $: baseButtonClasses = "record-button duration-400 w-[75%] rounded-full transition-all ease-out sm:w-[85%] mx-auto max-w-[420px] px-6 py-5 text-center text-xl font-bold shadow-md focus:outline focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 sm:px-8 sm:py-5 sm:text-xl md:text-2xl text-black";
  
  // CSS classes for clipboard success state
  $: clipboardSuccessClasses = clipboardSuccess ? "notification-pulse border border-purple-200 bg-purple-50" : "";
  
  // Progress tracking style for recording state
  $: progressStyle = recording 
    ? `--progress: ${Math.min(recordingDuration / (isPremiumUser ? ANIMATION.RECORDING.PREMIUM_LIMIT : ANIMATION.RECORDING.FREE_LIMIT) * 100, 100)}%` 
    : '';
  
  // Base button style with fixed dimensions and positioning
  $: baseStyle = `min-width: 280px; min-height: 64px; transform-origin: center center; position: relative; ${progressStyle}`;

  // Event handling
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

{#if transcribing}
  <div
    class="progress-container relative h-[64px] w-[75%] max-w-[420px] overflow-hidden rounded-full bg-amber-200 shadow-md shadow-black/10 sm:h-[64px] sm:w-[85%] mx-auto"
    role="progressbar"
    aria-label="Transcription progress"
    aria-valuenow={progress}
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div
      class="flex items-center justify-center h-full transition-all duration-300 progress-bar bg-gradient-to-r from-amber-400 to-rose-300"
      style="width: {progress}%;"
    ></div>
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
    on:click={() => dispatch('click')}
    on:mouseenter={() => {
      dispatch('preload');
      if (!recording && Math.random() < RANDOM_PHRASE_HOVER_UPDATE_CHANCE) {
        updateRandomPhrases();
      }
    }}
    on:keydown={handleKeyDown}
    disabled={transcribing}
    aria-label={recording ? 'Stop Recording' : (hasActiveList ? 'Add to your list' : 'Create a new list')}
    aria-pressed={recording}
    aria-busy={transcribing}
  >
    <!-- Wave bars visualization - only shown when recording -->
    {#if recording}
      <div class="wave-visualization">
        {#each { length: WAVE_BAR_COUNT } as _, i}
          <div class="wave-bar" style="--index: {i}; --height: var(--wave-level-{i}, 0%);"></div>
        {/each}
      </div>
    {/if}

    <!-- Main button text -->
    <span
      class="cta-text relative inline-block whitespace-nowrap transition-all duration-300 ease-out"
      style="letter-spacing: 0.02em;"
    >
      <!-- Button label with integrated timer -->
      <span
        class="transform transition-all duration-300 ease-out scale-100 opacity-100"
      >
        <span class="button-content relative z-10">
          <!-- Main label - the button text is on top of the progress bar -->
          <span class="flex items-center justify-center relative">
            <span class="cta__label relative z-10 px-1 py-0.5 rounded-lg" class:text-shadow-recording={recording} style="font-size: clamp(1rem, 0.5vw + 0.9rem, 1.25rem); letter-spacing: .02em;">
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
  </button>
{/if}

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
    
    /* Enhanced default gradient */
    background-image: linear-gradient(
      to right,
      rgba(251, 191, 36, 1),
      rgba(245, 158, 11, 0.96)
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
  
  /* Non-recording hover effect */
  .record-button:not(.recording-active):hover:not(:disabled) {
    background-image: linear-gradient(
      to right,
      rgba(252, 211, 77, 1),
      rgba(251, 191, 36, 1)
    );
  }

  /* Styles for when we have an active list */
  .has-list-button {
    background-image: linear-gradient(
      to right,
      rgba(251, 191, 36, 0.95),
      rgba(251, 113, 133, 0.6)
    );
  }

  .has-list-button:hover:not(:disabled) {
    background-image: linear-gradient(
      to right,
      rgba(251, 146, 60, 0.95),
      rgba(244, 114, 182, 0.7)
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
  
  /* Whole-button progress indicator - Enhanced */
  .recording-active {
    position: relative;
    overflow: hidden;

    /* Bright golden glow for normal recording state */
    background-image:
      linear-gradient(to right,
        rgba(251, 191, 36, 1),
        rgba(251, 191, 36, 1) var(--progress, 0%),
        rgba(251, 191, 36, 0.5) calc(var(--progress, 0%) + 0.5%),
        rgba(245, 158, 11, 0.4) 100%
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
  
  /* Simple warning/danger gradients - Enhanced with better visibility */
  .recording-warning {
    background-image: linear-gradient(to right, 
      rgb(251, 146, 60) var(--progress, 0%), 
      rgba(251, 146, 60, 0.6) var(--progress, 0%), 
      rgba(234, 88, 12, 0.4) 100%
    );
    box-shadow:
      0 4px 15px -1px rgba(251, 146, 60, 0.4),
      inset 0 0 10px rgba(251, 146, 60, 0.25),
      0 0 20px rgba(251, 146, 60, 0.25);
  }
  
  .recording-danger {
    background-image: linear-gradient(to right, 
      rgb(239, 68, 68) var(--progress, 0%), 
      rgba(239, 68, 68, 0.6) var(--progress, 0%), 
      rgba(220, 38, 38, 0.4) 100%
    );
    box-shadow:
      0 4px 15px -1px rgba(239, 68, 68, 0.4),
      inset 0 0 10px rgba(239, 68, 68, 0.25),
      0 0 20px rgba(239, 68, 68, 0.25);
    animation: danger-pulse 1s infinite alternate ease-in-out;
  }
  
  @keyframes danger-pulse {
    0% {
      box-shadow:
        0 4px 15px -1px rgba(239, 68, 68, 0.4),
        inset 0 0 10px rgba(239, 68, 68, 0.25),
        0 0 20px rgba(239, 68, 68, 0.25);
    }
    100% {
      box-shadow:
        0 4px 15px -1px rgba(239, 68, 68, 0.5),
        inset 0 0 15px rgba(239, 68, 68, 0.3),
        0 0 25px rgba(239, 68, 68, 0.3);
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
</style>