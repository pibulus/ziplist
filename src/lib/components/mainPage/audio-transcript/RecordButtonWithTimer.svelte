<script>
  import {
    ANIMATION,
    ZIPLIST_START_PHRASES,
    ZIPLIST_ADD_PHRASES,
    getRandomFromArray,
  } from "$lib/constants";
  import { activeListItems } from "$lib/services/lists/listsStore";
  import { waveformData } from "$lib/services/infrastructure";
  import { onMount, onDestroy } from "svelte";
  import { createEventDispatcher } from "svelte";

  export let recording = false;
  export let transcribing = false;
  export let disabled = false;
  export let clipboardSuccess = false;
  export let recordingDuration = 0;
  export let buttonLabel = "";
  export let progress = 0;

  let recordButtonElement;
  const WAVE_BAR_COUNT = 12;
  const PULSE_FADE_RATE = 0.05;
  const WAVE_FADE_RATE = 0.9;
  const AUDIO_LEVEL_SENSITIVITY_FACTOR = 35;
  const PULSE_SMOOTHING_FACTOR_OLD = 0.8;
  const PULSE_SMOOTHING_FACTOR_NEW = 0.2;
  const waveBars = Array.from({ length: WAVE_BAR_COUNT }, (_, index) => index);

  let audioLevel = 0;
  let animationFrameId;
  let pressAnimationTimeout = null;
  let pulseIntensity = 0;
  let waveformLevels = Array(WAVE_BAR_COUNT).fill(0);
  const unsubscribeWaveform = waveformData.subscribe((data) => {
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
      waveformLevels = waveformLevels.map((level) => level * WAVE_FADE_RATE);
    } else {
      const targetIntensity = Math.min(
        1,
        audioLevel / AUDIO_LEVEL_SENSITIVITY_FACTOR,
      );
      pulseIntensity =
        pulseIntensity * PULSE_SMOOTHING_FACTOR_OLD +
        targetIntensity * PULSE_SMOOTHING_FACTOR_NEW;
    }

    if (recordButtonElement) {
      recordButtonElement.style.setProperty(
        "--pulse-intensity",
        pulseIntensity.toString(),
      );

      waveformLevels.forEach((level, i) => {
        recordButtonElement.style.setProperty(`--wave-level-${i}`, `${level}%`);
      });
    }

    animationFrameId = requestAnimationFrame(updateVisualization);
  }

  let hasActiveList = false;
  let currentStartPhrase = getRandomFromArray(ZIPLIST_START_PHRASES);
  let currentAddPhrase = getRandomFromArray(ZIPLIST_ADD_PHRASES);

  const unsubscribe = activeListItems.subscribe((items) => {
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
    clearPressAnimationTimeout();
  });

  // talktype's pattern: one tracked press timeout, cleared on re-press and
  // on destroy — never a raw setTimeout that can outlive the component.
  function clearPressAnimationTimeout() {
    if (pressAnimationTimeout) {
      clearTimeout(pressAnimationTimeout);
      pressAnimationTimeout = null;
    }
  }

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
      clearPressAnimationTimeout();
      recordButtonElement.classList.remove("button-press");
      void recordButtonElement.offsetWidth;
      recordButtonElement.classList.add("button-press");
      pressAnimationTimeout = setTimeout(() => {
        if (recordButtonElement) {
          recordButtonElement.classList.remove("button-press");
        }
        pressAnimationTimeout = null;
      }, ANIMATION.BUTTON.PRESS_DURATION);
    }
  }

  function getTimeRemaining() {
    return ANIMATION.RECORDING.LIMIT - recordingDuration;
  }
  $: timeRemaining = getTimeRemaining();
  $: isWarning = timeRemaining <= ANIMATION.RECORDING.WARNING_THRESHOLD;
  $: isDanger = timeRemaining <= ANIMATION.RECORDING.DANGER_THRESHOLD;

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  const LISTENING_PHRASES = [
    "Listening...",
    "Taking notes...",
    "Capturing that...",
    "All ears...",
    "Catching your list...",
  ];

  let currentListeningPhrase = "Listening...";
  let previousRecordingState = false;

  $: {
    if (recording && !previousRecordingState) {
      currentListeningPhrase = getRandomFromArray(LISTENING_PHRASES);
    }
    previousRecordingState = recording;
  }

  $: buttonLabel = recording
    ? currentListeningPhrase
    : hasActiveList
      ? currentAddPhrase
      : currentStartPhrase;
  $: recordButtonAriaLabel = recording
    ? `${buttonLabel}. Stop recording. ${formatTime(recordingDuration)} recorded`
    : hasActiveList
      ? `${buttonLabel}. Add to your list`
      : `${buttonLabel}. Create a new list`;

  $: baseButtonClasses =
    "record-button duration-400 w-[75%] rounded-full transition-all ease-out sm:w-[85%] mx-auto max-w-[380px] px-6 py-4 flex items-center justify-center text-xl font-bold shadow-md sm:px-8 sm:py-5 sm:text-xl md:text-2xl text-black";

  $: clipboardSuccessClasses = clipboardSuccess
    ? "notification-pulse border border-purple-200 bg-purple-50"
    : "";

  $: progressStyle = recording
    ? `--progress: ${Math.min((recordingDuration / ANIMATION.RECORDING.LIMIT) * 100, 100)}%`
    : "";

  $: baseStyle = `min-width: min(260px, 88vw); min-height: 62px; transform-origin: center center; position: relative; ${progressStyle}`;
  const dispatch = createEventDispatcher();
</script>

<div class="fixed-button-container">
  {#if transcribing}
    <div
      class="progress-container h-[64px] w-[75%] max-w-[420px] overflow-hidden rounded-full shadow-md shadow-black/10 sm:h-[64px] sm:w-[85%] mx-auto"
      role="progressbar"
      aria-label="List-making progress"
      aria-valuenow={progress}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuetext={`Making list ${Math.round(progress)} percent complete`}
      >
        <div
        class="flex items-center justify-center h-full transition-all duration-300 progress-bar"
        style="width: {progress}%;"
      >
        <span class="text-white font-bold z-10 relative">Ziplisting...</span>
      </div>
    </div>
  {:else}
    <button
      bind:this={recordButtonElement}
      class="{baseButtonClasses} {clipboardSuccessClasses}"
      class:pulse-subtle={!recording && !hasActiveList && !clipboardSuccess}
      class:recording-active={recording}
      class:audio-reactive={recording}
      class:recording-warning={isWarning && recording}
      class:recording-danger={isDanger && recording}
      style={baseStyle}
      data-record-button
      on:click={() => {
        dispatch("click");
        // Only update phrases for next time after a click
        if (!recording) {
          updateRandomPhrases();
        }
      }}
      on:pointerdown={() => dispatch("preload")}
      on:mouseenter={() => {
        dispatch("preload");
        // Don't update phrases on hover to prevent flicker
      }}
      disabled={disabled || transcribing}
      aria-label={recordButtonAriaLabel}
      aria-pressed={recording}
      aria-busy={disabled || transcribing}
    >
      {#if recording}
        <div class="wave-visualization" aria-hidden="true">
          {#each waveBars as i}
            <div
              class="wave-bar"
              style="--index: {i}; --height: var(--wave-level-{i}, 0%);"
            ></div>
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
              <span
                class="cta__label relative z-10 px-1 py-0.5 rounded-lg"
                class:text-shadow-recording={recording}
                style="font-size: clamp(1.05rem, 0.4vw + 1rem, 1.2rem); letter-spacing: .02em; text-align: center; width: 100%;"
              >
                {buttonLabel}
              </span>
              <span class="sr-only">
                {#if recording}
                  {formatTime(recordingDuration)} of {formatTime(
                    ANIMATION.RECORDING.LIMIT,
                  )}
                {/if}
              </span>
            </span>
          </span>
        </span>
      </span>

      {#if recording}
        <div class="recording-indicator" aria-hidden="true"></div>
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
    transition-property:
      transform, box-shadow, background-image, background-position;

    /* Flat brand yellow — the voice button is the same in every theme,
       like the cream ground. Juice comes from motion and glow. */
    background-color: var(--zl-cta-color, #ffb000);

    /* Better default shadow */
    box-shadow:
      0 4px 6px -1px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.2),
      0 2px 4px -1px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  /* Spring Bounce Animation */
  @keyframes springBounce {
    0% {
      transform: scale(1);
    }
    30% {
      transform: scale(1.25);
    }
    50% {
      transform: scale(0.9);
    }
    70% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
    }
  }

  /* Neo-brutalist button override */
  :global(html.mode-neo-brutalist) .record-button {
    background-image: none;
    background-color: var(--zl-cta-color, #ffb000);
    border: 3px solid #000000;
    box-shadow: 6px 6px 0px 0px #000000;
    border-radius: 16px; /* Less rounded */
    color: #000000;
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Bouncy transition */
  }

  :global(html.mode-neo-brutalist) .record-button:hover:not(:disabled) {
    transform: translate(-2px, -2px) scale(1.05);
    box-shadow: 8px 8px 0px 0px #000000;
    background-image: none;
    background-color: #ffc107; /* Slightly lighter amber */
    filter: brightness(1.1);
  }

  :global(html.mode-neo-brutalist) .record-button:active:not(:disabled) {
    animation: springBounce 0.4s linear;
    transform: translate(2px, 2px) scale(0.95);
    box-shadow: 2px 2px 0px 0px #000000;
  }

  /* Focus state */
  .record-button:focus {
    outline: none;
    box-shadow:
      0 0 0 3px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.4),
      0 1px 3px rgba(0, 0, 0, 0.1);
  }

  /* Enhanced focus ring for keyboard navigation */
  .record-button:focus-visible {
    outline: 3px solid var(--zl-cta-color, #ffb000);
    outline-offset: 2px;
  }

  /* Hover state — same gradient, just brighter and lifted. One color
     story per theme; juice comes from motion and light, not a new hue. */
  .record-button:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.02);
    box-shadow:
      0 6px 10px -2px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.25),
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .record-button:not(.recording-active):hover:not(:disabled) {
    filter: saturate(1.08) brightness(1.04);
    transform: translateY(-2px);
    box-shadow: 0 8px 15px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.3);
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
      rgba(
        var(--zl-cta-color-rgb, 255, 176, 0),
        calc(0.5 * var(--pulse-intensity))
      ),
      rgba(
        var(--zl-cta-color-rgb, 255, 176, 0),
        calc(0.55 * var(--pulse-intensity))
      ),
      rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0)
    );
    opacity: calc(0.9 * var(--pulse-intensity));
    z-index: 1; /* Increased z-index to make it more visible */
    transition: opacity 0.1s ease-out;
    pointer-events: none;
  }

  /* Enhanced glow effect during recording */
  .recording-active::before {
    box-shadow:
      0 0 calc(20px * var(--pulse-intensity)) calc(8px * var(--pulse-intensity))
        rgba(
          var(--zl-cta-color-rgb, 255, 176, 0),
          calc(0.4 * var(--pulse-intensity))
        ),
      0 0 calc(15px * var(--pulse-intensity)) calc(5px * var(--pulse-intensity))
        rgba(
          var(--zl-cta-color-rgb, 255, 176, 0),
          calc(0.6 * var(--pulse-intensity))
        );
  }

  /* Active/pressed state */
  .record-button:active:not(:disabled) {
    transform: translateY(1px) scale(0.98);
    box-shadow:
      0 2px 4px -1px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.15),
      0 1px 2px -1px rgba(0, 0, 0, 0.1),
      inset 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  /* Non-recording active effect — press darkens, no palette swap */
  .record-button:not(.recording-active):active:not(:disabled) {
    filter: saturate(1.1) brightness(0.94);
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
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    75% {
      transform: scale(1.01);
    }
    100% {
      transform: scale(1);
    }
  }

  /* Subtle breathing glow for button — 4.8s matches the fleet's idle
     breathe (talktype/daysay) so every app inhales at the same pace. */
  .pulse-subtle {
    animation: button-breathe 4.8s ease-in-out infinite;
    transform-origin: center;
  }

  @keyframes button-breathe {
    0%,
    100% {
      box-shadow: 0 0 12px 2px
        rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.35);
      transform: scale(1);
    }
    50% {
      box-shadow: 0 0 20px 6px
        rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.5);
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
    0%,
    100% {
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
    background-color: rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.18);
  }

  .progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    transition: width 0.3s ease;
    animation: pulse-glow 1.5s infinite ease-in-out;
    background-color: var(--zl-cta-color, #ffb000);
  }

  @keyframes pulse-glow {
    0% {
      box-shadow: inset 0 0 5px
        rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.5);
    }
    50% {
      box-shadow: inset 0 0 15px
        rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.8);
    }
    100% {
      box-shadow: inset 0 0 5px
        rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.5);
    }
  }

  /* Whole-button progress indicator - Enhanced with softer, pinker gradient */
  .recording-active {
    position: relative;
    overflow: hidden;

    /* Filled portion is the theme primary; the tail is the same shade
       faded — progress reads as depth, not a second color story. */
    background-image:
      linear-gradient(
        to right,
        rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.9),
        rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.9)
          var(--progress, 0%),
        rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.38)
          calc(var(--progress, 0%) + 0.5%),
        rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.24) 100%
      ),
      /* Subtle noise texture overlay */
      url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.07'/%3E%3C/svg%3E");

    background-size: 100% 100%;
    box-shadow:
      0 4px 15px -1px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.35),
      inset 0 0 10px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.2),
      0 0 20px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.2);
    border: 1px solid rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.3);
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

  .audio-reactive .cta-text,
  .audio-reactive .cta__label {
    position: relative;
    z-index: 5; /* Increased z-index for text to appear above effects */
  }

  /* Time-limit states signal through the theme's own accent + pulse
     intensity — no stressful red, no off-palette hues. */
  .recording-warning {
    background-image: linear-gradient(
      to right,
      rgb(var(--zl-cta-color-rgb, 255, 176, 0)) var(--progress, 0%),
      rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.7)
        var(--progress, 0%),
      rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.45) 100%
    );
    box-shadow:
      0 4px 15px -1px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.3),
      inset 0 0 10px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.2),
      0 0 20px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.2);
  }

  .recording-danger {
    background-image: linear-gradient(
      to right,
      rgb(var(--zl-cta-color-rgb, 255, 176, 0)) var(--progress, 0%),
      rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.7)
        var(--progress, 0%),
      rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.62) 100%
    );
    box-shadow:
      0 4px 15px -1px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.28),
      inset 0 0 10px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.22),
      0 0 20px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.2);
    animation: danger-pulse 1s infinite alternate ease-in-out;
  }

  @keyframes danger-pulse {
    0% {
      box-shadow:
        0 4px 15px -1px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.28),
        inset 0 0 10px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.22),
        0 0 20px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.2);
    }
    100% {
      box-shadow:
        0 4px 15px -1px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.38),
        inset 0 0 15px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.26),
        0 0 25px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.24);
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
    text-shadow:
      0 1px 2px rgba(0, 0, 0, 0.2),
      0 0 1px rgba(0, 0, 0, 0.1);
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
    .record-button {
      width: 72% !important;
      max-width: 320px !important;
      min-width: 248px !important;
      min-height: 56px !important;
      padding: 0.85rem 1.2rem !important;
    }

    .progress-container {
      width: 72% !important;
      max-width: 320px !important;
      min-width: 248px !important;
      height: 56px !important;
    }

    .fixed-button-container {
      height: 58px;
      margin: 0.25rem 0 0.45rem;
    }

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
    background: linear-gradient(
      to top,
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
    0%,
    100% {
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

  /* Fleet standard (talktype/daysay honor this — so do we): motion is
     decoration, never information. Kill every animation on request. */
  @media (prefers-reduced-motion: reduce) {
    .pulse-subtle,
    .button-press,
    .notification-pulse,
    .recording-danger,
    .progress-bar,
    .wave-bar,
    .recording-indicator {
      animation: none !important;
    }
  }
</style>
