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
</script>

<div class="flex items-center space-x-1 sm:space-x-2">
  <button
    type="button"
    class="btn btn-sm btn-ghost min-h-[44px] min-w-[44px] text-gray-600 hover:text-pink-500 shadow-none hover:bg-pink-50/50 transition-all text-sm sm:text-base py-1 px-2 sm:px-3"
    on:click={showAbout}
    aria-label="About Ziplist"
  >
    About
  </button>
  <button
    type="button"
    class="btn btn-sm btn-ghost min-h-[44px] min-w-[44px] text-gray-600 hover:text-pink-500 shadow-none hover:bg-pink-50/50 transition-all text-sm sm:text-base py-1 px-2 sm:px-3"
    on:click={showContributor}
    aria-label="Open Contributor unlock"
  >
    Contributor
  </button>
  <button
    type="button"
    class="btn btn-sm btn-ghost min-h-[44px] min-w-[44px] text-gray-600 hover:text-pink-500 shadow-none hover:bg-pink-50/50 transition-all text-sm sm:text-base py-1 px-2 sm:px-3"
    on:click={showSettings}
    aria-label="Open Settings"
  >
    Settings
  </button>
</div>
