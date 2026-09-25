<script>
  import { onMount, onDestroy } from "svelte";
  import { fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { ANIMATION } from "$lib/constants";

  const ICONS = {
    info: "M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z",
    success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    warning:
      "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    error:
      "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  // Warm pastel families to match the app's peach/cream/fluro language —
  // with accessible icon contrast (> 3:1 WCAG AA).
  const TYPE_COLORS = {
    info: {
      bg: "bg-amber-50",
      border: "border-amber-300",
      text: "text-amber-950",
      icon: "text-amber-700",
    },
    success: {
      bg: "bg-emerald-50",
      border: "border-emerald-300",
      text: "text-emerald-950",
      icon: "text-emerald-700",
    },
    warning: {
      bg: "bg-amber-100",
      border: "border-amber-400",
      text: "text-amber-950",
      icon: "text-amber-800",
    },
    error: {
      bg: "bg-rose-50",
      border: "border-rose-300",
      text: "text-rose-950",
      icon: "text-rose-700",
    },
  };

  const MAX_VISIBLE_TOASTS = 3;
  const timers = new Map();

  let toasts = [];
  let toastId = 0;
  let toastContainer = null;
  let lastToastMessage = "";
  let lastToastTime = 0;

  export function removeToast(id) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    toasts = toasts.filter((t) => t.id !== id);
  }

  function addToast(detail) {
    const message = detail?.message?.trim() || "";
    if (!message) return null;

    // Deduplicate identical toasts dispatched within 1200ms
    const now = Date.now();
    if (message === lastToastMessage && now - lastToastTime < 1200) {
      return null;
    }
    lastToastMessage = message;
    lastToastTime = now;

    const id = ++toastId;
    const type = TYPE_COLORS[detail?.type] ? detail.type : "info";
    const duration =
      type === "error"
        ? ANIMATION.TOAST.ERROR_DURATION
        : ANIMATION.TOAST.DISPLAY_DURATION;

    // Prune oldest if at max capacity
    if (toasts.length >= MAX_VISIBLE_TOASTS) {
      removeToast(toasts[0].id);
    }

    toasts = [...toasts, { id, message, type }];

    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    timers.set(id, timer);

    // Promote to Top Layer via Popover API if supported
    if (toastContainer && typeof toastContainer.showPopover === "function") {
      try {
        toastContainer.showPopover();
      } catch {
        // Popover already showing or unsupported
      }
    }

    return id;
  }

  function handleToast(event) {
    if (event?.detail) {
      addToast(event.detail);
    }
  }

  onMount(() => {
    window.addEventListener("ziplist:toast", handleToast);
    window.addEventListener("talktype:toast", handleToast);
    if (toastContainer && typeof toastContainer.showPopover === "function") {
      try {
        toastContainer.showPopover();
      } catch {
        // Ignore
      }
    }
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("ziplist:toast", handleToast);
      window.removeEventListener("talktype:toast", handleToast);
    }
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  });
</script>

<!-- The toast container stays continuously in the DOM so assistive tech (VoiceOver/NVDA)
     can reliably announce live-region insertions. Using popover="manual" promotes it
     into the browser's native Top Layer so toasts are never trapped behind <dialog> modals. -->
<div
  bind:this={toastContainer}
  popover="manual"
  class="toast-container"
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {#each toasts as toast (toast.id)}
    <button
      type="button"
      class="toast-item {TYPE_COLORS[toast.type].bg} {TYPE_COLORS[toast.type]
        .border} {TYPE_COLORS[toast.type].text}"
      transition:fly={{ y: -20, duration: 240, easing: quintOut }}
      on:click={() => removeToast(toast.id)}
      aria-label="{toast.message}. Tap to dismiss."
    >
      <svg
        class="toast-icon {TYPE_COLORS[toast.type].icon}"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d={ICONS[toast.type] || ICONS.info} />
      </svg>
      <span class="toast-message">{toast.message}</span>
    </button>
  {/each}
</div>

<style>
  .toast-container {
    /* Popover UA override */
    border: none;
    background: transparent;
    padding: 0;
    margin: 0;
    inset: auto;
    /* Fixed top anchoring clears footer nav, record CTA, action buttons, and mobile keyboard */
    position: fixed;
    top: calc(1.25rem + env(safe-area-inset-top, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    pointer-events: none;
    width: 100%;
    max-width: 28rem;
    padding: 0 1rem;
  }

  .toast-item {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.1rem;
    border-radius: 1rem;
    border: 2px solid;
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: 0;
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12);
    max-width: 100%;
    cursor: pointer;
    text-align: left;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }

  .toast-item:hover {
    transform: translateY(1px);
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.1);
  }

  .toast-item:active {
    transform: scale(0.97);
  }

  .toast-icon {
    width: 1.125rem;
    height: 1.125rem;
    flex-shrink: 0;
  }

  .toast-message {
    line-height: 1.3;
  }

  @media (prefers-reduced-motion: reduce) {
    .toast-item {
      transition: none !important;
    }
  }
</style>
