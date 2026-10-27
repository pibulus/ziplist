<script>
  import { createEventDispatcher, onDestroy } from "svelte";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import { isContributor } from "$lib";

  const dispatch = createEventDispatcher();
  /* Standardized 44px tap targets across all breakpoints (TalkType canon) */
  const footerButtonClass =
    "footer-nav-button inline-flex items-center justify-center h-[44px] min-h-[44px] min-w-11 px-2 py-2 text-xs font-semibold text-gray-600 transition-colors duration-150 hover:text-gray-900 focus:outline-none sm:px-3 sm:text-base";
  let shareStatus = "";
  let shareStatusTimer = null;

  onDestroy(() => {
    if (shareStatusTimer) clearTimeout(shareStatusTimer);
  });

  function setShareStatus(message) {
    if (shareStatusTimer) clearTimeout(shareStatusTimer);
    shareStatus = message;
    shareStatusTimer = setTimeout(() => {
      shareStatus = "";
      shareStatusTimer = null;
    }, 2500);
  }

  function showAbout() {
    dispatch("showAbout");
  }

  function showSettings() {
    dispatch("showSettings");
  }

  function showContributor() {
    soundService.select();
    dispatch("showContributor");
  }

  /* Extension is parked — not ready to be advertised yet. Restoring means
     uncommenting this and its <button> below.
  function showExtension() {
    dispatch("showExtension");
  }
  */

  async function shareApp() {
    soundService.select();

    const url =
      typeof window !== "undefined"
        ? window.location.href
        : "https://ziplist.app";
    const shareData = {
      title: "ZipList",
      text: "Make a checklist by talking. Quick, warm, and simple.",
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("Shared ZipList");
        soundService.copySuccess({ force: true });
        window.dispatchEvent(
          new CustomEvent("ziplist:toast", {
            detail: { message: "Shared ZipList! ⚡", type: "success" },
          }),
        );
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        setShareStatus("ZipList link copied");
        soundService.copySuccess({ force: true });
        window.dispatchEvent(
          new CustomEvent("ziplist:toast", {
            detail: {
              message: "Link copied! Share ZipList with a friend ✨",
              type: "success",
            },
          }),
        );
      } else {
        setShareStatus("Share unavailable");
        soundService.locked({ force: true });
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      setShareStatus("Share needs one more try");
      soundService.error({ force: true });
      console.error("Error sharing:", err);
    }
  }
</script>

<nav
  class="zl-footer-nav flex max-w-full items-center justify-center space-x-1 sm:space-x-2"
  aria-label="ZipList footer"
>
  <button
    type="button"
    class={footerButtonClass}
    on:click={showAbout}
    aria-label="About Ziplist"
  >
    About
  </button>
  <button
    type="button"
    class={footerButtonClass}
    on:click={showSettings}
    aria-label="Open Options"
  >
    Options
  </button>
  <!-- Extension button parked with its handler above. -->
  <button
    type="button"
    class={footerButtonClass}
    on:click={shareApp}
    aria-label="Share ZipList"
  >
    Share
  </button>
  {#if $isContributor}
    <button
      type="button"
      class="{footerButtonClass} zl-footer-pass is-unlocked"
      on:click={showContributor}
      title="View ZipList Passport"
      aria-label="View ZipList Passport"
    >
      Passport
    </button>
  {:else}
    <button
      type="button"
      class="{footerButtonClass} zl-footer-pass"
      on:click={showContributor}
      title="ZipList Passport · 12 lists, live rooms, every device"
      aria-label="Unlock ZipList Passport"
    >
      Passport
    </button>
  {/if}
  <span class="sr-only" role="status" aria-live="polite">{shareStatus}</span>
</nav>

<style>
  .zl-footer-nav {
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
  }

  .zl-footer-nav::-webkit-scrollbar {
    display: none;
  }

  .footer-nav-button {
    flex: 0 0 auto;
    border-radius: 0.75rem;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .footer-nav-button:hover {
    background-color: var(--footer-button-hover-bg, rgba(30, 23, 20, 0.05));
    color: var(--footer-button-hover-color, #1e1714);
  }

  .footer-nav-button:focus-visible {
    outline: 2px solid var(--footer-focus-ring, rgba(30, 23, 20, 0.3));
    outline-offset: 2px;
    background-color: var(--footer-button-hover-bg, rgba(30, 23, 20, 0.05));
    color: var(--footer-button-hover-color, #1e1714);
  }

  /* Vibe-reactive Extras action pill: adapts to chosen vibe (matches TalkType Caboodle pill) */
  .zl-footer-pass {
    color: var(--zl-footer-pass-ink, #1e1714);
    background: var(--zl-footer-pass-bg, var(--zl-pass-color, #ff6ac2));
    border: 1.5px solid #1e1714;
    border-radius: 999px;
    box-shadow: 0 2px 8px
      var(
        --zl-footer-pass-glow,
        rgba(var(--zl-pass-color-rgb, 255, 106, 194), 0.35)
      );
    font-weight: 800;
    padding-left: 0.85rem;
    padding-right: 0.85rem;
    transition:
      background 0.25s ease,
      color 0.25s ease,
      box-shadow 0.25s ease,
      transform 0.15s ease;
  }

  .zl-footer-pass:hover,
  .zl-footer-pass:focus-visible {
    color: var(--zl-footer-pass-ink, #1e1714);
    background: var(--zl-footer-pass-hover-bg, var(--zl-pass-color, #ff7ecd));
    box-shadow: 0 4px 12px
      var(
        --zl-footer-pass-glow-hover,
        rgba(var(--zl-pass-color-rgb, 255, 106, 194), 0.55)
      );
  }

  .zl-footer-pass:active {
    transform: scale(0.96);
  }
</style>
