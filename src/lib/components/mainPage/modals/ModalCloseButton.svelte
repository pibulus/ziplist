<script>
  /**
   * A reusable modal close button component that provides consistent styling and behavior
   * across all modals in the application.
   */
  export let position = 'right-4 top-4';
  export let size = 'md';
  export let label = 'Close';
  export let closeModal;
  export let modalId = null;
  
  // Size classes mapping
  const sizeClasses = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-11 w-11 text-lg'
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
  class="modal-close-btn absolute {position} z-50 flex {sizeClass} items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-slate-600 shadow-sm transition-all duration-200 ease-in-out hover:bg-amber-100 hover:text-slate-900"
  aria-label={label}
  on:click|preventDefault={handleClick}
>
  <span class="relative leading-none flex items-center justify-center h-full w-full">✕</span>
</button>

<style>
  /* Skeleton X button: 44px circular tap target, top-right 1rem inset
     (set via the `position` prop, default right-4 top-4), scale-hover,
     visible focus ring for keyboard users. */
  .modal-close-btn {
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    user-select: none;
    min-width: 44px;
    min-height: 44px;
  }

  .modal-close-btn:hover {
    transform: scale(1.05);
  }

  .modal-close-btn:active {
    transform: scale(0.95);
  }

  .modal-close-btn:focus-visible {
    outline: 3px solid var(--zl-accent-color, #ff6ac2);
    outline-offset: 2px;
  }
</style>
