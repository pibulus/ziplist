<script>
  /**
   * A reusable modal close button component that provides consistent styling and behavior
   * across all modals in the application.
   */
  export let position = 'right-2.5 top-2.5';
  export let size = 'md';
  export let label = 'Close';
  export let closeModal;
  export let modalId = null;

  // Size classes mapping
  const sizeClasses = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base'
  };
  
  // Get size classes based on the size prop
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  
  // Handle click. Prefer the provided closeModal (which routes through
  // modalService and plays the close-out animation). Only fall back to a
  // direct dialog.close() when no closeModal handler was supplied, so the
  // skeleton pop-out animation is never skipped.
  function handleClick() {
    if (typeof closeModal === 'function') {
      closeModal();
      return;
    }

    if (modalId) {
      const modal = document.getElementById(modalId);
      if (modal && typeof modal.close === 'function') {
        modal.close();
      }
    }
  }
</script>

<button
  type="button"
  class="modal-close-btn absolute {position} z-50 flex {sizeClass} items-center justify-center rounded-full bg-black/5 text-slate-600 hover:bg-black/10 hover:text-slate-900"
  aria-label={label}
  on:click|preventDefault={handleClick}
>
  <span class="relative leading-none flex items-center justify-center h-full w-full">✕</span>
</button>

<style>
  /* Family X: small, tucked into the corner, squishy on press.
     Fingers get a bigger target via the coarse-pointer bump below. */
  .modal-close-btn {
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    user-select: none;
    opacity: 0.6;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      opacity 0.15s ease,
      transform 0.22s linear(0, 0.5 15%, 1.15 40%, 0.97 65%, 1);
  }

  .modal-close-btn:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .modal-close-btn:active {
    transform: scale(0.86);
  }

  .modal-close-btn:focus-visible {
    outline: 2px solid var(--zl-accent-color, #ff6ac2);
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    .modal-close-btn {
      min-width: 40px;
      min-height: 40px;
    }
  }
</style>
