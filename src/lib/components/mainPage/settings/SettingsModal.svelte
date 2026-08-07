<script>
  import { onMount } from "svelte";
  import { theme, listFirstMode, applyTheme, isContributor } from "$lib";
  import { STORAGE_KEYS, THEMES } from "$lib/constants";
  import { PRICING } from "$lib/config/pricing.js";
  import { StorageUtils } from "$lib/services/infrastructure/storageUtils";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import { hapticService } from "$lib/services/infrastructure/hapticService";
  import { listsStore, getMaxListCount } from "$lib/services/lists/listsStore";
  import { listsService } from "$lib/services/lists/listsService";
  import {
    getOrCreateAvatar,
    setAvatarName,
    getAvatarImage,
    rerollAvatar,
  } from "$lib/services/realtime/avatarService";
  import ThemeMascot from "./ThemeMascot.svelte";

  // Props for the modal
  export let closeModal = () => {};

  // Theme/vibe selection
  let selectedVibe;
  let avatarName = "";
  let listFirstModeValue = false;
  let chunkyModeValue = false;
  let contributorUnlocked = false;
  let avatarRerolling = false;

  // Subscribe to theme store
  const unsubscribeTheme = theme.subscribe((value) => {
    selectedVibe = value;
  });

  const unsubscribeListFirstMode = listFirstMode.subscribe((value) => {
    listFirstModeValue = value === "true";
  });

  const unsubscribeContributor = isContributor.subscribe((value) => {
    contributorUnlocked = value;
  });

  // New lists are made from here now — the card header lost its "+" so the
  // list itself stays uncluttered. contributorUnlocked is in the dependency
  // list because unlocking raises the ceiling mid-session.
  $: listCount = $listsStore.lists.length;
  $: maxLists = (contributorUnlocked, getMaxListCount());

  function handleCreateList() {
    const result = listsService.createList();
    if (!result.ok) {
      hapticService.notification("warning");
      soundService.locked();
      if (result.reason === "max-lists") {
        window.dispatchEvent(new CustomEvent("ziplist-open-contributor"));
      }
      return;
    }

    hapticService.notification("success");
    soundService.add({ force: true });
  }

  // Theme options — "The Desk Drawer": four office-supply fluro themes,
  // one collective concept. Curated down from 8 (2026-07-20).
  const vibeOptions = [
    { id: THEMES.HIGHLIGHTER, name: "Highlighter" },
    { id: THEMES.STICKY_NOTE, name: "Sticky Note" },
    { id: THEMES.GEL_PEN, name: "Gel Pen" },
    { id: THEMES.LEGAL_PAD, name: "Legal Pad" },
  ];

  onMount(() => {
    avatarName = getOrCreateAvatar();

    // Check for chunky mode
    if (typeof document !== "undefined") {
      chunkyModeValue =
        document.documentElement.classList.contains("mode-neo-brutalist");
    }

    // Handle native dialog close (Escape key, form method="dialog")
    const dialog = document.getElementById("settings_modal");
    function onDialogClose() {
      closeModal();
      // Reset scroll so the next open starts at the top, not wherever the
      // last visit left off (the dialog stays mounted between opens).
      const content = dialog?.querySelector(".zl-settings-content");
      if (content) content.scrollTop = 0;
    }
    if (dialog) {
      dialog.addEventListener("close", onDialogClose);
    }

    return () => {
      unsubscribeTheme();
      unsubscribeListFirstMode();
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

  function handleModalClose() {
    closeModal();
  }

  function openContributorModal() {
    window.dispatchEvent(new CustomEvent("ziplist-open-contributor"));
  }

  function saveAvatarName(event) {
    avatarName = setAvatarName(event.currentTarget.value);
    event.currentTarget.value = avatarName;
    soundService.select();
  }

  // Click your face, get a new one — the "call me Mum" input above still
  // lets you type your own, this is just the quick shuffle.
  function rerollAvatarFace() {
    avatarName = rerollAvatar(avatarName);
    soundService.select();
    avatarRerolling = true;
    setTimeout(() => {
      avatarRerolling = false;
    }, 420);
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
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </form>
      </div>

      <!-- Vibe picker sits in the open (Pablo's call 2026-07-22): the old
           fold existed because the 2×2 grid ate ~40% of the modal, but as a
           single row of four tiles the whole thing costs one slim strip —
           themes are the app's outfit, they deserve to be seen. -->
      <section
        class="zl-settings-section zl-vibe-section"
        aria-labelledby="settings_vibe_title"
      >
        <h4 id="settings_vibe_title" class="zl-section-label">Vibe</h4>

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
              <span class="zl-vibe-art" aria-hidden="true">
                <ThemeMascot theme={vibe.id} size="30px" />
              </span>
              <span>{vibe.name}</span>
              {#if selectedVibe === vibe.id}
                <span class="zl-vibe-check" aria-hidden="true">✓</span>
              {/if}
            </button>
          {/each}
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
      </section>

      <section class="zl-settings-section" aria-label="List display">
        <div class="zl-toggle-grid">
          <div class="zl-toggle-tile">
            <div class="zl-setting-info">
              <span class="zl-setting-name">List First</span>
              <p class="zl-setting-desc">Hide mascot &amp; title</p>
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
        </div>

        <div class="zl-setting-row">
          <div class="zl-setting-info">
            <span class="zl-setting-name">Name in shared rooms</span>
            <p class="zl-setting-desc">
              Your face and name when a list goes live
            </p>
          </div>
          <div class="zl-avatar-field">
            {#if avatarName}
              <button
                type="button"
                class="zl-avatar-face-btn"
                class:rerolling={avatarRerolling}
                on:click={rerollAvatarFace}
                title="Tap for a new face"
                aria-label="Re-roll avatar face"
              >
                <img
                  class="zl-avatar-face"
                  src={getAvatarImage(avatarName)}
                  alt=""
                  aria-hidden="true"
                />
              </button>
            {/if}
            <input
              type="text"
              class="zl-avatar-input"
              value={avatarName}
              maxlength="48"
              on:change={saveAvatarName}
              aria-label="Name in shared rooms"
            />
          </div>
        </div>
      </section>

      <section
        class="zl-settings-section zl-settings-footer"
        aria-label="Contributor"
      >
        <button
          type="button"
          class="zl-contributor-cta"
          title="More lists, and more of them live at once"
          on:click={openContributorModal}
        >
          <span aria-hidden="true">✦</span>
          <span class="zl-contributor-label">
            {contributorUnlocked
              ? "Contributor unlocked"
              : `Become a Contributor · ${PRICING.displayPrice}`}
          </span>
        </button>
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
  /* One yummy button, same family curve as the app's other squishy controls.
     Was a quiet label with a small amber pill; it now says what you get. */
  .zl-contributor-cta {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.85rem 1.25rem;
    border: 0;
    border-radius: 999px;
    background: #ff6ac2;
    color: #fffdf5;
    font-weight: 900;
    font-size: 0.98rem;
    letter-spacing: -0.01em;
    cursor: pointer;
    box-shadow: 0 10px 22px rgba(255, 106, 194, 0.35);
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }
  .zl-contributor-cta:hover {
    transform: scale(1.02);
    box-shadow: 0 14px 30px rgba(255, 106, 194, 0.5);
  }
  .zl-contributor-cta:active {
    transform: scale(0.97);
  }

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
    /* inset stretches the dialog; 100vw included the desktop scrollbar and
       biased the flex-center a few px right. */
    width: auto;
    height: auto;
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
    /* Chunky's hard 12px shadow hangs right+down; these margins make the
       flex-center split that extra mass so the card+shadow unit sits
       optically centered instead of leaning right. 0 in soft modes. */
    margin: 0 var(--zl-card-shadow-x, 0px) var(--zl-card-shadow-y, 0px) 0;
    width: min(92vw, 30rem);
    max-height: min(92dvh, 58rem);
    background: var(--zl-card-bg-gradient-color-start, #fff);
    border: var(--zl-card-border-width, 4px) solid
      var(--zl-card-border-color, #000);
    border-radius: var(--zl-card-border-radius, 28px);
    box-shadow: var(--zl-card-box-shadow, 0 12px 30px rgba(0, 0, 0, 0.1));
    padding: 1.5rem;
    overflow: hidden;
    animation: modal-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  .zl-settings-content {
    max-height: calc(min(92dvh, 58rem) - 3rem);
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
    margin: -0.25rem 0 0.85rem;
    padding: 0.25rem 0 0.5rem;
    background: var(--zl-card-bg-gradient-color-start, #fff);
  }

  .zl-settings-title {
    font-family: "Space Mono", monospace;
    font-size: var(--font-size-xl, 1.5rem);
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
    margin-bottom: 1.1rem;
  }

  .zl-settings-section:last-child {
    margin-bottom: 0.25rem;
  }

  /* Contributor sits apart from the everyday settings — a quiet divider
     instead of another shouting section label. */
  .zl-settings-footer {
    border-top: 2px dashed var(--zl-item-border-color, rgba(0, 0, 0, 0.12));
    padding-top: 0.85rem;
  }

  .zl-settings-footer .zl-setting-row {
    margin-bottom: 0;
  }

  /* The vibe grid hands off to its sibling Chunky Mode row */
  .zl-vibe-grid + .zl-setting-row {
    margin-top: 0.6rem;
  }

  .zl-section-label {
    font-family: "Space Mono", monospace;
    font-size: var(--font-size-xs, 0.8rem);
    font-weight: 800;
    text-transform: uppercase;
    color: var(--zl-text-color-disabled, #999);
    margin-bottom: 0.6rem;
    letter-spacing: 0;
  }

  .zl-setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0.85rem;
    background: rgba(255, 255, 255, 0.5);
    border: 2px solid var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 16px;
    margin-bottom: 0.6rem;
    transition: all 0.2s;
  }

  /* Flow is down to one toggle. Ready Mic wrote a preference nothing ever
     read, and Sound Cues is no longer a choice — sound is just part of the
     feel. A single tile in a 2-up grid would sit as a half-width orphan, so
     the grid is one column now. */
  .zl-toggle-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.6rem;
    margin-bottom: 0.6rem;
  }

  /* Making a list moved here from the card header, so it needs to read as
     the row's action — flat brand-yellow CTA, per the design laws. */
  .zl-settings-action {
    flex-shrink: 0;
    padding: 0.5rem 0.9rem;
    border: 2px solid var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 12px;
    background: var(--zl-cta-color, #ffb000);
    color: var(--zl-text-color-primary, #1e1714);
    font-family: "Space Mono", monospace;
    font-size: 0.8rem;
    font-weight: 800;
    cursor: pointer;
    transition:
      transform 0.16s ease,
      opacity 0.16s ease;
  }

  .zl-settings-action:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .zl-settings-action:disabled {
    opacity: 0.5;
    cursor: default;
    background: transparent;
  }

  .zl-toggle-tile {
    grid-column: span 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.65rem 0.75rem;
    background: rgba(255, 255, 255, 0.5);
    border: 2px solid var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 16px;
    transition: all 0.2s;
  }

  .zl-toggle-tile:hover {
    border-color: var(--zl-primary-color);
    background: white;
  }

  .zl-toggle-tile:last-child {
    grid-column: span 2;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .zl-toggle-tile .zl-setting-name {
    font-size: var(--font-size-xs, 0.8rem);
  }

  .zl-toggle-tile .zl-setting-desc {
    font-size: 0.68rem;
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
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--zl-text-color-secondary, #666);
    margin: 0.25rem 0 0 0;
  }

  .zl-avatar-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    min-width: 0;
  }

  /* 44px tap target wraps the 30px face — bestie, no acrylic-defeating
     targets in this house. Squish-then-spin on click/tap, satisfying
     without being disruptive. */
  .zl-avatar-face-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.15s ease;
  }

  .zl-avatar-face-btn:hover {
    transform: scale(1.08);
  }

  .zl-avatar-face-btn:active {
    transform: scale(0.9);
  }

  .zl-avatar-face-btn:focus-visible {
    outline: 3px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.45);
    outline-offset: 2px;
  }

  .zl-avatar-face-btn.rerolling .zl-avatar-face {
    animation: avatar-reroll-spin 0.42s
      var(--zl-transition-easing-bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
  }

  @keyframes avatar-reroll-spin {
    0% {
      transform: scale(1) rotate(0deg);
    }
    40% {
      transform: scale(0.72) rotate(160deg);
    }
    100% {
      transform: scale(1) rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .zl-avatar-face-btn,
    .zl-avatar-face-btn:hover,
    .zl-avatar-face-btn:active {
      transition: none;
      transform: none;
    }
    .zl-avatar-face-btn.rerolling .zl-avatar-face {
      animation: none;
    }
  }

  .zl-avatar-face {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    background: rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.25);
    flex-shrink: 0;
  }

  .zl-avatar-input {
    width: 9.5rem;
    min-height: 44px;
    padding: 0.3rem 0.6rem;
    border: 2px solid var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.8);
    font-family: "Space Mono", monospace;
    font-size: var(--font-size-xs, 0.8rem);
    font-weight: 700;
    color: var(--zl-text-color-primary, #444);
    outline: none;
    transition: var(--zl-transition-fast, all 0.2s ease);
  }

  .zl-avatar-input:focus-visible {
    border-color: var(--zl-primary-color, #ffb000);
    outline: none;
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
    background: var(--zl-cta-color, #ffb000);
    border: 0;
    border-radius: 999px;
    box-shadow: 0 3px 8px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.25);
    color: #111111;
    cursor: pointer;
    flex-shrink: 0;
    font-family: "Space Mono", monospace;
    font-size: var(--font-size-xs, 0.78rem);
    font-weight: 900;
    min-height: 44px;
    padding: 0.35rem 0.85rem;
    transition: var(--zl-transition-fast, all 0.2s ease);
  }

  .zl-setting-action:hover,
  .zl-setting-action:focus-visible {
    box-shadow: 0 5px 14px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.32);
    filter: saturate(1.08) brightness(1.04);
    transform: translateY(-1px);
  }

  /* Chunky mode gets its hard-shadow identity back — gated, not leaked */
  :global(html.mode-neo-brutalist) .zl-setting-action {
    border: 2px solid #000000;
    box-shadow: 3px 3px 0 #000000;
  }

  :global(html.mode-neo-brutalist) .zl-setting-action:hover,
  :global(html.mode-neo-brutalist) .zl-setting-action:focus-visible {
    box-shadow: 4px 4px 0 #000000;
    filter: none;
    transform: translate(-1px, -1px);
  }

  /* Vibe Grid — one row of 4 (The Desk Drawer roster, Pablo's call
     2026-07-22): the four vibes read as a single palette strip. Tiles
     slim down so the row fits a 390px phone. */
  .zl-vibe-grid {
    display: grid;
    /* minmax(0, 1fr): plain 1fr won't shrink below "Highlighter"'s
       min-content width, which made the four columns uneven. */
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.45rem;
  }

  .zl-vibe-option > :global(span),
  .zl-vibe-option {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .zl-vibe-option {
    position: relative;
    padding: 0.55rem 0.2rem;
    min-height: 44px;
    background: white;
    border: 2px solid var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: "Space Mono", monospace;
    font-weight: 700;
    /* fits "Highlighter" in a 4-up tile on a 390px phone */
    font-size: clamp(0.58rem, 2.5vw, 0.78rem);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: center;
    justify-content: center;
  }

  .zl-vibe-art {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
  }

  .zl-vibe-option:hover {
    border-color: var(--zl-primary-color);
    transform: translateY(-2px);
  }

  .zl-vibe-option:hover .zl-vibe-art {
    transform: scale(1.12);
  }

  @media (prefers-reduced-motion: reduce) {
    .zl-vibe-art,
    .zl-vibe-option:hover .zl-vibe-art {
      transition: none;
      transform: none;
    }
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

    /* Canonical 4-up holds on mobile; tighten padding so tiles fit. */
    .zl-vibe-grid {
      gap: 0.5rem;
    }

    .zl-vibe-option {
      padding: 0.75rem 0.25rem;
    }

    /* Avatar row stacks on narrow screens — the label + a 9.5rem input
       side by side wrap into a tall, ragged block otherwise. */
    .zl-setting-row {
      padding: 0.6rem 0.75rem;
      margin-bottom: 0.5rem;
    }

    .zl-avatar-field {
      width: 100%;
      margin-top: 0.4rem;
    }

    .zl-avatar-input {
      width: 100%;
      flex: 1;
      min-width: 0;
    }

    .zl-settings-section {
      margin-bottom: 0.85rem;
    }
  }

  /* The avatar row is the one row that needs to wrap; the rest stay inline. */
  .zl-settings-section .zl-setting-row:has(.zl-avatar-field) {
    flex-wrap: wrap;
  }
</style>
