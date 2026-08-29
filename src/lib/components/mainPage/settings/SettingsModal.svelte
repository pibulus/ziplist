<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { theme, listFirstMode, applyTheme, isContributor } from "$lib";
  import { STORAGE_KEYS, THEMES } from "$lib/constants";
  import { StorageUtils } from "$lib/services/infrastructure/storageUtils";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import {
    getOrCreateAvatar,
    setAvatarName,
    getAvatarImage,
    rerollAvatar,
  } from "$lib/services/realtime/avatarService";
  import ThemeMascot from "./ThemeMascot.svelte";
  import * as liveListsService from "$lib/services/realtime/liveListsService";

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

  // ── List as text ───────────────────────────────────────────────────────
  // Appends into the ACTIVE list rather than making a new one: free tier caps
  // lists at three, and an import that can fail on a limit is a worse feature
  // than one that always works.



  // ── Device sync ────────────────────────────────────────────────────────
  let joinPhrase = "";
  let syncStatus = "";
  let syncBusy = false;



  async function handleJoinSync() {
    if (!joinPhrase.trim()) return;
    syncBusy = true;
    syncStatus = "";
    try {
      const result = await liveListsService.joinByPhrase(joinPhrase);
      if (result.success) {
        joinPhrase = "";
        // Every door in should lead to the same live view — the one place
        // with the "keep or leave" choice. Joining from Settings used to
        // drop the list silently into the carousel with no way to keep it.
        await goto(`/live/${result.roomId}`);
      } else {
        syncStatus =
          result.reason === "invalid"
            ? "That should be four words, like quiet-satchel-sighs-midair."
            : "No list waiting on those words. Check the spelling?";
      }
    } catch (error) {
      console.error("Sync join failed:", error);
      syncStatus = "That did not connect. Try again in a moment.";
    } finally {
      syncBusy = false;
    }
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
      <!-- No visible "Options" header — the footer link you just tapped
           already said it (Pablo's call 2026-08-07). The title survives for
           screen readers; the X floats in the corner and shares its line
           with the VIBE eyebrow. -->
      <h3 id="settings_modal_title" class="sr-only">Options</h3>
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
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </form>

      <!-- Vibe picker sits in the open (Pablo's call 2026-07-22): the old
           fold existed because the 2×2 grid ate ~40% of the modal, but as a
           single row of four tiles the whole thing costs one slim strip —
           themes are the app's outfit, they deserve to be seen. -->
      <section
        class="zl-settings-section zl-vibe-section"
        aria-labelledby="settings_vibe_title"
      >
        <h4 id="settings_vibe_title" class="sr-only">Vibe</h4>

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
                <ThemeMascot theme={vibe.id} size="26px" />
              </span>
              <span>{vibe.name}</span>
              {#if selectedVibe === vibe.id}
                <span class="zl-vibe-check" aria-hidden="true">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      </section>

      <!-- App Toggles: Chunky Mode & Straight to the list grouped in one container -->
      <section class="zl-settings-section" aria-label="Preferences">
        <div class="zl-setting-group">
          <div class="zl-setting-subrow">
            <div class="zl-setting-info">
              <span class="zl-setting-name">Chunky Mode</span>
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

          <div class="zl-setting-subrow">
            <div class="zl-setting-info">
              <span class="zl-setting-name">Straight to the list</span>
            </div>
            <label class="zl-toggle">
              <input
                type="checkbox"
                checked={listFirstModeValue}
                on:change={toggleListFirstMode}
                aria-label="Open straight to the list"
              />
              <span class="zl-toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Face wears the glyph seat on the right; title + hint on left, input + face on right -->
        <div class="zl-setting-row zl-avatar-row">
          <div class="zl-setting-info">
            <span class="zl-setting-name">Name in shared rooms</span>
            <p class="zl-setting-desc">Tap avatar to re-roll</p>
          </div>
          <div class="zl-avatar-field-inline">
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

      <!-- Receiving is the one inbound action with no list to hang off — you
           haven't got the list yet. Sending lives on the list itself. -->
      <section class="zl-settings-section" aria-label="Link a device">
        <div class="zl-setting-row zl-sync-row">
          <div class="zl-setting-info">
            <span class="zl-setting-name">Link a device</span>
            <p class="zl-setting-desc">Sync with 4-word passphrase from another device</p>
          </div>
          <div class="zl-sync-receive">
            <input
              class="zl-sync-input"
              bind:value={joinPhrase}
              placeholder="quiet-satchel-sighs-midair"
              aria-label="Four-word phrase from your other device"
              on:keydown={(e) => e.key === "Enter" && handleJoinSync()}
            />
            <button
              type="button"
              class="zl-sync-copy"
              disabled={syncBusy || !joinPhrase}
              on:click={handleJoinSync}
            >
              Go
            </button>
          </div>
        </div>
        {#if syncStatus}
          <p class="zl-sync-hint" role="status">{syncStatus}</p>
        {/if}
      </section>

      <section
        class="zl-settings-section zl-settings-footer"
        aria-label="Support ZipList"
      >
        <button
          type="button"
          class="zl-contributor-cta"
          title="More lists, and more of them live at once"
          on:click={openContributorModal}
        >
          <span aria-hidden="true">✦</span>
          <span>{contributorUnlocked ? "Unlocked ★ (12 lists)" : "Get more lists (12 max)"}</span>
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
    z-index: 1;
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
  }

  .zl-settings-content {
    max-height: calc(min(92dvh, 58rem) - 3rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.125rem;
    /* Clears the corner X — the tiles used to run straight under it.
       Sized against the MOBILE card (1rem padding): X bottom sits at
       0.5rem + 28px from the card edge, so content starts just below. */
    padding-top: 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* The modal chrome speaks the sans-black voice (TalkType's recipe —
     Pablo's call 2026-08-07: Space Mono everywhere read "squeezed/skinny"
     in a settings context). The mono survives only in the name input,
     where typed text matches the list items' typewriter identity. */

  /* Tiny pink dot of an X, tucked in the corner (Pablo's call 2026-08-17):
     the backdrop closes the modal too, so the X can be a cute accent instead
     of a 44px ghost circle squatting on the Legal Pad tile. Squishy on
     press, same family as the app's other round controls. */
  .zl-settings-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 3;
    background: #ff6ac2;
    border: none;
    cursor: pointer;
    color: #fffdf5;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 50%;
    box-shadow: 0 3px 8px rgba(255, 106, 194, 0.35);
    transition:
      transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.18s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .zl-settings-close:hover {
    transform: scale(1.12) rotate(90deg);
    box-shadow: 0 5px 12px rgba(255, 106, 194, 0.5);
  }

  .zl-settings-close:active {
    transform: scale(0.88);
  }

  .zl-settings-close:focus-visible,
  .zl-vibe-option:focus-visible {
    outline: 3px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.45);
    outline-offset: 3px;
  }

  .zl-sync-row {
    align-items: flex-start;
  }

  .zl-sync-copy {
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 800;
    padding: 0.42rem 0.8rem;
    border-radius: 999px;
    border: 2px solid rgba(30, 23, 20, 0.22);
    background: #fffdf5;
    color: #1e1714;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .zl-sync-copy:active {
    transform: scale(0.94);
  }

  .zl-sync-copy:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .zl-sync-receive {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
    flex: 1 1 55%;
  }


  .zl-sync-input {
    flex: 1;
    min-width: 0;
    font-family: "Space Mono", monospace;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 0.5rem 0.65rem;
    border-radius: 10px;
    border: 2px solid rgba(30, 23, 20, 0.16);
    background: rgba(30, 23, 20, 0.04);
    color: #1e1714;
    overflow-wrap: anywhere;
  }


  .zl-sync-hint {
    font-size: 0.72rem;
    opacity: 0.62;
    margin: 0 0 0.35rem;
  }

  /* ONE vertical rhythm: every row is 0.6rem from its neighbour, whether or
     not a <section> boundary sits between them. Sections used to add their
     own 1.1rem on top of the last row's 0.6rem, so the Chunky→Straight gap
     was almost 3× the Straight→avatar gap (Pablo clocked it 2026-08-17). */
  .zl-settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-bottom: 0;
  }

  .zl-settings-section:last-child {
    margin-bottom: 0;
  }

  /* Contributor sits apart from the everyday settings — a quiet divider
     instead of another shouting section label. */
  .zl-settings-footer {
    border-top: 2px dashed var(--zl-item-border-color, rgba(0, 0, 0, 0.12));
    padding-top: 0.85rem;
  }

  .zl-setting-group {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.5);
    border: var(--zl-item-border-width, 2px) solid
      var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 16px;
    margin-bottom: 0;
    overflow: hidden;
    transition: all 0.2s;
  }

  .zl-setting-group:hover {
    border-color: var(--zl-primary-color);
    background: #fffef7;
  }

  .zl-setting-subrow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    transition: all 0.15s ease;
  }

  .zl-setting-subrow + .zl-setting-subrow {
    border-top: 1.5px dashed var(--zl-item-border-color, rgba(30, 23, 20, 0.12));
  }

  .zl-setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: rgba(255, 255, 255, 0.5);
    border: var(--zl-item-border-width, 2px) solid
      var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 16px;
    margin-bottom: 0;
    transition: all 0.2s;
  }

  .zl-setting-row:hover {
    border-color: var(--zl-primary-color);
    background: #fffef7;
  }

  /* Info block always stretches — keeps it hugging a leading glyph (the
     avatar face) instead of floating to the row's center, and pushes the
     control to the right edge. */
  .zl-setting-info {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* ONE title scale for every row — "Chunky Mode", "List First", and
     "Name in shared rooms" used to arrive at three sizes via two container
     variants (Pablo clocked it 2026-08-07). */
  .zl-setting-name {
    font-size: 0.92rem;
    font-weight: 900;
    line-height: 1.25;
    letter-spacing: -0.01em;
    color: var(--zl-text-color-primary, #1e1714);
    display: block;
  }

  .zl-setting-desc {
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--zl-text-color-secondary, #666);
    margin: 0.2rem 0 0 0;
  }

  .zl-avatar-field-inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 0 1 auto;
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
    width: 7.5rem;
    min-width: 5.5rem;
    height: 38px;
    min-height: 38px;
    padding: 0.25rem 0.55rem;
    border: 2px solid var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 10px;
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
    background-color: #fffdf5;
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

  /* Chunky mode gets its hard-shadow identity back — gated, not leaked.
     Warm ink per the house law, never absolute black. The rows and tiles
     pick up their thicker borders automatically via --zl-item-border-width;
     these rules add the hard-shadow half of the look so flipping the toggle
     visibly chonks the very modal you're standing in. */
  :global(html.mode-neo-brutalist) .zl-setting-row,
  :global(html.mode-neo-brutalist) .zl-setting-group,
  :global(html.mode-neo-brutalist) .zl-vibe-option {
    border-radius: 10px;
    box-shadow: 3px 3px 0 0 var(--zl-chunky-ink, #1e1714);
  }

  :global(html.mode-neo-brutalist) .zl-vibe-option:hover {
    box-shadow: 4px 4px 0 0 var(--zl-chunky-ink, #1e1714);
  }

  :global(html.mode-neo-brutalist) .zl-toggle-slider {
    border-color: var(--zl-chunky-ink, #1e1714);
  }

  :global(html.mode-neo-brutalist) .zl-contributor-cta {
    border: 3px solid var(--zl-chunky-ink, #1e1714);
    border-radius: 14px;
    box-shadow: 5px 5px 0 var(--zl-chunky-ink, #1e1714);
  }

  :global(html.mode-neo-brutalist) .zl-contributor-cta:hover {
    transform: translate(-1px, -1px);
    box-shadow: 6px 6px 0 var(--zl-chunky-ink, #1e1714);
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
    padding: 0.38rem 0.15rem;
    min-height: 40px;
    background: #fffef7;
    border: var(--zl-item-border-width, 2px) solid
      var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 800;
    letter-spacing: -0.01em;
    /* fits "Highlighter" in a 4-up tile on a 390px phone */
    font-size: clamp(0.6rem, 2.5vw, 0.74rem);
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
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

  /* Selected = the check badge, full stop. The old mint-fill + amber-border
     + badge trio was three signals doing one job (Pablo's call 2026-08-07);
     the tile itself stays identical to its siblings so the four vibes read
     as one calm palette strip. */

  .zl-vibe-check {
    position: absolute;
    top: 4px;
    right: 4px;
    background: var(--zl-primary-color);
    color: #fffdf5;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: bold;
    border: 2px solid #fffdf5;
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

    /* Card padding is tighter here, so the eyebrow line needs the full
       44px to keep tiles clear of the X. */

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

    .zl-avatar-field-inline {
      width: 100%;
      margin-top: 0.4rem;
    }

    .zl-avatar-input {
      width: 100%;
      flex: 1;
      min-width: 0;
    }

  }

  /* The avatar row is the one row that needs to wrap; the rest stay inline. */
  .zl-settings-section .zl-setting-row:has(.zl-avatar-field-inline) {
    flex-wrap: wrap;
  }
</style>
