<script>
  import {
    ANIMATION,
    ZIPLIST_CTA_START,
    ZIPLIST_CTA_ADD,
    getRandomFromArray,
    COPY_MESSAGES,
  } from "$lib/constants";
  import { activeListItems } from "$lib/services/lists/listsStore";
  import {
    waveformData,
    uiActions,
    soundService,
  } from "$lib/services/infrastructure";
  import { onMount, onDestroy, tick, createEventDispatcher } from "svelte";

  export let recording = false;
  export let transcribing = false;
  export let disabled = false;
  export let clipboardSuccess = false;
  export let recordingDuration = 0;
  export let buttonLabel = "";
  export let progress = 0;
  // List-first mode docks this button over the list, where a 380px-wide pill
  // covered the very items you were reading. Compact swaps the label for the
  // waveform glyph and goes round, so it can tuck into a corner instead.
  export let compact = false;

  const dispatch = createEventDispatcher();

  let recordButtonElement;
  let transcribingWrapper;
  let pressAnimationTimeout = null;
  let animationFrameId = null;
  let hydrated = false;

  // Compact 3-bar live voice meter fed from waveformData
  let meterTarget = [0.22, 0.34, 0.22];
  let meterLevels = [0.22, 0.34, 0.22];

  const unsubscribeWaveform = waveformData.subscribe((data) => {
    if (data && data.length >= 6) {
      const third = Math.max(1, Math.floor(data.length / 3));
      const bandAvg = (start, end) => {
        let sum = 0;
        let count = 0;
        for (let i = start; i < end && i < data.length; i++) {
          sum += data[i] || 0;
          count++;
        }
        return count > 0 ? sum / count : 0;
      };
      const b0 = Math.min(1, Math.max(0.2, bandAvg(0, third) / 110));
      const b1 = Math.min(1, Math.max(0.28, bandAvg(third, third * 2) / 95));
      const b2 = Math.min(
        1,
        Math.max(0.2, bandAvg(third * 2, data.length) / 110),
      );
      meterTarget = [b0, b1, b2];
      startMeterLoop();
    } else if (!recording) {
      meterTarget = [0.22, 0.34, 0.22];
    }
  });

  function updateMeter() {
    if (!recording) {
      animationFrameId = null;
      return;
    }

    meterLevels = meterLevels.map(
      (prev, i) => prev * 0.68 + meterTarget[i] * 0.32,
    );

    if (recordButtonElement) {
      recordButtonElement.style.setProperty(
        "--meter-0",
        meterLevels[0].toFixed(3),
      );
      recordButtonElement.style.setProperty(
        "--meter-1",
        meterLevels[1].toFixed(3),
      );
      recordButtonElement.style.setProperty(
        "--meter-2",
        meterLevels[2].toFixed(3),
      );
    }

    animationFrameId = requestAnimationFrame(updateMeter);
  }

  function startMeterLoop() {
    if (
      animationFrameId == null &&
      typeof window !== "undefined" &&
      recording
    ) {
      animationFrameId = requestAnimationFrame(updateMeter);
    }
  }

  $: if (recording) startMeterLoop();

  // Starter items ("Tap + up top...") are the interactive manual, not a list
  // the user recorded — keep "Talk a list" until real user items exist so a
  // brand-new visitor never sees the CTA snap to "Add more" on hydration.
  function itemsIncludeUserContent(items) {
    return (
      Array.isArray(items) &&
      items.some(
        (item) =>
          item &&
          typeof item.text === "string" &&
          !String(item.id || "").startsWith("starter-"),
      )
    );
  }

  let hasActiveList =
    typeof document !== "undefined" &&
    document.documentElement.hasAttribute("data-has-items");

  const unsubscribeItems = activeListItems.subscribe((items) => {
    const nextHasItems = itemsIncludeUserContent(items);
    hasActiveList = nextHasItems;
    if (typeof document !== "undefined") {
      if (nextHasItems) {
        document.documentElement.setAttribute("data-has-items", "true");
      } else {
        document.documentElement.removeAttribute("data-has-items");
      }
    }
  });

  onMount(() => {
    hydrated = true;
    startMeterLoop();
  });

  onDestroy(() => {
    if (unsubscribeWaveform) unsubscribeWaveform();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (unsubscribeItems) unsubscribeItems();
    clearPressAnimationTimeout();
    clearHoldTimer();
  });

  function clearPressAnimationTimeout() {
    if (pressAnimationTimeout) {
      clearTimeout(pressAnimationTimeout);
      pressAnimationTimeout = null;
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

  function formatDuration(seconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  function formatCountdown(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  $: maxDuration = Math.max(1, ANIMATION.RECORDING.LIMIT || 60);
  $: safeDuration = Math.max(0, Number(recordingDuration) || 0);
  $: timeRemaining = recording
    ? Math.max(0, maxDuration - safeDuration)
    : maxDuration;
  $: progressRatio = recording
    ? Math.min(1, Math.max(0, safeDuration / maxDuration))
    : 0;
  $: progressPercentage = progressRatio * 100;
  $: progressWidth = `${progressPercentage.toFixed(1)}%`;
  $: isWarning =
    recording && timeRemaining <= ANIMATION.RECORDING.WARNING_THRESHOLD;
  $: isDanger =
    recording && timeRemaining <= ANIMATION.RECORDING.DANGER_THRESHOLD;
  $: secondsLeft = Math.max(0, Math.ceil(timeRemaining));
  $: elapsedLabel = formatDuration(safeDuration);
  $: remainingLabel = formatCountdown(timeRemaining);
  $: durationSummary = `${elapsedLabel} of ${formatDuration(maxDuration)}`;

  // TalkType timer feedback pattern: count UP calmly during normal speech so
  // the filling bar reads as progress rather than pressure, then flip to
  // remaining time inside the warning window when time genuinely runs short.
  $: liveTimerLabel = isWarning ? `${remainingLabel} left` : elapsedLabel;
  $: compactTimerLabel = isWarning ? `${secondsLeft}s` : elapsedLabel;

  // Screen-reader + gentle audio nudge on threshold crossings
  let wasWarning = false;
  let wasDanger = false;
  $: {
    if (recording) {
      if (isDanger && !wasDanger) {
        uiActions.setScreenReaderMessage(
          `Recording stops in ${secondsLeft} seconds.`,
        );
      } else if (isWarning && !wasWarning) {
        uiActions.setScreenReaderMessage(
          `${secondsLeft} seconds of recording time left.`,
        );
        soundService?.play?.("warn");
      }
      wasWarning = isWarning;
      wasDanger = isDanger;
    } else {
      wasWarning = false;
      wasDanger = false;
    }
  }

  // Keep keyboard focus anchored when swapping between record button and
  // transcribing bar so focus never drops to <body> mid-flow.
  let restoreFocusToButton = false;
  $: void handleTranscribingFocusSwap(transcribing);

  async function handleTranscribingFocusSwap(isTranscribingNow) {
    if (typeof document === "undefined") return;
    if (isTranscribingNow) {
      restoreFocusToButton = document.activeElement === recordButtonElement;
      if (restoreFocusToButton) {
        await tick();
        transcribingWrapper?.focus({ preventScroll: true });
      }
    } else if (restoreFocusToButton) {
      restoreFocusToButton = false;
      await tick();
      recordButtonElement?.focus({ preventScroll: true });
    }
  }

  let copyMessage = COPY_MESSAGES[0];
  let previousClipboardSuccess = false;
  $: {
    if (clipboardSuccess && !previousClipboardSuccess) {
      copyMessage = getRandomFromArray(COPY_MESSAGES) || "Copied!";
    }
    previousClipboardSuccess = clipboardSuccess;
  }

  $: idlePhrase = hasActiveList ? ZIPLIST_CTA_ADD : ZIPLIST_CTA_START;
  $: buttonLabel = recording ? `Done · ${liveTimerLabel}` : idlePhrase;
  $: showClipboardSuccess = clipboardSuccess && !recording;
  $: showAmbientPulse = !recording && !showClipboardSuccess;

  $: recordButtonAriaLabel = recording
    ? `Finish recording and add to list. ${durationSummary}${isWarning ? `, ${secondsLeft} seconds left` : ""}`
    : hasActiveList
      ? `${ZIPLIST_CTA_ADD}. Tap or hold to talk`
      : `${ZIPLIST_CTA_START}. Tap or hold to talk`;

  // ── Push-to-talk (hybrid) ─────────────────────────────────────────────
  // Quick tap keeps the classic toggle. Press-and-hold past HOLD_MS turns
  // the button into a walkie-talkie: holdstart begins recording, release
  // fires holdend (parent stops).
  const HOLD_MS = 250;
  let holdTimer = null;
  let holdActive = false;
  let swallowNextClick = false;

  function clearHoldTimer() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function handlePointerDown(event) {
    dispatch("preload");
    if (disabled || transcribing) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    try {
      recordButtonElement?.setPointerCapture?.(event.pointerId);
    } catch {
      /* capture is best-effort */
    }
    clearHoldTimer();
    if (recording) return;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      holdActive = true;
      swallowNextClick = true;
      dispatch("holdstart");
    }, HOLD_MS);
  }

  function handlePointerRelease() {
    clearHoldTimer();
    if (holdActive) {
      holdActive = false;
      dispatch("holdend");
    }
  }

  function handleDiscard(event) {
    event?.stopPropagation?.();
    clearHoldTimer();
    holdActive = false;
    swallowNextClick = false;
    dispatch("discard");
  }

  $: safeTranscribeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  $: visualTranscribeRatio = Math.max(safeTranscribeProgress, 16) / 100;
</script>

<div class="fixed-button-container" class:compact-container={compact}>
  {#if transcribing}
    <div
      bind:this={transcribingWrapper}
      tabindex="-1"
      class="transcribing-focus-anchor"
      aria-label="Making list"
    >
      <div
        class="transcribing-pill {compact
          ? 'transcribing-compact'
          : 'mx-auto h-[60px] w-[88%] max-w-[400px] sm:h-[64px] sm:w-[85%]'}"
        role="progressbar"
        aria-label="List-making progress"
        aria-valuenow={Math.round(safeTranscribeProgress)}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuetext={`Making list ${Math.round(safeTranscribeProgress)} percent complete`}
      >
        <div
          class="transcribing-fill"
          style="--progress-ratio: {visualTranscribeRatio};"
          aria-hidden="true"
        ></div>
        {#if !compact}
          <span class="transcribing-label">Ziplisting</span>
        {/if}
        <span
          class="processing-dots {!compact ? 'ml-2' : ''}"
          aria-hidden="true"
        >
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>
    </div>
  {:else}
    <button
      bind:this={recordButtonElement}
      type="button"
      class="record-button touch-manipulation select-none {compact
        ? 'record-button-compact'
        : 'mx-auto flex h-[60px] w-[88%] min-w-[260px] max-w-[400px] items-center justify-center sm:h-[64px] sm:w-[85%]'} {recording &&
      !compact
        ? 'px-2.5'
        : !compact
          ? 'px-6 sm:px-8'
          : ''}"
      class:pulse-subtle={showAmbientPulse}
      class:pulse-calm={hasActiveList}
      class:notification-pulse={showClipboardSuccess}
      class:recording-active={recording}
      class:recording-warning={isWarning}
      class:recording-danger={isDanger}
      class:is-hydrated={hydrated}
      data-record-button
      on:click={() => {
        if (swallowNextClick) {
          swallowNextClick = false;
          return;
        }
        dispatch("click");
      }}
      on:pointerdown={handlePointerDown}
      on:pointerup={handlePointerRelease}
      on:pointercancel={handlePointerRelease}
      on:mouseenter={() => dispatch("preload")}
      disabled={disabled || transcribing}
      title={recording ? "Tap or release to finish" : "Tap or hold to talk"}
      aria-label={recordButtonAriaLabel}
      aria-pressed={recording}
      aria-busy={disabled || transcribing}
    >
      {#if recording}
        <span
          class="recording-progress-track"
          class:is-vertical={compact}
          class:is-empty={progressRatio === 0}
          style:--progress={progressWidth}
          role="progressbar"
          aria-label="Recording time elapsed"
          aria-valuenow={Math.round(progressPercentage)}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuetext={durationSummary}
        >
          <span class="recording-progress-fill" aria-hidden="true"></span>
        </span>
      {/if}

      {#if compact}
        {#if recording}
          <span class="compact-timer tabular-nums" aria-hidden="true">
            {compactTimerLabel}
          </span>
        {:else}
          <svg
            class="compact-glyph relative z-10"
            width="26"
            height="26"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <line x1="4" y1="10" x2="4" y2="14"></line>
            <line x1="8" y1="7" x2="8" y2="17"></line>
            <line x1="12" y1="4" x2="12" y2="20"></line>
            <line x1="16" y1="7" x2="16" y2="17"></line>
            <line x1="20" y1="10" x2="20" y2="14"></line>
          </svg>
        {/if}
        <span class="sr-only">
          {buttonLabel}
          {#if recording}
            {durationSummary}
          {/if}
        </span>
      {:else if showClipboardSuccess}
        <span class="button-content relative z-10 gap-1.5 font-extrabold">
          {copyMessage}
        </span>
      {:else if recording}
        <span class="button-content is-live-take relative z-10 w-full">
          <!-- Audio-reactive voice badge on the left balances the discard X on
               the right so "Done · 0:12" stays dead-centre while showing live
               mic activity without covering the filling bar. -->
          <span class="voice-meter-dot" aria-hidden="true">
            <span class="voice-meter-bar bar-0"></span>
            <span class="voice-meter-bar bar-1"></span>
            <span class="voice-meter-bar bar-2"></span>
          </span>

          <span class="done-label">
            <span class="done-word">Done</span>
            <span class="done-dot" aria-hidden="true">·</span>
            <span class="done-time tabular-nums">{liveTimerLabel}</span>
          </span>

          <span
            role="button"
            tabindex="0"
            class="discard-dot"
            on:pointerdown|stopPropagation
            on:click|stopPropagation={handleDiscard}
            on:keydown|stopPropagation={(e) =>
              (e.key === "Enter" || e.key === " ") && handleDiscard(e)}
            aria-label="Discard recording"
            title="Discard recording"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </span>
        </span>
      {:else}
        <span class="button-content relative z-10 w-full">
          <span class="cta__label">
            <svg
              class="cta__glyph"
              width="20"
              height="20"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="2" width="6" height="11" rx="3"></rect>
              <path d="M5 10v1a7 7 0 0 0 14 0v-1"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
            {#if hydrated}
              <span>{idlePhrase}</span>
            {:else}
              <span class="cta-phrase-start">{ZIPLIST_CTA_START}</span>
              <span class="cta-phrase-add">{ZIPLIST_CTA_ADD}</span>
            {/if}
          </span>
        </span>
      {/if}
    </button>
  {/if}
</div>

<style>
  /* Pre-hydration CTA phrase sync: app.html sets html[data-has-items="true"]
     synchronously from localStorage, so returning visitors see "Add more" and
     new visitors see "Talk a list" before JS hydrates — zero text snap. */
  .cta-phrase-add {
    display: none;
  }

  :global(html[data-has-items="true"])
    .record-button:not(.is-hydrated)
    .cta-phrase-start {
    display: none;
  }

  :global(html[data-has-items="true"])
    .record-button:not(.is-hydrated)
    .cta-phrase-add {
    display: inline;
  }

  .fixed-button-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 68px;
    position: relative;
    margin: 0.45rem 0 0.65rem;
    z-index: 5;
  }

  .fixed-button-container.compact-container {
    width: auto;
    min-height: 0;
    height: auto;
    margin: 0;
  }

  /* Base button styling — Soft Neo-Toybrut (TalkType sibling parity):
     warm near-black ink (#1e1714, never stark #000), flat brand yellow,
     crisp offset shadow, tactile hover lift and press squish. */
  .record-button {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    border-radius: 9999px;
    border: 2.5px solid #1e1714;
    background-color: var(--zl-cta-color, #ffb000);
    color: #1e1714;
    font-weight: 800;
    box-shadow: 3px 3px 0px #1e1714;
    transform-origin: center center;
    --meter-0: 0.24;
    --meter-1: 0.38;
    --meter-2: 0.24;
    transition:
      transform 0.16s cubic-bezier(0.25, 0.1, 0.25, 1),
      box-shadow 0.16s cubic-bezier(0.25, 0.1, 0.25, 1),
      background-color 0.16s cubic-bezier(0.25, 0.1, 0.25, 1),
      border-color 0.2s ease;
  }

  /* Chunky Neo-Toybrut idle styling — explicitly :not(.recording-active) so
     the live timer track and fill are NEVER overridden by chunky mode! */
  :global(html.mode-neo-brutalist)
    .record-button:not(.recording-active):not(.record-button-compact) {
    border-radius: 18px;
    border: 2.5px solid #1e1714;
    box-shadow: 4px 4px 0px #1e1714;
  }

  :global(html.mode-neo-brutalist)
    .record-button.recording-active:not(.record-button-compact) {
    border-radius: 18px;
  }

  .record-button-compact {
    width: 64px;
    height: 64px;
    min-width: 64px;
    min-height: 64px;
    padding: 0;
    border-radius: 9999px;
    aspect-ratio: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .compact-glyph {
    width: 26px;
    height: 26px;
  }

  .compact-timer {
    position: relative;
    z-index: 10;
    font-family: "Space Mono", monospace;
    font-size: 0.82rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #1e1714;
    text-shadow: 0 1px 0 rgba(255, 254, 247, 0.72);
  }

  .cta__label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: clamp(1.05rem, 0.4vw + 0.98rem, 1.22rem);
    font-weight: 800;
    letter-spacing: 0.01em;
    line-height: 1;
    color: #1e1714;
  }

  .cta__glyph {
    width: 1.12em;
    height: 1.12em;
    flex-shrink: 0;
    opacity: 0.92;
  }

  /* Focus ring */
  .record-button:focus {
    outline: none;
  }

  .record-button:focus-visible {
    outline: 3px solid var(--zl-cta-color, #ffb000);
    outline-offset: 3px;
  }

  /* Idle hover & active tactile states */
  .record-button:not(.recording-active):hover:not(:disabled) {
    transform: translate(-1px, -2px);
    background-color: #ffc226;
    box-shadow: 5px 5px 0px #1e1714;
  }

  .record-button:not(.recording-active):active:not(:disabled) {
    transform: translate(2px, 2px);
    background-color: #f59e0b;
    box-shadow: 1px 1px 0px #1e1714;
  }

  .record-button:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  /* Programmatic press bounce */
  :global(.button-press) {
    animation: button-press 0.36s cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  @keyframes button-press {
    0% {
      transform: scale(1);
    }
    35% {
      transform: translate(1px, 1px) scale(0.98);
      box-shadow: 1.5px 1.5px 0px #1e1714;
    }
    75% {
      transform: scale(1.01);
    }
    100% {
      transform: scale(1);
    }
  }

  /* Subtle arrival invitation — breathes once, then rests at zero idle GPU cost */
  .pulse-subtle {
    animation: button-idle-float 2.2s ease-in-out 0.45s 1;
  }

  .pulse-subtle.pulse-calm {
    animation: none;
  }

  .pulse-subtle:hover,
  .pulse-subtle:active,
  .pulse-subtle:global(.button-press) {
    animation: none;
  }

  @keyframes button-idle-float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-1.5px);
    }
  }

  /* Clipboard notification state */
  .notification-pulse {
    background-color: #f5f3ff !important;
    border-color: #1e1714 !important;
    box-shadow: 3px 3px 0px #1e1714;
  }

  /* ── Whole-button Recording Timer Fill (TalkType Architecture) ─────────── */
  .recording-active {
    --record-progress-fill: linear-gradient(
      90deg,
      #fbbf24 0%,
      #fb923c 68%,
      #f472b6 100%
    );
    --record-progress-track: linear-gradient(
      90deg,
      rgba(255, 250, 235, 0.98),
      rgba(254, 243, 199, 0.88) 55%,
      rgba(253, 230, 138, 0.52)
    );
    background-color: #fffbeb;
    background-image: none;
    border: 2.5px solid #1e1714;
    box-shadow:
      3px 3px 0px #1e1714,
      0 8px 20px -6px rgba(251, 146, 60, 0.42);
  }

  .recording-active:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow:
      4px 4px 0px #1e1714,
      0 10px 22px -6px rgba(251, 146, 60, 0.48);
  }

  .recording-active:active:not(:disabled) {
    transform: translate(1px, 1px);
    box-shadow: 1.5px 1.5px 0px #1e1714;
  }

  .recording-active:not(.recording-danger) {
    animation: recording-glow-breathe 2.6s ease-in-out infinite;
  }

  /* Warning window (last 15s): warm amber-coral shift, never harsh alarm red */
  .recording-warning {
    --record-progress-fill: linear-gradient(
      90deg,
      #fb923c 0%,
      #f97316 55%,
      #fb7185 100%
    );
    --record-progress-track: linear-gradient(
      90deg,
      rgba(255, 244, 230, 0.98),
      rgba(255, 228, 205, 0.72)
    );
  }

  /* Final countdown (last 6s): warm coral-rose + gentle urgency pulse */
  .recording-danger {
    --record-progress-fill: linear-gradient(
      90deg,
      #f97316 0%,
      #fb7185 58%,
      #ec4899 100%
    );
    --record-progress-track: linear-gradient(
      90deg,
      rgba(255, 236, 240, 0.98),
      rgba(254, 205, 211, 0.68)
    );
    animation: recording-danger-pulse 1.1s ease-in-out infinite;
  }

  @keyframes recording-glow-breathe {
    0%,
    100% {
      box-shadow:
        3px 3px 0px #1e1714,
        0 6px 16px -6px rgba(251, 146, 60, 0.36);
    }
    50% {
      box-shadow:
        3px 3px 0px #1e1714,
        0 10px 24px -4px rgba(251, 146, 60, 0.56);
    }
  }

  @keyframes recording-danger-pulse {
    0%,
    100% {
      box-shadow:
        3px 3px 0px #1e1714,
        0 0 12px 1px rgba(251, 113, 133, 0.34);
    }
    50% {
      box-shadow:
        3px 3px 0px #1e1714,
        0 0 22px 5px rgba(244, 114, 182, 0.55);
    }
  }

  .recording-progress-track {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    border-radius: inherit;
    background: var(--record-progress-track);
    pointer-events: none;
  }

  .recording-progress-track::after {
    content: "";
    position: absolute;
    inset: 2px;
    border-radius: inherit;
    border: 1px solid rgba(255, 255, 255, 0.45);
    pointer-events: none;
  }

  /* Plain width (or height for compact circle) — smooth, compositor-safe,
     never blinks on iOS Safari at small percentages. */
  .recording-progress-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--progress, 0%);
    background: var(--record-progress-fill);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.34),
      2px 0 14px rgba(251, 146, 60, 0.34);
  }

  .recording-progress-track.is-vertical .recording-progress-fill {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: var(--progress, 0%);
    background: linear-gradient(0deg, #fbbf24 0%, #fb923c 65%, #f472b6 100%);
  }

  .recording-warning
    .recording-progress-track.is-vertical
    .recording-progress-fill {
    background: linear-gradient(0deg, #fb923c 0%, #f97316 55%, #fb7185 100%);
  }

  .recording-danger
    .recording-progress-track.is-vertical
    .recording-progress-fill {
    background: linear-gradient(0deg, #f97316 0%, #fb7185 58%, #ec4899 100%);
  }

  /* Flowing light band across the filled portion so a live take visibly moves */
  .recording-progress-fill::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: linear-gradient(
      100deg,
      rgba(255, 255, 255, 0) 25%,
      rgba(255, 255, 255, 0.48) 50%,
      rgba(255, 255, 255, 0) 75%
    );
    background-size: 60% 100%;
    background-repeat: no-repeat;
    background-position: -150% 0;
    animation: record-fill-sheen 3.4s ease-in-out infinite;
  }

  /* Leading-edge glint */
  .recording-progress-track:not(.is-vertical) .recording-progress-fill::after {
    content: "";
    position: absolute;
    top: 8px;
    bottom: 8px;
    right: -1px;
    width: 2.5px;
    border-radius: 9999px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0),
      rgba(255, 255, 255, 0.88) 24%,
      rgba(255, 255, 255, 0.88) 76%,
      rgba(255, 255, 255, 0)
    );
    box-shadow:
      0 0 8px rgba(255, 255, 255, 0.65),
      0 0 12px rgba(244, 114, 182, 0.3);
  }

  .recording-progress-track.is-empty .recording-progress-fill::after {
    display: none;
  }

  @keyframes record-fill-sheen {
    0% {
      background-position: -150% 0;
    }
    65%,
    100% {
      background-position: 250% 0;
    }
  }

  /* ── Live-take 3-column layout: [voice meter] [Done · time] [discard ✕] ── */
  .button-content {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .button-content.is-live-take {
    display: grid;
    grid-template-columns: 2.4rem minmax(0, 1fr) 2.4rem;
    align-items: center;
    column-gap: 0.5rem;
  }

  .voice-meter-dot {
    width: 2.4rem;
    height: 2.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border-radius: 9999px;
    border: 1.5px solid rgba(30, 23, 20, 0.24);
    background: rgba(255, 254, 247, 0.72);
    pointer-events: none;
  }

  .voice-meter-bar {
    width: 3.5px;
    height: 16px;
    border-radius: 9999px;
    background: #1e1714;
    transform-origin: center;
    transition: transform 60ms linear;
  }

  .voice-meter-bar.bar-0 {
    transform: scaleY(var(--meter-0, 0.28));
  }

  .voice-meter-bar.bar-1 {
    transform: scaleY(var(--meter-1, 0.45));
  }

  .voice-meter-bar.bar-2 {
    transform: scaleY(var(--meter-2, 0.28));
  }

  .done-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    line-height: 1;
    white-space: nowrap;
    color: #1e1714;
    font-weight: 900;
    text-shadow: 0 1px 0 rgba(255, 254, 247, 0.55);
  }

  .done-word,
  .done-time {
    font-size: clamp(1rem, 0.35vw + 0.92rem, 1.14rem);
    line-height: 1;
  }

  .done-time {
    font-family: "Space Mono", monospace;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .done-dot {
    opacity: 0.45;
    line-height: 1;
  }

  .discard-dot {
    width: 2.4rem;
    height: 2.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    border: 2px solid #1e1714;
    background: rgba(255, 254, 247, 0.95);
    box-shadow: 1.5px 1.5px 0px #1e1714;
    color: #1e1714;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition:
      transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .discard-dot:hover {
    transform: scale(1.07) rotate(90deg);
    background: #ffe4e6;
    color: #9f1239;
  }

  .discard-dot:active {
    transform: scale(0.92);
  }

  .discard-dot:focus-visible {
    outline: 2px solid #1e1714;
    outline-offset: 2px;
  }

  /* ── Transcribing pill (Soft Neo-Toybrut, matches TalkType) ────────────── */
  .transcribing-focus-anchor {
    outline: none;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .transcribing-pill {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    border: 2.5px solid #1e1714;
    background:
      linear-gradient(
        135deg,
        rgba(254, 243, 199, 0.96),
        rgba(251, 191, 36, 0.28)
      ),
      #fde68a;
    box-shadow: 3px 3px 0px #1e1714;
  }

  :global(html.mode-neo-brutalist)
    .transcribing-pill:not(.transcribing-compact) {
    border-radius: 18px;
  }

  .transcribing-compact {
    width: 64px;
    height: 64px;
    min-width: 64px;
    min-height: 64px;
  }

  .transcribing-fill {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(90deg, #fbbf24 0%, #fb923c 65%, #fda4af 100%);
    transform: scaleX(var(--progress-ratio, 0.16));
    transform-origin: left center;
    transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .transcribing-label {
    position: relative;
    z-index: 10;
    font-size: 1.05rem;
    font-weight: 800;
    color: #1e1714;
  }

  .processing-dots {
    position: relative;
    z-index: 10;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.32rem;
  }

  .processing-dots span {
    width: 0.48rem;
    height: 0.48rem;
    border-radius: 9999px;
    background: rgba(30, 23, 20, 0.82);
    animation: dot-breathe 1.1s ease-in-out infinite;
  }

  .processing-dots span:nth-child(2) {
    animation-delay: 0.14s;
  }

  .processing-dots span:nth-child(3) {
    animation-delay: 0.28s;
  }

  @keyframes dot-breathe {
    0%,
    100% {
      opacity: 0.35;
      transform: scale(0.82);
    }
    50% {
      opacity: 0.92;
      transform: scale(1);
    }
  }

  @media (max-width: 640px) {
    .fixed-button-container:not(.compact-container) {
      min-height: 60px;
      margin: 0.2rem 0 0.4rem;
    }

    .fixed-button-container:not(.compact-container) .record-button,
    .fixed-button-container:not(.compact-container) .transcribing-pill {
      width: 84%;
      max-width: 340px;
      min-width: 248px;
      height: 58px;
      min-height: 58px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse-subtle,
    :global(.button-press),
    .recording-active,
    .recording-danger,
    .recording-progress-fill::before,
    .processing-dots span {
      animation: none !important;
    }

    .transcribing-fill {
      transition-duration: 0ms !important;
    }
  }
</style>
