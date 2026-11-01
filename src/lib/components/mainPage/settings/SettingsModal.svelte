<script>
  import { onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { theme, listFirstMode, isContributor, applyTheme } from "$lib";
  import { ANIMATION, THEMES } from "$lib/constants";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import {
    listPreferences,
    setListPreference,
  } from "$lib/services/lists/listPreferences.js";
  import ThemeMascot from "./ThemeMascot.svelte";
  import ModalCloseButton from "../modals/ModalCloseButton.svelte";

  export let closeModal = () => {};

  let selectedVibe;
  let listFirstModeValue = false;
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

  onDestroy(() => {
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

  function changeListPreference(key, value) {
    setListPreference(key, value);
    soundService.select();
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
          Adjust vibe, startup screen, and list preferences.
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
                No big title · mic stays
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

          <div class="space-y-1.5">
            <span class="block text-sm font-black text-[#1e1714]"
              >New items</span
            >
            <div
              class="settings-choice"
              role="group"
              aria-label="New item position"
            >
              <button
                type="button"
                class:chosen={$listPreferences.newItems === "top"}
                aria-pressed={$listPreferences.newItems === "top"}
                on:click={() => changeListPreference("newItems", "top")}
                >Top</button
              >
              <button
                type="button"
                class:chosen={$listPreferences.newItems === "bottom"}
                aria-pressed={$listPreferences.newItems === "bottom"}
                on:click={() => changeListPreference("newItems", "bottom")}
                >Bottom</button
              >
            </div>
          </div>

          <div class="zl-divider border-t"></div>

          <div class="space-y-1.5">
            <span class="block text-sm font-black text-[#1e1714]"
              >Checked items</span
            >
            <div
              class="settings-choice"
              role="group"
              aria-label="Checked item visibility"
            >
              <button
                type="button"
                class:chosen={$listPreferences.showChecked}
                aria-pressed={$listPreferences.showChecked}
                on:click={() => changeListPreference("showChecked", true)}
                >Show</button
              >
              <button
                type="button"
                class:chosen={!$listPreferences.showChecked}
                aria-pressed={!$listPreferences.showChecked}
                on:click={() => changeListPreference("showChecked", false)}
                >Hide</button
              >
            </div>
            <span class="row-sub block text-[11px] font-semibold"
              >Checked items stay saved either way</span
            >
          </div>
        </div>
      </section>

      <!-- Bottom Passport CTA (TalkType parity) -->
      <button
        type="button"
        class="zl-pitch-cta zl-pitch-cta-pink flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1e1714] bg-[#ff5ca8] px-4 py-3 text-base font-black text-[#1e1714] shadow-[2px_2px_0px_#1e1714] transition-all hover:bg-[#ff459b] hover:shadow-[3px_3px_0px_#1e1714] active:translate-y-0.5 active:bg-[#e62e84] active:shadow-[1px_1px_0px_#1e1714]"
        title="12 colour lists, device sync, shared lists, and holo Passport card"
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
  .settings-choice {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .settings-choice button {
    min-height: 44px;
    border: 2px solid #1e1714;
    border-radius: 12px;
    background: #fffef7;
    color: #1e1714;
    font-size: 0.8rem;
    font-weight: 800;
  }

  .settings-choice button.chosen {
    background: var(--zl-cta-color, #ffcc33);
    box-shadow: 2px 2px 0 #1e1714;
  }
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

  @media (prefers-reduced-motion: reduce) {
    .vibe-option,
    .preview-mascot,
    .auto-start-glyph,
    .auto-start-glyph span {
      transition: none !important;
      transform: none !important;
      animation: none !important;
    }
  }
</style>
