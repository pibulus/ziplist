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
      if (listFirstModeValue) {
        document.documentElement.dataset.listFirst = "true";
      } else {
        delete document.documentElement.dataset.listFirst;
      }
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
      class="zl-modal-scroll-area min-h-0 space-y-3 overflow-y-auto overflow-x-hidden pb-1 pr-0.5"
    >
      <!-- Header (small mascot circle + Options title) -->
      <div class="flex items-center gap-2">
        <div class="options-mascot-badge">
          <ThemeMascot theme={selectedVibe} size="22px" />
        </div>
        <h3
          id="settings_modal_title"
          class="text-lg font-black tracking-tight text-[#1e1714]"
        >
          Options
        </h3>
        <p id="settings_modal_description" class="sr-only">
          Adjust vibe, startup screen, and list preferences.
        </p>
      </div>

      <!-- Vibe Section -->
      <section
        class="settings-section space-y-1.5"
        aria-labelledby="settings_vibe_title"
      >
        <h4 id="settings_vibe_title" class="settings-section-title">Vibe</h4>
        <div class="grid grid-cols-4 gap-1.5" role="group" aria-label="Vibe">
          {#each vibeOptions as vibe}
            <button
              type="button"
              class="vibe-option relative flex min-h-[64px] flex-col items-center justify-center rounded-xl border-2 px-1 py-1.5 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 active:translate-y-0.5 {selectedVibe ===
              vibe.id
                ? 'selected-vibe border-[#1e1714] bg-[#fffef7]'
                : 'zl-control-border bg-[#fffdf5]'}"
              on:click={() => changeVibe(vibe.id)}
              aria-label={`Choose ${vibe.name} vibe`}
              aria-pressed={selectedVibe === vibe.id}
            >
              <span class="preview-mascot mb-0.5">
                <ThemeMascot theme={vibe.id} size="26px" />
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

      <!-- Lists & View Section -->
      <section
        class="settings-section space-y-1.5"
        aria-labelledby="settings_system_title"
      >
        <h4 id="settings_system_title" class="settings-section-title">
          Lists &amp; View
        </h4>

        <div
          class="zl-control-border divide-y divide-[#1e1714]/10 rounded-2xl border-2 bg-[#fffdf5] px-3 py-1 shadow-sm"
        >
          <!-- Row 1: List-first mode -->
          <div
            class="flex min-h-[48px] items-center justify-between gap-3 py-1.5"
          >
            <div
              class="min-w-0 flex-1 cursor-pointer select-none"
              role="button"
              tabindex="0"
              on:click={toggleListFirstMode}
              on:keydown={(e) => e.key === "Enter" && toggleListFirstMode()}
            >
              <span
                class="block text-[13px] font-black leading-tight text-[#1e1714]"
              >
                Straight to the list
              </span>
              <span
                class="row-sub mt-0.5 block truncate text-[11px] font-semibold leading-tight"
              >
                Skip hero title · corner mic
              </span>
            </div>
            <button
              type="button"
              class="flex min-h-11 min-w-11 items-center justify-end focus:outline-none"
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

          <!-- Row 2: Spoken & pasted item placement -->
          <div
            class="flex min-h-[48px] items-center justify-between gap-3 py-1.5"
          >
            <div class="min-w-0 flex-1">
              <span
                class="block text-[13px] font-black leading-tight text-[#1e1714]"
              >
                Voice &amp; paste land
              </span>
              <span
                class="row-sub mt-0.5 block truncate text-[11px] font-semibold leading-tight"
              >
                Where batch adds arrive
              </span>
            </div>
            <div
              class="settings-seg"
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

          <!-- Row 3: Checked items visibility -->
          <div
            class="flex min-h-[48px] items-center justify-between gap-3 py-1.5"
          >
            <div class="min-w-0 flex-1">
              <span
                class="block text-[13px] font-black leading-tight text-[#1e1714]"
              >
                Checked items
              </span>
              <span
                class="row-sub mt-0.5 block truncate text-[11px] font-semibold leading-tight"
              >
                Stay saved when hidden
              </span>
            </div>
            <div
              class="settings-seg"
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
          </div>
        </div>
      </section>

      <!-- Bottom Passport CTA -->
      <button
        type="button"
        class="zl-pitch-cta"
        title="12 colour lists, device sync, shared lists, and holo Passport card"
        on:click={openContributorModal}
      >
        <span class="text-sm" aria-hidden="true">✦</span>
        <span class="text-sm font-black tracking-tight">
          {$isContributor ? "Open ZipList Passport" : "Grab ZipList Passport"}
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
  .options-mascot-badge {
    display: flex;
    width: 2rem;
    height: 2rem;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    border: 2px solid rgba(30, 23, 20, 0.2);
    background: color-mix(
      in srgb,
      var(--zl-primary-color, #ffb000) 14%,
      #fffef7
    );
  }

  /* Uniform width across stacked rows so left & right edges align cleanly */
  .settings-seg {
    display: inline-grid;
    width: 8.75rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 2px;
    gap: 2px;
    border-radius: 11px;
    border: 2px solid #1e1714;
    background: #fbf1e4;
    box-shadow: 1.5px 1.5px 0 #1e1714;
    flex-shrink: 0;
  }

  .settings-seg button {
    min-height: 34px;
    min-width: 0;
    padding: 0 0.45rem;
    border-radius: 7px;
    border: 1.5px solid transparent;
    background: transparent;
    color: #525252;
    font-size: 0.75rem;
    font-weight: 800;
    line-height: 1;
    transition:
      background-color 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .settings-seg button:hover:not(.chosen) {
    color: #1e1714;
  }

  .settings-seg button.chosen {
    background: var(--zl-vibe-control-bg, #ffb000);
    border-color: #1e1714;
    color: #1e1714;
  }

  .selected-vibe {
    box-shadow: 2px 2px 0px #1e1714;
  }

  .tile-label {
    font-size: 11px;
    line-height: 1.2;
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
    transform: scale(1.14) rotate(4deg);
  }

  .vibe-option:active .preview-mascot {
    transform: scale(0.88) rotate(-2deg);
  }

  /* Tactile Neo-Toybrut pill toggle switch following active Vibe */
  .auto-start-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    flex-shrink: 0;
    width: 2.65rem;
    height: 1.5rem;
    border-radius: 9999px;
    background: #fbf1e4;
    padding: 0.15rem;
    border: 2px solid #1e1714;
    box-shadow: 1.5px 1.5px 0 #1e1714;
    transition:
      background 0.18s ease,
      box-shadow 0.18s ease;
  }

  .auto-start-glyph span {
    display: block;
    width: 0.94rem;
    height: 0.94rem;
    border-radius: 9999px;
    background: #fffef7;
    border: 1.5px solid #1e1714;
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .auto-start-glyph.is-on {
    background: var(--zl-vibe-control-bg, #ffb000);
  }

  .auto-start-glyph.is-on span {
    transform: translateX(1.12rem);
  }

  /* Row subtitles: a quiet neutral grey, never a muddy brown. */
  .row-sub {
    color: #525252;
  }

  .settings-section-title {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 900;
    line-height: 1;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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
