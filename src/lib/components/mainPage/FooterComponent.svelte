<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  function showAbout() {
    dispatch('showAbout');
  }
  
  function showSettings() {
    dispatch('showSettings');
  }
  
</script>

<div class="flex items-center space-x-1 sm:space-x-2">
  <button
    class="btn btn-sm btn-ghost min-h-[44px] min-w-[44px] text-gray-600 hover:text-pink-500 shadow-none hover:bg-pink-50/50 transition-all text-sm sm:text-base py-1 px-2 sm:px-3"
    on:click={showAbout}
    aria-label="About Ziplist"
  >
    About
  </button>
  <button
    class="btn btn-sm btn-ghost min-h-[44px] min-w-[44px] text-gray-600 hover:text-pink-500 shadow-none hover:bg-pink-50/50 transition-all text-sm sm:text-base py-1 px-2 sm:px-3"
    on:click={showSettings}
    aria-label="Open Settings"
  >
    Settings
  </button>

</div>
