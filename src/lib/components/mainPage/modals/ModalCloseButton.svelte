<script>
  /**
   * A reusable modal close button component that provides consistent styling and behavior
   * across all modals in the application.
   */
  import { modalService } from "$lib/services/modals/modalService.js";

  export let label = "Close";
  export let text = "";
  export let closeModal;
  export let modalId = null;
  export let inline = false;
  export let position = "";
  export let size = "md";

  function handleClick() {
    if (typeof closeModal === "function") {
      closeModal();
      return;
    }

    if (modalId) {
      modalService.closeModal();
    }
  }
</script>

<button
  type="button"
  class="modal-close-btn absolute z-50 flex items-center justify-center rounded-full"
  class:is-text={Boolean(text)}
  class:is-inline={inline}
  data-size={size}
  data-position={position}
  aria-label={label}
  on:click|preventDefault={handleClick}
>
  <span
    class="relative flex h-full w-full items-center justify-center leading-none"
  >
    {#if text}
      {text}
    {:else}
      <!-- Drawn, not typed: a ✕ character sits wherever its font puts it, and
           on iOS that was visibly off-centre in the circle. -->
      <svg
        class="modal-close-glyph"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3.25"
        stroke-linecap="round"
        aria-hidden="true"><path d="M6.5 6.5l11 11m0-11l-11 11" /></svg
      >
    {/if}
  </span>
</button>

<style>
  /* Soft Neo Toybrut Close Button: signature vibrant squishy fluro pink with tactile dark border,
     rotates 90deg on hover, squishes on press. */
  /* Floating closes tuck into the panel's top-right corner: up and to the
     right, clear of the content. Action sheets and inline headers keep theirs
     inline (is-inline). */
  .modal-close-btn {
    top: var(--zl-close-inset, 0.625rem);
    right: var(--zl-close-inset, 0.625rem);
    width: 44px;
    height: 44px;
    font-size: 1.15rem;
    font-weight: 900;
    background: var(--zl-modal-close-bg, #ff5ca8);
    border: 2px solid #1e1714;
    color: var(--zl-modal-close-ink, #fffef7);
    box-shadow: 2px 2px 0 #1e1714;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    user-select: none;
    transition:
      box-shadow 0.15s ease,
      background-color 0.15s ease,
      color 0.15s ease,
      transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .modal-close-btn.is-text {
    width: auto;
    min-width: 44px;
    padding: 0 0.75rem;
    border-radius: 0.75rem;
    background: #fffdf5;
    color: #1e1714;
    box-shadow: none;
    font-size: 0.875rem;
  }

  .modal-close-btn.is-inline {
    position: static;
    flex-shrink: 0;
  }

  .modal-close-btn:hover {
    background: var(--zl-modal-close-hover-bg, #ff6eb3);
    box-shadow: 3px 3px 0 #1e1714;
    transform: scale(1.08) rotate(90deg);
  }

  .modal-close-btn.is-text:hover {
    background: #fafaf9;
    box-shadow: 1px 1px 0 #1e1714;
    transform: none;
  }

  .modal-close-btn:active {
    background: var(--zl-modal-close-bg, #ff5ca8);
    box-shadow: 1px 1px 0 #1e1714;
    transform: scale(0.9);
  }

  .modal-close-btn.is-text:active {
    transform: scale(0.96);
    box-shadow: none;
  }

  .modal-close-btn:focus,
  .modal-close-btn:focus-visible {
    outline: none;
  }

  .modal-close-glyph {
    display: block;
    width: 18px;
    height: 18px;
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-close-btn {
      transition: none;
    }
    .modal-close-btn:hover,
    .modal-close-btn:active {
      transform: none;
    }
  }
</style>
