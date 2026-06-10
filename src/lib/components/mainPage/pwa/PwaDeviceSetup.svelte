<script>
  import { browser } from "$app/environment";
  import { createEventDispatcher, onDestroy } from "svelte";
  import { pwaService } from "$lib/services/pwa";
  import { hapticService } from "$lib/services/infrastructure/hapticService";

  const dispatch = createEventDispatcher();
  const OFFLINE_MODEL_TIMEOUT_MS = 90000;
  const OFFLINE_MODEL_TIMEOUT_MESSAGE =
    "Offline model is still downloading. ZipList works online; try setup again later.";

  let isRunning = false;
  let isComplete = false;
  let progress = 0;
  let statusText = "Ready mic and offline mode for this device.";
  let errorMessage = "";
  let unsubscribeWhisperStatus = null;
  let completeTimeout = null;
  let isDismissed = false;
  let setupRunId = 0;

  function stopStream(stream) {
    stream?.getTracks().forEach((track) => track.stop());
  }

  function clearCompleteTimeout() {
    if (completeTimeout) {
      window.clearTimeout(completeTimeout);
      completeTimeout = null;
    }
  }

  function clampProgress(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }

  async function primeMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone setup is not supported here.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    if (!stream?.active) {
      stopStream(stream);
      throw new Error("Microphone permission did not open an audio stream.");
    }

    stopStream(stream);
    return true;
  }

  async function preloadOfflineModel() {
    const [{ simpleHybridService }, { whisperStatus }] = await Promise.all([
      import("$lib/services/transcription/simpleHybridService"),
      import("$lib/services/transcription/whisper/whisperService"),
    ]);

    unsubscribeWhisperStatus?.();
    unsubscribeWhisperStatus = whisperStatus.subscribe((status) => {
      if (isDismissed) return;

      if (status.isLoading || status.progress > 0) {
        progress = Math.max(10, clampProgress(status.progress));
        statusText = `Loading offline model ${progress}%`;
      }

      if (status.error) {
        errorMessage = status.error;
      }
    });

    return simpleHybridService.startBackgroundLoad({ force: true });
  }

  function withTimeout(promise, timeoutMs, message) {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error(message)),
        timeoutMs,
      );
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      window.clearTimeout(timeoutId);
    });
  }

  async function runSetup() {
    if (!browser || isRunning) return;

    const runId = ++setupRunId;
    isDismissed = false;
    isRunning = true;
    isComplete = false;
    errorMessage = "";
    progress = 0;
    clearCompleteTimeout();
    hapticService.selection();

    try {
      statusText = "Checking microphone...";
      await primeMicrophone();
      if (isDismissed || runId !== setupRunId) return;

      statusText = "Protecting local storage...";
      await pwaService.requestPersistentStorage();
      if (isDismissed || runId !== setupRunId) return;

      statusText = "Loading offline model...";
      const modelResult = await withTimeout(
        preloadOfflineModel(),
        OFFLINE_MODEL_TIMEOUT_MS,
        OFFLINE_MODEL_TIMEOUT_MESSAGE,
      );
      if (isDismissed || runId !== setupRunId) return;

      if (!modelResult?.success) {
        throw modelResult?.error || new Error("Offline model needs one more try");
      }

      progress = 100;
      isComplete = true;
      statusText = "ZipList is ready on this device.";
      pwaService.markDeviceSetupComplete();
      hapticService.notification("success");

      completeTimeout = window.setTimeout(() => {
        if (!isDismissed && runId === setupRunId) {
          dispatch("complete");
        }
      }, 1200);
    } catch (error) {
      if (isDismissed || runId !== setupRunId) return;

      errorMessage = error?.message || "Device setup needs one more try";
      statusText = "Setup paused. Try again when you have a steady connection.";
      hapticService.notification("warning");
    } finally {
      unsubscribeWhisperStatus?.();
      unsubscribeWhisperStatus = null;

      if (!isDismissed && runId === setupRunId) {
        isRunning = false;
      }
    }
  }

  function dismiss() {
    isDismissed = true;
    setupRunId += 1;
    isRunning = false;
    unsubscribeWhisperStatus?.();
    unsubscribeWhisperStatus = null;

    clearCompleteTimeout();

    pwaService.snoozeDeviceSetup();
    dispatch("dismiss");
  }

  onDestroy(() => {
    unsubscribeWhisperStatus?.();

    clearCompleteTimeout();
  });
</script>

<div
  class:is-complete={isComplete}
  class:has-error={errorMessage}
  class="pwa-device-setup"
  role="status"
  aria-live="polite"
>
  <div class="setup-copy">
    <p class="setup-title">{isComplete ? "Device Ready" : "PWA Setup"}</p>
    <p class="setup-status">{errorMessage || statusText}</p>
    {#if isRunning || progress > 0}
      <div
        class="progress-track"
        aria-label="Offline setup progress"
        aria-valuemax="100"
        aria-valuemin="0"
        aria-valuenow={progress}
        role="progressbar"
      >
        <span class="progress-fill" style={`width: ${progress}%`}></span>
      </div>
    {/if}
  </div>

  <div class="setup-actions">
    <button
      class="setup-button"
      disabled={isRunning || isComplete}
      type="button"
      on:click={runSetup}
    >
      {#if isRunning}
        Working
      {:else if isComplete}
        Done
      {:else if errorMessage}
        Retry
      {:else}
        Start
      {/if}
    </button>

    {#if !isComplete}
      <button
        aria-label="Set up later"
        class="later-button"
        type="button"
        on:click={dismiss}
      >
        Later
      </button>
    {/if}
  </div>
</div>

<style>
  .pwa-device-setup {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: min(100%, 30rem);
    gap: 0.75rem;
    margin: 0 auto;
    padding: 0.75rem;
    color: var(--zl-text-color-primary, #444);
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid var(--zl-card-border-color, rgba(255, 204, 51, 0.4));
    border-radius: 1rem;
    box-shadow: var(--zl-card-box-shadow, 0 8px 22px rgba(0, 0, 0, 0.1));
    backdrop-filter: blur(14px);
  }

  .pwa-device-setup.is-complete {
    border-color: rgba(34, 197, 94, 0.45);
  }

  .pwa-device-setup.has-error {
    border-color: rgba(255, 176, 0, 0.5);
  }

  .setup-copy {
    min-width: 0;
    flex: 1;
  }

  .setup-title,
  .setup-status {
    margin: 0;
  }

  .setup-title {
    font-size: 0.8rem;
    font-weight: 800;
    line-height: 1.1;
    text-transform: uppercase;
    color: var(--zl-accent-color, #ff6ac2);
  }

  .setup-status {
    margin-top: 0.2rem;
    font-size: 0.9rem;
    line-height: 1.25;
    color: var(--zl-text-color-secondary, #666);
  }

  .progress-track {
    width: 100%;
    height: 0.25rem;
    margin-top: 0.45rem;
    overflow: hidden;
    background: rgba(var(--zl-primary-color-rgb, 255, 204, 51), 0.18);
    border-radius: 999px;
  }

  .progress-fill {
    display: block;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--zl-primary-color, #ffcc33),
      var(--zl-accent-color, #ff6ac2)
    );
    transition: width 0.2s ease;
  }

  .setup-actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
  }

  .setup-button,
  .later-button {
    min-width: 4rem;
    min-height: 2.75rem;
    border: 0;
    border-radius: 0.75rem;
    font-weight: 800;
    line-height: 1;
    cursor: pointer;
  }

  .setup-button {
    padding: 0 1rem;
    color: #fff;
    background: linear-gradient(
      135deg,
      var(--zl-accent-color, #ff6ac2),
      var(--zl-primary-color, #ffcc33)
    );
    box-shadow: 0 6px 14px rgba(var(--zl-primary-color-rgb, 255, 204, 51), 0.2);
  }

  .later-button {
    min-width: 3.25rem;
    padding: 0 0.7rem;
    color: var(--zl-text-color-secondary, #666);
    background: rgba(255, 255, 255, 0.55);
  }

  .setup-button:disabled,
  .later-button:disabled {
    cursor: default;
    opacity: 0.68;
  }

  @media (max-width: 420px) {
    .pwa-device-setup {
      align-items: stretch;
      flex-direction: column;
    }

    .setup-actions {
      width: 100%;
    }

    .setup-button,
    .later-button {
      flex: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }
  }
</style>
