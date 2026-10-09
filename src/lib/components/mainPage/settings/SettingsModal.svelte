<script>
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { theme, listFirstMode, applyTheme } from "$lib";
  import { THEMES } from "$lib/constants";
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

    const dialog = document.getElementById("settings_modal");
    function onDialogClose() {
      closeModal();
    }
    if (dialog) {
      dialog.addEventListener("close", onDialogClose);
    }

    return () => {
      if (dialog) {
        dialog.removeEventListener("close", onDialogClose);
      }
    };
  });

  onDestroy(() => {
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

  function saveAvatarName(event) {
    avatarName = setAvatarName(event.currentTarget.value);
    event.currentTarget.value = avatarName;
    soundService.select();
  }

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
  class="modal"
  aria-labelledby="settings_modal_title"
  aria-describedby="settings_modal_description"
  aria-modal="true"
>
  <div class="zl-modal-md modal-box relative">
    <form method="dialog">
      <ModalCloseButton
        closeModal={handleModalClose}
        label="Close options"
        position="right-3 top-3"
        modalId="settings_modal"
      />
    </form>

    <div class="space-y-4 pb-1">
      <!-- Header (TalkType canon: small mascot circle + Options title) -->
      <div class="mb-1 flex items-center gap-2">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full border border-pink-200/60 bg-gradient-to-br from-white to-pink-50 shadow-sm"
        >
          <ThemeMascot theme={selectedVibe} size="22px" />
        </div>
        <h3
          id="settings_modal_title"
          class="text-xl font-black tracking-tight text-gray-800"
        >
          Options
        </h3>
        <p id="settings_modal_description" class="sr-only">
          Adjust vibe, preferences, and identity in shared rooms.
        </p>
      </div>

      <!-- Vibe Section -->
      <section class="space-y-2" aria-labelledby="settings_vibe_title">
        <h4 id="settings_vibe_title" class="settings-section-title">Vibe</h4>
        <div class="grid grid-cols-4 gap-2" role="group" aria-label="Vibe">
          {#each vibeOptions as vibe}
            <button
              type="button"
              class="vibe-option relative flex min-h-[72px] flex-col items-center justify-center rounded-xl border border-pink-100 bg-[#fffdf5] p-2 shadow-sm transition-all duration-200 hover:border-pink-200 hover:shadow-md {selectedVibe ===
              vibe.id
                ? 'selected-vibe border-pink-300 ring-2 ring-pink-200 ring-opacity-60'
                : ''}"
              on:click={() => changeVibe(vibe.id)}
              aria-label={`Use ${vibe.name} vibe`}
              aria-pressed={selectedVibe === vibe.id}
            >
              <span class="preview-mascot mb-1">
                <ThemeMascot theme={vibe.id} size="28px" />
              </span>
              <span class="tile-label text-[11px] font-bold text-gray-700">
                {vibe.name}
              </span>
              {#if selectedVibe === vibe.id}
                <div
                  class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-[10px] font-black text-white shadow-sm"
                  aria-hidden="true"
                >
                  ✓
                </div>
              {/if}
            </button>
          {/each}
        </div>
      </section>

      <!-- Preferences Section -->
      <section class="space-y-2.5 pt-1" aria-label="Preferences">
        <h4 class="settings-section-title">Preferences</h4>

        <!-- Straight to the list toggle -->
        <button
          type="button"
          class={`setting-row flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition-all duration-200 ${
            listFirstModeValue
              ? "border-pink-300 bg-pink-50 text-gray-900 ring-2 ring-pink-100"
              : "border-pink-100 bg-[#fffdf5] text-gray-700 hover:border-pink-200 hover:bg-pink-50/70"
          }`}
          aria-pressed={listFirstModeValue}
          on:click={toggleListFirstMode}
        >
          <div class="min-w-0 pr-2">
            <span class="block text-sm font-black leading-tight text-gray-900">
              Straight to the list
            </span>
            <span
              class="mt-0.5 block text-[11px] font-bold leading-tight text-gray-500"
            >
              Skip the microphone screen on startup
            </span>
          </div>
          <span
            class="auto-start-glyph {listFirstModeValue ? 'is-on' : ''}"
            aria-hidden="true"
          >
            <span></span>
          </span>
        </button>

        <!-- Name in shared rooms (streamlined compact row) -->
        <div
          class="setting-row flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-pink-100 bg-[#fffdf5] px-3.5 py-2.5 shadow-sm transition-all duration-200 hover:border-pink-200"
        >
          <div class="flex min-w-0 items-center gap-2.5">
            {#if avatarName}
              <button
                type="button"
                class="avatar-face-btn shadow-xs relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pink-200/70 bg-gradient-to-br from-white to-pink-50 transition-transform active:scale-90"
                class:rerolling={avatarRerolling}
                on:click={rerollAvatarFace}
                title="Tap for a new face"
                aria-label="Re-roll avatar face"
              >
                <img
                  class="h-7 w-7 rounded-full object-cover"
                  src={getAvatarImage(avatarName)}
                  alt=""
                  aria-hidden="true"
                />
              </button>
            {/if}
            <div class="min-w-0">
              <span
                class="block text-sm font-black leading-tight text-gray-900"
              >
                Name in shared rooms
              </span>
              <span
                class="mt-0.5 block text-[11px] font-bold leading-tight text-gray-500"
              >
                Tap avatar to re-roll
              </span>
            </div>
          </div>

          <div class="w-32 shrink-0 sm:w-44">
            <input
              type="text"
              class="w-full rounded-lg border border-pink-200 bg-white px-2.5 py-1.5 font-mono text-base font-bold text-gray-800 transition-colors focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-200 sm:text-xs"
              value={avatarName}
              maxlength="48"
              on:change={saveAvatarName}
              aria-label="Name in shared rooms"
            />
          </div>
        </div>
      </section>
    </div>
  </div>

  <button
    type="button"
    class="modal-backdrop"
    aria-label="Close options modal"
    tabindex="-1"
    on:click={handleModalClose}
  ></button>
</dialog>

<style>
  .selected-vibe {
    box-shadow:
      0 0 0 2px rgba(249, 168, 212, 0.4),
      0 4px 8px rgba(249, 168, 212, 0.2);
  }

  .vibe-option {
    -webkit-tap-highlight-color: transparent;
  }

  .vibe-option:active {
    box-shadow: none !important;
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
    background: #f9a8d4;
    box-shadow: 0 0 0 0.22rem rgba(249, 168, 212, 0.18);
  }

  .auto-start-glyph.is-on span {
    transform: translateX(0.82rem);
  }

  .settings-section-title {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 900;
    line-height: 1;
    color: #be185d;
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
    .auto-start-glyph,
    .auto-start-glyph span,
    .avatar-face-btn.rerolling img {
      transition: none !important;
      transform: none !important;
      animation: none !important;
    }
  }
</style>
