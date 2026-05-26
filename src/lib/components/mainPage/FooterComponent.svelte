<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

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
    const shareData = {
      title: "ZipList",
      text: "Make a checklist by talking. Quick, warm, and simple.",
      url: "https://ziplist.app",
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  }
</script>

<nav class="flex items-center space-x-1 sm:space-x-2" aria-label="ZipList footer">
  <button
    type="button"
    class="btn btn-ghost btn-sm !h-[44px] !min-h-[44px] min-w-11 px-1.5 py-2 text-xs text-gray-600 shadow-none transition-all hover:opacity-80 hover:bg-[color:var(--zl-highlight-color,#fff6e6)] focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 sm:px-3 sm:text-base"
    on:click={showAbout}
    aria-label="About Ziplist"
  >
    About
  </button>
  <button
    type="button"
    class="btn btn-ghost btn-sm !h-[44px] !min-h-[44px] min-w-11 px-1.5 py-2 text-xs text-gray-600 shadow-none transition-all hover:opacity-80 hover:bg-[color:var(--zl-highlight-color,#fff6e6)] focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 sm:px-3 sm:text-base"
    on:click={showContributor}
    aria-label="Open Contributor unlock"
  >
    <span class="hidden sm:inline">Contributor</span>
    <span class="sm:hidden">Unlock</span>
  </button>
  <button
    type="button"
    class="btn btn-ghost btn-sm !h-[44px] !min-h-[44px] min-w-11 px-1.5 py-2 text-xs text-gray-600 shadow-none transition-all hover:opacity-80 hover:bg-[color:var(--zl-highlight-color,#fff6e6)] focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 sm:px-3 sm:text-base"
    on:click={showSettings}
    aria-label="Open Options"
  >
    Options
  </button>
  <button
    type="button"
    class="btn btn-ghost btn-sm !h-[44px] !min-h-[44px] min-w-11 px-1.5 py-2 text-xs text-gray-600 shadow-none transition-all hover:opacity-80 hover:bg-[color:var(--zl-highlight-color,#fff6e6)] focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 sm:px-3 sm:text-base"
    on:click={showExtension}
    aria-label="Open Chrome Extension info"
  >
    <span class="hidden sm:inline">Extension</span>
    <span class="sm:hidden">Ext</span>
  </button>
  <button
    type="button"
    class="btn btn-ghost btn-sm !h-[44px] !min-h-[44px] min-w-11 px-1.5 py-2 text-xs text-gray-600 shadow-none transition-all hover:opacity-80 hover:bg-[color:var(--zl-highlight-color,#fff6e6)] focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 sm:px-3 sm:text-base"
    on:click={shareApp}
    aria-label="Share ZipList"
  >
    Share
  </button>
</nav>
