<script>
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { theme, listFirstMode, isContributor, applyTheme } from "$lib";
  import { ANIMATION, THEMES } from "$lib/constants";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import {
    getOrCreateAvatar,
    setAvatarName,
    getAvatarImage,
    rerollAvatar,
  } from "$lib/services/realtime/avatarService";
  import ThemeMascot from "./ThemeMascot.svelte";
  import ModalCloseButton from "../modals/ModalCloseButton.svelte";

  export let closeModal = () => {};

  let selectedVibe;
  let avatarName = "";
  let listFirstModeValue = false;
  let avatarRerolling = false;
  let rerollTimer = null;
  let contributorTimer = null;

  const unsubscribeTheme = theme.subscribe((value) => {
    selectedVibe = value;
  });

  const unsubscribeListFirstMode = listFirstMode.subscribe((value) => {
    listFirstModeValue = value === "true";
  });

  const vibeOptions = [
    { id: THEMES.HIGHLIGHTER, name: "Highlighter" },
    { id: THEMES.STICKY_NOTE, name: "Sticky Note" },
    { id: THEMES.GEL_PEN, name: "Gel Pen" },
    { id: THEMES.LEGAL_PAD, name: "Legal Pad" },
  ];

  onMount(() => {
    avatarName = getOrCreateAvatar();
  });

  onDestroy(() => {
    if (rerollTimer) clearTimeout(rerollTimer);
    if (contributorTimer) clearTimeout(contributorTimer);
    unsubscribeTheme();
    unsubscribeListFirstMode();
  });

  function changeVibe(vibeId) {
    selectedVibe = vibeId;
    soundService.select();
    applyTheme(vibeId);

    if (browser) {
      window.dispatchEvent(
        new CustomEvent("ziplist-setting-changed", {
          detail: { setting: "theme", value: vibeId },
        }),
      );
    }
  }

  function toggleListFirstMode() {
    listFirstModeValue = !listFirstModeValue;
    soundService.select();
    listFirstMode.set(listFirstModeValue.toString());

    if (browser) {
      window.dispatchEvent(
        new CustomEvent("ziplist-setting-changed", {
          detail: { setting: "listFirstMode", value: listFirstModeValue },
        }),
      );
    }
  }

  function handleModalClose() {
    closeModal();
  }

  function openContributorModal() {
    if (!browser) return;
    handleModalClose();
    if (contributorTimer) clearTimeout(contributorTimer);
    contributorTimer = setTimeout(() => {
      contributorTimer = null;
      window.dispatchEvent(new CustomEvent("ziplist-open-contributor"));
    }, ANIMATION.MODAL.CLOSE_DURATION + 30);
  }

  function saveAvatarName(event) {
    avatarName = setAvatarName(event.currentTarget.value);
    event.currentTarget.value = avatarName;
    soundService.select();
  }

  function rerollAvatarFace() {
    avatarName = rerollAvatar(avatarName);
    soundService.select();
    avatarRerolling = true;
    if (rerollTimer) clearTimeout(rerollTimer);
    rerollTimer = setTimeout(() => {
      avatarRerolling = false;
      rerollTimer = null;
    }, 420);
  }
</script>

<dialog
  id="settings_modal"
  class="modal"
  aria-labelledby="settings_modal_title"
  aria-describedby="settings_modal_description"
  aria-modal="true"
>
  <div class="zl-modal-md zl-modal-contained modal-box relative">
    <form method="dialog">
      <ModalCloseButton
        closeModal={handleModalClose}
        label="Close options"
        modalId="settings_modal"
      />
    </form>

    <!-- Keep scrolling inside the rounded panel -->
    <div
      class="zl-modal-scroll-area min-h-0 space-y-4 overflow-y-auto overflow-x-hidden pb-1.5 pr-1"
    >
      <!-- Header (TalkType canon: small mascot circle + Options title) -->
      <div class="mb-1 flex items-center gap-2">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full border border-pink-200/60 bg-gradient-to-br from-[#fffef7] to-pink-50 shadow-sm"
        >
          <ThemeMascot theme={selectedVibe} size="22px" />
        </div>
        <h3
          id="settings_modal_title"
          class="text-xl font-black tracking-tight text-[#1e1714]"
        >
          Options
        </h3>
        <p id="settings_modal_description" class="sr-only">
          Adjust vibe, startup screen, and shared room handle.
        </p>
      </div>

      <!-- Vibe Section -->
      <section
        class="settings-section space-y-2"
        aria-labelledby="settings_vibe_title"
      >
        <h4 id="settings_vibe_title" class="settings-section-title">Vibe</h4>
        <div class="grid grid-cols-4 gap-2" role="group" aria-label="Vibe">
          {#each vibeOptions as vibe}
            <button
              type="button"
              class="vibe-option relative flex min-h-[76px] flex-col items-center justify-center rounded-2xl border-2 px-1 py-2 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 active:translate-y-0.5 {selectedVibe ===
              vibe.id
                ? 'selected-vibe border-[#1e1714] bg-[#fffef7]'
                : 'zl-control-border bg-[#fffdf5]'}"
              on:click={() => changeVibe(vibe.id)}
              aria-label={`Choose ${vibe.name} vibe`}
              aria-pressed={selectedVibe === vibe.id}
            >
              <span class="preview-mascot mb-1">
                <ThemeMascot theme={vibe.id} size="30px" />
              </span>
              <span
                class="tile-label {selectedVibe === vibe.id
                  ? 'font-black text-[#1e1714]'
                  : 'font-semibold text-[#525252]'}"
              >
                {vibe.name}
              </span>
            </button>
          {/each}
        </div>
      </section>

      <!-- System Section -->
      <section
        class="settings-section space-y-2"
        aria-labelledby="settings_system_title"
      >
        <h4 id="settings_system_title" class="settings-section-title">
          System
        </h4>

        <div
          class="zl-control-border space-y-3 rounded-2xl border-2 bg-[#fffdf5] p-3.5 shadow-sm"
        >
          <!-- List-first mode row -->
          <div class="flex items-center justify-between gap-3">
            <div
              class="min-w-0 flex-1 cursor-pointer select-none"
              role="button"
              tabindex="0"
              on:click={toggleListFirstMode}
              on:keydown={(e) => e.key === "Enter" && toggleListFirstMode()}
            >
              <span
                class="block text-sm font-black leading-tight text-[#1e1714]"
              >
                Straight to the list
              </span>
              <span
                class="row-sub mt-0.5 block truncate text-[11px] font-semibold leading-tight"
              >
                Open directly on the active list
              </span>
            </div>
            <button
              type="button"
              class="flex min-h-11 min-w-11 items-center justify-end transition-opacity focus:outline-none"
              aria-pressed={listFirstModeValue}
              aria-label={`${listFirstModeValue ? "Disable" : "Enable"} straight to the list`}
              on:click={toggleListFirstMode}
            >
              <span
                class="auto-start-glyph"
                class:is-on={listFirstModeValue}
                aria-hidden="true"
              >
                <span></span>
              </span>
            </button>
          </div>

          <div class="zl-divider border-t"></div>

          <!-- Shared Room Face (Avatar + Handle) -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 flex-1 items-center gap-2.5">
              {#if avatarName}
                <button
                  type="button"
                  class="avatar-face-btn zl-control-border relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-[#fffef7] shadow-sm transition-transform hover:scale-105 active:scale-90"
                  class:rerolling={avatarRerolling}
                  on:click={rerollAvatarFace}
                  title="Tap for a new face"
                  aria-label="Re-roll shared room avatar"
                >
                  <img
                    class="h-8 w-8 rounded-full object-cover"
                    src={getAvatarImage(avatarName)}
                    alt=""
                    aria-hidden="true"
                  />
                </button>
              {/if}
              <div class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm font-black leading-tight text-[#1e1714]"
                >
                  Name in shared rooms
                </span>
                <span
                  class="row-sub mt-0.5 block truncate text-[11px] font-semibold leading-tight"
                >
                  Tap avatar to re-roll
                </span>
              </div>
            </div>

            <input
              type="text"
              class="zl-control-border min-h-11 w-32 shrink-0 rounded-xl border-2 bg-[#fffef7] px-2.5 py-1.5 font-mono text-base font-bold text-[#1e1714] transition-colors focus:border-[#1e1714] focus:outline-none sm:w-40 sm:text-xs"
              value={avatarName}
              maxlength="48"
              on:change={saveAvatarName}
              aria-label="Handle in shared rooms"
            />
          </div>
        </div>
      </section>

      <!-- Bottom Passport CTA (TalkType parity) -->
      <button
        type="button"
        class="zl-pitch-cta zl-pitch-cta-pink flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1e1714] bg-[#ff5ca8] px-4 py-3 text-base font-black text-[#1e1714] shadow-[2px_2px_0px_#1e1714] transition-all hover:bg-[#ff459b] hover:shadow-[3px_3px_0px_#1e1714] active:translate-y-0.5 active:bg-[#e62e84] active:shadow-[1px_1px_0px_#1e1714]"
        title="12 colour lists, device sync, live shared rooms, and holo Passport card"
        on:click={openContributorModal}
      >
        <span class="text-base" aria-hidden="true">✦</span>
        <span class="text-base font-black tracking-tight text-[#1e1714]">
          {$isContributor
            ? "Open ZipList Passport"
            : "+ Grab the ZipList Passport!"}
        </span>
      </button>
    </div>
  </div>

  <button
    type="button"
    class="modal-backdrop"
    aria-label="Close options modal"
    tabindex="-1"
    on:click|self|preventDefault|stopPropagation={handleModalClose}
    on:keydown={(e) => e.key === "Enter" && handleModalClose()}
  ></button>
</dialog>

<style>
  .selected-vibe {
    box-shadow: 2px 2px 0px #1e1714;
  }

  .tile-label {
    font-size: 11.5px;
    line-height: 1.25;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }

  .vibe-option {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .vibe-option:active {
    box-shadow: none !important;
  }

  .preview-mascot {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .vibe-option:hover .preview-mascot {
    transform: scale(1.15) rotate(4deg);
  }

  .vibe-option:active .preview-mascot {
    transform: scale(0.88) rotate(-2deg);
  }

  /* Soft pill toggle switch (TalkType canon) */
  .auto-start-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    flex-shrink: 0;
    width: 2rem;
    height: 1.15rem;
    border-radius: 9999px;
    background: #e5e7eb;
    padding: 0.16rem;
    border: none;
    box-shadow: none;
    transition:
      background 0.2s ease,
      box-shadow 0.2s ease;
  }

  .auto-start-glyph span {
    display: block;
    width: 0.82rem;
    height: 0.82rem;
    border-radius: 9999px;
    background: #fffef7;
    border: none;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
    transition: transform 0.2s ease;
  }

  .auto-start-glyph.is-on {
    background: color-mix(in srgb, var(--zl-vibe-caret, #f472b6) 62%, #fffef7);
    box-shadow: 0 0 0 0.22rem
      color-mix(in srgb, var(--zl-vibe-caret, #f472b6) 18%, transparent);
  }

  .auto-start-glyph.is-on span {
    transform: translateX(0.82rem);
  }

  /* Row subtitles: a quiet neutral grey, never a muddy brown. */
  .row-sub {
    color: #525252;
  }

  .settings-section-title {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 900;
    line-height: 1;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .avatar-face-btn.rerolling img {
    animation: avatar-spin 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes avatar-spin {
    0% {
      transform: scale(0.9) rotate(0deg);
    }
    50% {
      transform: scale(1.15) rotate(180deg);
    }
    100% {
      transform: scale(1) rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .vibe-option,
    .preview-mascot,
    .auto-start-glyph,
    .auto-start-glyph span,
    .avatar-face-btn.rerolling img {
      transition: none !important;
      transform: none !important;
      animation: none !important;
    }
  }
</style>
