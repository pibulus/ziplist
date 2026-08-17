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
  class="modal-close-btn absolute {position} z-50 flex {sizeClass} items-center justify-center rounded-full"
  aria-label={label}
  on:click|preventDefault={handleClick}
>
  <span class="relative leading-none flex items-center justify-center h-full w-full">✕</span>
</button>

<style>
  /* Family X: a small pink dot tucked into the corner, squishy on press
     (Pablo's call 2026-08-17 — it used to be a grey ghost circle in slate,
     a colour from nobody's palette). The backdrop closes these too, so the
     X gets to be a cute accent rather than furniture. Settings and
     Contributor wear the identical dot, so all five modals close the same
     way. Fingers get a bigger target via the coarse-pointer bump below. */
  .modal-close-btn {
    /* Same tuck as TalkType's X so the two apps close the same way. */
    top: 0.35rem;
    right: 0.35rem;
    background: #ff6ac2;
    color: #fffdf5;
    border: none;
    box-shadow: 0 3px 8px rgba(255, 106, 194, 0.35);
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    user-select: none;
    transition:
      box-shadow 0.15s ease,
      transform 0.22s linear(0, 0.5 15%, 1.15 40%, 0.97 65%, 1);
  }

  .modal-close-btn:hover {
    box-shadow: 0 5px 12px rgba(255, 106, 194, 0.5);
    transform: scale(1.1) rotate(90deg);
  }

  .modal-close-btn:active {
    transform: scale(0.82);
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
