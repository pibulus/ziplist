<script>
  import { onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import {
    theme,
    listFirstMode,
    promptStyle,
    isContributor,
    applyTheme,
  } from "$lib";
  import { ANIMATION, PROMPT_STYLES, THEMES } from "$lib/constants";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import { promptManager } from "$lib/services/transcription/promptManager";
  import {
    listPreferences,
    setListPreference,
  } from "$lib/services/lists/listPreferences.js";
  import ThemeMascot from "./ThemeMascot.svelte";
  import ModalCloseButton from "../modals/ModalCloseButton.svelte";

  export let closeModal = () => {};

  let selectedVibe;
  let selectedVoiceStyle = PROMPT_STYLES.STANDARD;
  let listFirstModeValue = false;
  let contributorTimer = null;

  const unsubscribeTheme = theme.subscribe((value) => {
    selectedVibe = value;
  });

  const unsubscribeListFirstMode = listFirstMode.subscribe((value) => {
    listFirstModeValue = value === "true";
  });

  const unsubscribePromptStyle = promptStyle.subscribe((value) => {
    if (value) selectedVoiceStyle = value;
  });

  const vibeOptions = [
    { id: THEMES.HIGHLIGHTER, name: "Highlighter" },
    { id: THEMES.STICKY_NOTE, name: "Sticky Note" },
    { id: THEMES.GEL_PEN, name: "Gel Pen" },
    { id: THEMES.LEGAL_PAD, name: "Legal Pad" },
  ];

  const voiceStyleOptions = [
    { id: PROMPT_STYLES.STANDARD, name: "Plain", hint: "Clean wording" },
    { id: PROMPT_STYLES.SPARKLE_POP, name: "Sparkle", hint: "Bubbly flair" },
    { id: PROMPT_STYLES.SURLY_PIRATE, name: "Pirate", hint: "Salty attitude" },
    { id: PROMPT_STYLES.QUILL_AND_INK, name: "Quill", hint: "Proper ink" },
  ];

  // If the stored style isn't one of the four surfaced styles, sync from promptManager
  if (browser) {
    const activeStyle = promptManager.getCurrentStyle();
    if (activeStyle) selectedVoiceStyle = activeStyle;
  }

  onDestroy(() => {
    if (contributorTimer) clearTimeout(contributorTimer);
    unsubscribeTheme();
    unsubscribeListFirstMode();
    unsubscribePromptStyle();
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

  function changeVoiceStyle(styleId) {
    selectedVoiceStyle = styleId;
    soundService.select();
    promptManager.setStyle(styleId);
    promptStyle.set(styleId);

    if (browser) {
      window.dispatchEvent(
        new CustomEvent("ziplist-setting-changed", {
          detail: { setting: "promptStyle", value: styleId },
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
      <!-- Header (TalkType canon: small mascot circle + Options title) -->
      <div class="flex items-center gap-2">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#1e1714]/15 bg-gradient-to-br from-[#fffef7] to-pink-50"
        >
          <ThemeMascot theme={selectedVibe} size="22px" />
        </div>
        <h3
          id="settings_modal_title"
          class="text-lg font-black tracking-tight text-[#1e1714]"
        >
          Options
        </h3>
        <p id="settings_modal_description" class="sr-only">
          Adjust vibe, voice style, startup screen, and list preferences.
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

      <!-- Voice Style Section -->
      <section
        class="settings-section space-y-1.5"
        aria-labelledby="settings_voice_title"
      >
        <div class="flex items-baseline justify-between gap-2">
          <h4 id="settings_voice_title" class="settings-section-title">
            Voice Style
          </h4>
          <span class="text-[11px] font-semibold text-[#525252]">
            {voiceStyleOptions.find((opt) => opt.id === selectedVoiceStyle)
              ?.hint || "Spoken item tone"}
          </span>
        </div>
        <div
          class="grid grid-cols-4 gap-1.5"
          role="group"
          aria-label="Spoken item voice style"
        >
          {#each voiceStyleOptions as styleOpt}
            <button
              type="button"
              class="voice-option flex min-h-[40px] items-center justify-center rounded-xl border-2 px-1 py-1.5 text-[12px] tracking-tight transition-all duration-150 {selectedVoiceStyle ===
              styleOpt.id
                ? 'selected-voice border-[#1e1714] bg-[var(--zl-cta-color,#ffcc33)] font-black text-[#1e1714]'
                : 'zl-control-border bg-[#fffdf5] font-bold text-[#3f3a36] hover:border-[#1e1714]/50'}"
              on:click={() => changeVoiceStyle(styleOpt.id)}
              title={styleOpt.hint}
              aria-label={`${styleOpt.name} voice style: ${styleOpt.hint}`}
              aria-pressed={selectedVoiceStyle === styleOpt.id}
            >
              <span class="whitespace-nowrap">{styleOpt.name}</span>
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
          <div class="flex items-center justify-between gap-3 py-2">
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
              class="flex min-h-9 items-center justify-end focus:outline-none"
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
          <div class="flex items-center justify-between gap-3 py-2">
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
          <div class="flex items-center justify-between gap-3 py-2">
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

      <!-- Bottom Passport CTA (TalkType parity) -->
      <button
        type="button"
        class="zl-pitch-cta zl-pitch-cta-pink flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1e1714] bg-[#ff5ca8] px-4 py-2.5 text-sm font-black text-[#1e1714] shadow-[2px_2px_0px_#1e1714] transition-all hover:bg-[#ff459b] hover:shadow-[3px_3px_0px_#1e1714] active:translate-y-0.5 active:bg-[#e62e84] active:shadow-[1px_1px_0px_#1e1714]"
        title="12 colour lists, device sync, shared lists, and holo Passport card"
        on:click={openContributorModal}
      >
        <span class="text-sm" aria-hidden="true">✦</span>
        <span class="text-sm font-black tracking-tight text-[#1e1714]">
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
  /* Compact inline segmented pill for 2-state choices */
  .settings-seg {
    display: inline-grid;
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
    min-height: 30px;
    min-width: 54px;
    padding: 0 0.55rem;
    border-radius: 7px;
    border: 1.5px solid transparent;
    background: transparent;
    color: #525252;
    font-size: 0.74rem;
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
    background: var(--zl-cta-color, #ffcc33);
    border-color: #1e1714;
    color: #1e1714;
  }

  .selected-vibe,
  .selected-voice {
    box-shadow: 2px 2px 0px #1e1714;
  }

  .tile-label {
    font-size: 11px;
    line-height: 1.2;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }

  .vibe-option,
  .voice-option {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .vibe-option:active,
  .voice-option:active {
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

  /* Tactile Neo-Toybrut pill toggle switch */
  .auto-start-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    flex-shrink: 0;
    width: 2.55rem;
    height: 1.45rem;
    border-radius: 9999px;
    background: #fbf1e4;
    padding: 0.14rem;
    border: 2px solid #1e1714;
    box-shadow: 1.5px 1.5px 0 #1e1714;
    transition:
      background 0.18s ease,
      box-shadow 0.18s ease;
  }

  .auto-start-glyph span {
    display: block;
    width: 0.92rem;
    height: 0.92rem;
    border-radius: 9999px;
    background: #fffef7;
    border: 1.5px solid #1e1714;
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .auto-start-glyph.is-on {
    background: var(--zl-cta-color, #ffcc33);
  }

  .auto-start-glyph.is-on span {
    transform: translateX(1.06rem);
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
    .voice-option,
    .preview-mascot,
    .auto-start-glyph,
    .auto-start-glyph span {
      transition: none !important;
      transform: none !important;
      animation: none !important;
    }
  }
</style>
