<script>
  import { onMount } from "svelte";
  import {
    theme,
    autoRecord,
    listFirstMode,
    soundCues,
    applyTheme,
    isContributor,
  } from "$lib";
  import { STORAGE_KEYS, THEMES } from "$lib/constants";
  import { PRICING } from "$lib/config/pricing.js";
  import { StorageUtils } from "$lib/services/infrastructure/storageUtils";
  import { soundService } from "$lib/services/infrastructure/soundService";

  // Props for the modal
  export let closeModal = () => {};

  // Theme/vibe selection
  let selectedVibe;
  let autoRecordValue = false;
  let listFirstModeValue = false;
  let soundCuesValue = true;
  let chunkyModeValue = false;
  let contributorUnlocked = false;

  // Subscribe to theme store
  const unsubscribeTheme = theme.subscribe((value) => {
    selectedVibe = value;
  });

  // Subscribe to autoRecord store
  const unsubscribeAutoRecord = autoRecord.subscribe((value) => {
    autoRecordValue = value === "true";
  });

  const unsubscribeListFirstMode = listFirstMode.subscribe((value) => {
    listFirstModeValue = value === "true";
  });

  const unsubscribeSoundCues = soundCues.subscribe((value) => {
    soundCuesValue = value !== "false";
    soundService.setEnabled(soundCuesValue);
  });

  const unsubscribeContributor = isContributor.subscribe((value) => {
    contributorUnlocked = value;
  });

  // Theme options
  const vibeOptions = [
    { id: THEMES.NEO, name: "Neo" },
    { id: THEMES.FOCUS, name: "Focus" },
    { id: THEMES.CHILL, name: "Chill" },
    { id: THEMES.ZEN, name: "Zen" },
    { id: THEMES.NOCTURNE, name: "Nocturne" },
  ];

  onMount(() => {
    // Check for chunky mode
    if (typeof document !== "undefined") {
      chunkyModeValue =
        document.documentElement.classList.contains("mode-neo-brutalist");
    }

    // Handle native dialog close (Escape key, form method="dialog")
    const dialog = document.getElementById("settings_modal");
    function onDialogClose() {
      closeModal();
    }
    if (dialog) {
      dialog.addEventListener("close", onDialogClose);
    }

    return () => {
      unsubscribeTheme();
      unsubscribeAutoRecord();
      unsubscribeListFirstMode();
      unsubscribeSoundCues();
      unsubscribeContributor();
      if (dialog) {
        dialog.removeEventListener("close", onDialogClose);
      }
    };
  });

  // Handle chunky mode toggle
  function toggleChunkyMode() {
    chunkyModeValue = !chunkyModeValue;
    soundService.select();

    if (chunkyModeValue) {
      document.documentElement.classList.add("mode-neo-brutalist");
      StorageUtils.setItem(STORAGE_KEYS.CHUNKY_MODE, "true");
    } else {
      document.documentElement.classList.remove("mode-neo-brutalist");
      StorageUtils.setItem(STORAGE_KEYS.CHUNKY_MODE, "false");
    }

    window.dispatchEvent(
      new CustomEvent("ziplist-setting-changed", {
        detail: { setting: "chunkyMode", value: chunkyModeValue },
      }),
    );
  }

  // Handle vibe change
  function changeVibe(vibeId) {
    if (!vibeOptions.some((vibe) => vibe.id === vibeId)) return;

    selectedVibe = vibeId;
    soundService.select();
    applyTheme(vibeId);

    // Dispatch a custom event that other components can listen for
    window.dispatchEvent(
      new CustomEvent("ziplist-setting-changed", {
        detail: { setting: "theme", value: vibeId },
      }),
    );
  }

  // Handle auto-record toggle
  function toggleAutoRecord() {
    autoRecordValue = !autoRecordValue;
    soundService.select();
    autoRecord.set(autoRecordValue.toString());

    window.dispatchEvent(
      new CustomEvent("ziplist-setting-changed", {
        detail: { setting: "autoRecord", value: autoRecordValue },
      }),
    );
  }

  function toggleListFirstMode() {
    listFirstModeValue = !listFirstModeValue;
    soundService.select();
    listFirstMode.set(listFirstModeValue.toString());

    window.dispatchEvent(
      new CustomEvent("ziplist-setting-changed", {
        detail: { setting: "listFirstMode", value: listFirstModeValue },
      }),
    );
  }

  function toggleSoundCues() {
    soundCuesValue = !soundCuesValue;
    soundService.setEnabled(soundCuesValue);
    soundCues.set(soundCuesValue.toString());

    if (soundCuesValue) {
      soundService.select({ force: true });
    }

    window.dispatchEvent(
      new CustomEvent("ziplist-setting-changed", {
        detail: { setting: "soundCues", value: soundCuesValue },
      }),
    );
  }

  function handleModalClose() {
    closeModal();
  }

  function openContributorModal() {
    window.dispatchEvent(new CustomEvent("ziplist-open-contributor"));
  }
</script>

<dialog
  id="settings_modal"
  class="zl-settings-dialog"
  aria-labelledby="settings_modal_title"
  aria-describedby="settings_modal_description"
  aria-modal="true"
>
  <div class="zl-settings-card">
    <div class="zl-settings-content">
      <div class="zl-settings-header">
        <h3 id="settings_modal_title" class="zl-settings-title">Options</h3>
        <p id="settings_modal_description" class="sr-only">
          Adjust startup, sound, contributor, and theme settings.
        </p>
        <form method="dialog">
          <button
            type="button"
            class="zl-settings-close"
            on:click={handleModalClose}
            aria-label="Close settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </form>
      </div>

      <section
        class="zl-settings-section"
        aria-labelledby="settings_general_title"
      >
        <h4 id="settings_general_title" class="zl-section-label">General</h4>

        <div class="zl-setting-row">
          <div class="zl-setting-info">
            <span class="zl-setting-name">Ready Mic on Start</span>
            <p class="zl-setting-desc">
              Prep the recorder when ZipList opens; tap once before mic access
            </p>
          </div>
          <label class="zl-toggle">
            <input
              type="checkbox"
              checked={autoRecordValue}
              on:change={toggleAutoRecord}
              aria-label="Ready microphone on start"
            />
            <span class="zl-toggle-slider"></span>
          </label>
        </div>

        <div class="zl-setting-row">
          <div class="zl-setting-info">
            <span class="zl-setting-name">Chunky Mode</span>
            <p class="zl-setting-desc">Thick borders & hard shadows</p>
          </div>
          <label class="zl-toggle">
            <input
              type="checkbox"
              checked={chunkyModeValue}
              on:change={toggleChunkyMode}
              aria-label="Chunky Mode"
            />
            <span class="zl-toggle-slider"></span>
          </label>
        </div>

        <div class="zl-setting-row">
          <div class="zl-setting-info">
            <span class="zl-setting-name">List First</span>
            <p class="zl-setting-desc">
              Hide the mascot and title when you want the working view
            </p>
          </div>
          <label class="zl-toggle">
            <input
              type="checkbox"
              checked={listFirstModeValue}
              on:change={toggleListFirstMode}
              aria-label="List First mode"
            />
            <span class="zl-toggle-slider"></span>
          </label>
        </div>

        <div class="zl-setting-row">
          <div class="zl-setting-info">
            <span class="zl-setting-name">Sound Cues</span>
            <p class="zl-setting-desc">
              Soft taps, checklist pops, and finishes
            </p>
          </div>
          <label class="zl-toggle">
            <input
              type="checkbox"
              checked={soundCuesValue}
              on:change={toggleSoundCues}
              aria-label="Sound Cues"
            />
            <span class="zl-toggle-slider"></span>
          </label>
        </div>

        <div class="zl-setting-row">
          <div class="zl-setting-info">
            <span class="zl-setting-name">Contributor</span>
            <p class="zl-setting-desc">
              More lists, live sharing, and device unlocks
            </p>
          </div>
          <button
            type="button"
            class="zl-setting-action"
            on:click={openContributorModal}
          >
            {contributorUnlocked ? "Unlocked" : PRICING.displayPrice}
          </button>
        </div>
      </section>

      <section
        class="zl-settings-section"
        aria-labelledby="settings_vibe_title"
      >
        <h4 id="settings_vibe_title" class="zl-section-label">
          Choose Your Vibe
        </h4>
        <div class="zl-vibe-grid">
          {#each vibeOptions as vibe}
            <button
              type="button"
              class="zl-vibe-option"
              class:active={selectedVibe === vibe.id}
              on:click={() => changeVibe(vibe.id)}
              aria-label={`Use ${vibe.name} vibe`}
              aria-pressed={selectedVibe === vibe.id}
            >
              <span class="zl-vibe-swatch vibe-{vibe.id}" aria-hidden="true"
              ></span>
              <span class="zl-vibe-name">{vibe.name}</span>
              {#if selectedVibe === vibe.id}
                <span class="zl-vibe-check" aria-hidden="true">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      </section>
    </div>
  </div>

  <button
    type="button"
    class="zl-modal-backdrop"
    aria-label="Close settings modal"
    tabindex="-1"
    on:click={handleModalClose}
  ></button>
</dialog>

<style>
  :global(dialog.zl-settings-dialog) {
    display: none;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    padding: max(12px, env(safe-area-inset-top))
      max(12px, env(safe-area-inset-right))
      max(16px, env(safe-area-inset-bottom))
      max(12px, env(safe-area-inset-left));
    margin: 0;
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    position: fixed;
    inset: 0;
    z-index: 1000;
    box-sizing: border-box;
  }

  :global(dialog.zl-settings-dialog[open]) {
    display: flex;
  }

  :global(dialog.zl-settings-dialog:focus),
  .zl-settings-card:focus,
  .zl-settings-content:focus {
    outline: none;
  }

  .zl-settings-card {
    position: relative;
    z-index: 1001;
    width: min(92vw, 480px);
    max-height: min(88dvh, 46rem);
    background: var(--zl-card-bg-gradient-color-start, #fff);
    border: var(--zl-card-border-width, 4px) solid
      var(--zl-card-border-color, #000);
    border-radius: var(--zl-card-border-radius, 32px);
    box-shadow: var(--zl-card-box-shadow, 0 12px 30px rgba(0, 0, 0, 0.1));
    padding: 2rem;
    overflow: hidden;
    animation: modal-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  .zl-settings-content {
    max-height: calc(min(88dvh, 46rem) - 4rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.125rem;
  }

  @keyframes modal-pop {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .zl-settings-card {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }

  .zl-settings-header {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: -0.25rem 0 1.5rem;
    padding: 0.25rem 0 0.75rem;
    background: var(--zl-card-bg-gradient-color-start, #fff);
  }

  .zl-settings-title {
    font-family: "Space Mono", monospace;
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--zl-text-color-primary, #000);
    margin: 0;
  }

  .zl-settings-close {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--zl-text-color-secondary, #666);
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .zl-settings-close:hover {
    background: rgba(0, 0, 0, 0.05);
    transform: rotate(90deg);
  }

  .zl-settings-close:focus-visible,
  .zl-setting-action:focus-visible,
  .zl-vibe-option:focus-visible {
    outline: 3px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.45);
    outline-offset: 3px;
  }

  .zl-settings-section {
    margin-bottom: 2rem;
  }

  .zl-section-label {
    font-family: "Space Mono", monospace;
    font-size: 0.85rem;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--zl-text-color-disabled, #999);
    margin-bottom: 1rem;
    letter-spacing: 0;
  }

  .zl-setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.5);
    border: 2px solid var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 16px;
    margin-bottom: 0.75rem;
    transition: all 0.2s;
  }

  .zl-setting-row:hover {
    border-color: var(--zl-primary-color);
    background: white;
  }

  .zl-setting-name {
    font-weight: 800;
    color: var(--zl-text-color-primary, #000);
    display: block;
  }

  .zl-setting-desc {
    font-size: 0.75rem;
    color: var(--zl-text-color-secondary, #666);
    margin: 0.25rem 0 0 0;
  }

  /* Toggle Switch */
  .zl-toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 56px;
    min-width: 56px;
    height: 44px;
    flex-shrink: 0;
  }

  .zl-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .zl-toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 50%;
    left: 0;
    right: auto;
    bottom: auto;
    width: 52px;
    height: 30px;
    background-color: var(--zl-text-color-disabled, #ccc);
    transition: 0.4s;
    border-radius: 24px;
    border: 2px solid transparent;
    transform: translateY(-50%);
  }

  .zl-toggle-slider:before {
    position: absolute;
    content: "";
    height: 22px;
    width: 22px;
    left: 4px;
    bottom: 2px;
    background-color: white;
    transition: 0.4s;
    border-radius: 50%;
  }

  input:checked + .zl-toggle-slider {
    background-color: var(--zl-primary-color, #ffcc33);
  }

  input:checked + .zl-toggle-slider:before {
    transform: translateX(22px);
  }

  .zl-toggle input:focus-visible + .zl-toggle-slider {
    outline: 3px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.45);
    outline-offset: 3px;
  }

  .zl-setting-action {
    background: linear-gradient(
      135deg,
      var(--zl-primary-color, #ffcc33),
      #f2a93b
    );
    border: 2px solid var(--zl-card-border-color, #000000);
    border-radius: 999px;
    box-shadow: 3px 3px 0 #000000;
    color: #111111;
    cursor: pointer;
    flex-shrink: 0;
    font-family: "Space Mono", monospace;
    font-size: 0.78rem;
    font-weight: 900;
    min-height: 44px;
    padding: 0.35rem 0.85rem;
    transition:
      transform 0.16s ease,
      box-shadow 0.16s ease;
  }

  .zl-setting-action:hover,
  .zl-setting-action:focus-visible {
    box-shadow: 4px 4px 0 #000000;
    transform: translate(-1px, -1px);
  }

  /* Vibe Grid */
  .zl-vibe-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 0.75rem;
  }

  .zl-vibe-option {
    position: relative;
    padding: 1rem 0.5rem;
    min-height: 44px;
    background: white;
    border: 2px solid var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: "Space Mono", monospace;
    font-weight: 700;
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    align-items: center;
    justify-content: center;
  }

  .zl-vibe-swatch {
    width: 2.4rem;
    height: 1.1rem;
    border: 2px solid rgba(0, 0, 0, 0.78);
    border-radius: 999px;
    box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.18);
  }

  .vibe-neo {
    background: linear-gradient(90deg, #ffb000, #ffd1dc 52%, #a0e7e5);
  }

  .vibe-focus {
    background: linear-gradient(90deg, #fff9f5, #ffdbc5 48%, #ffab77);
  }

  .vibe-chill {
    background: linear-gradient(90deg, #e5f9f6, #94d7dd 48%, #4da1a9);
  }

  .vibe-zen {
    background: linear-gradient(90deg, #f4efff, #c4b5fd 48%, #8b5cf6);
  }

  .vibe-nocturne {
    background: linear-gradient(90deg, #8db0c8, #7da9ad 48%, #c487d2);
  }

  .zl-vibe-option:hover {
    border-color: var(--zl-primary-color);
    transform: translateY(-2px);
  }

  .zl-vibe-option.active {
    border-color: var(--zl-primary-color);
    background: var(--zl-highlight-color, #fff9f5);
    box-shadow: 0 4px 12px rgba(var(--zl-primary-color-rgb, 0, 0, 0), 0.1);
  }

  .zl-vibe-check {
    position: absolute;
    top: 4px;
    right: 4px;
    background: var(--zl-primary-color);
    color: white;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: bold;
    border: 2px solid white;
  }

  .zl-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    z-index: 1000;
  }

  @media (max-width: 480px) {
    .zl-settings-card {
      width: min(94vw, 30rem);
      max-height: min(88dvh, 42rem);
      padding: 1rem;
      border-radius: 24px;
    }

    .zl-settings-content {
      max-height: calc(min(88dvh, 42rem) - 2rem);
    }

    .zl-settings-header {
      margin-bottom: 0.75rem;
    }

    .zl-setting-row {
      align-items: flex-start;
    }

    .zl-setting-info {
      min-width: 0;
      flex: 1;
    }

    .zl-vibe-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
