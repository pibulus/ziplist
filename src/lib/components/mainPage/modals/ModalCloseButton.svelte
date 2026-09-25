<script>
  /**
   * A reusable modal close button component that provides consistent styling and behavior
   * across all modals in the application.
   */
  export let position = "right-2.5 top-2.5";
  export let size = "md";
  export let label = "Close";
  export let closeModal;
  export let modalId = null;

  // Size classes mapping
  const sizeClasses = {
    sm: "h-7 w-7 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base",
  };

  // Get size classes based on the size prop
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Handle click. Prefer the provided closeModal (which routes through
  // modalService and plays the close-out animation). Only fall back to a
  // direct dialog.close() when no closeModal handler was supplied, so the
  // skeleton pop-out animation is never skipped.
  function handleClick() {
    if (typeof closeModal === "function") {
      closeModal();
      return;
    }

    if (modalId) {
      const modal = document.getElementById(modalId);
      if (modal && typeof modal.close === "function") {
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
  <span
    class="relative flex h-full w-full items-center justify-center font-black leading-none"
    >✕</span
  >
</button>

<style>
  /* Soft Neo Toybrut Close Button: signature vibrant button with tactile black border,
     centered with modal header, squishy on press, rotates 90deg on hover (TalkType parity). */
  .modal-close-btn {
    top: 2px;
    right: 0;
    width: 28px;
    height: 28px;
    background: var(--zl-modal-close-bg, #ff5ca8);
    color: var(--zl-modal-close-ink, #ffffff);
    border: 2px solid #1e1714;
    box-shadow: 2px 2px 0px #1e1714;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    user-select: none;
    transition:
      box-shadow 0.15s ease,
      background 0.2s ease,
      color 0.2s ease,
      transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .modal-close-btn:hover {
    background: var(--zl-modal-close-hover-bg, #ff6eb3);
    box-shadow: 3px 3px 0px #1e1714;
    transform: scale(1.08) rotate(90deg);
  }

  .modal-close-btn:active {
    box-shadow: 1px 1px 0px #1e1714;
    transform: scale(0.92);
  }

  .modal-close-btn:focus-visible {
    outline: 2px solid #1e1714;
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    .modal-close-btn {
      width: 32px;
      height: 32px;
      top: 0;
    }
  }
</style>
