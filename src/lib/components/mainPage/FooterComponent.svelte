<script>
  import { createEventDispatcher, onDestroy } from "svelte";
  import { soundService } from "$lib/services/infrastructure/soundService";

  const dispatch = createEventDispatcher();
  const footerButtonClass =
    "footer-nav-button btn btn-ghost btn-sm !h-[44px] !min-h-[44px] min-w-11 px-1.5 py-2 text-xs text-gray-600 shadow-none transition-colors duration-150 focus-visible:ring-0 sm:px-3 sm:text-base";
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
    dispatch("showContributor");
  }

  function showExtension() {
    dispatch("showExtension");
  }

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
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        setShareStatus("ZipList link copied");
        soundService.copySuccess({ force: true });
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
  class="flex items-center space-x-1 sm:space-x-2"
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
    on:click={showContributor}
    aria-label="Open Contributor unlock"
  >
    <span class="hidden sm:inline">Contributor</span>
    <span class="sm:hidden">Unlock</span>
  </button>
  <button
    type="button"
    class={footerButtonClass}
    on:click={showSettings}
    aria-label="Open Options"
  >
    Options
  </button>
  <button
    type="button"
    class={footerButtonClass}
    on:click={showExtension}
    aria-label="Open Chrome Extension info"
  >
    <span class="hidden sm:inline">Extension</span>
    <span class="sm:hidden">Ext</span>
  </button>
  <button
    type="button"
    class={footerButtonClass}
    on:click={shareApp}
    aria-label="Share ZipList"
  >
    Share
  </button>
  <span class="sr-only" role="status" aria-live="polite">{shareStatus}</span>
</nav>

<style>
  .footer-nav-button {
    border-radius: 0.75rem;
  }

  .footer-nav-button:hover {
    background-color: rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.12);
    color: var(--zl-text-hover-color, var(--zl-accent-color, #ff6ac2));
  }

  .footer-nav-button:focus-visible {
    outline: 2px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.58);
    outline-offset: 2px;
    background-color: rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.14);
    color: var(--zl-text-hover-color, var(--zl-accent-color, #ff6ac2));
  }
</style>
