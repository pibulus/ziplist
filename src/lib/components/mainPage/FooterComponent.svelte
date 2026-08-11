<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
  const footerButtonClass =
    "footer-nav-button btn btn-ghost btn-sm !h-[44px] !min-h-[44px] min-w-11 px-1.5 py-2 text-xs text-gray-600 shadow-none transition-colors duration-150 focus-visible:ring-0 sm:px-3 sm:text-base";

  function showAbout() {
    dispatch("showAbout");
  }

  function showSettings() {
    dispatch("showSettings");
  }

  /* Parked with their footer buttons — Extension and Share are hidden for now.
     The extension isn't ready to be advertised and the row reads calmer at two.
     Restoring means uncommenting this and the two <button>s below, plus the
     onDestroy + soundService imports these used.

  function showExtension() {
    dispatch("showExtension");
  }

  async function shareApp() { ... see git history for the full body ... }
  */
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
    on:click={showSettings}
    aria-label="Open Options"
  >
    Options
  </button>
  <!-- Extension and Share parked, same as TalkType — the extension isn't ready
       to be advertised and the row reads calmer at two. -->
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
