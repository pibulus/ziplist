<script>
  /**
   * Mascot — portable app-icon/mascot component.
   *
   * The shared SoftStack standard for app mascots (ZipList dude, TalkType
   * ghost, future apps). Sizing is matched across apps by *visible ink*, not
   * box dimensions: the defaults below render ~106px of art on mobile up to
   * ~174px on large desktop, matching the TalkType ghost so sister apps read
   * the same size side by side.
   *
   * Portable by design:
   *  - Drop the file into any SvelteKit app's component tree.
   *  - Pass `baseSrc` / `eyesSrc` (two-layer SVG: body + blinking eyes) OR a
   *    default slot for fully custom art.
   *  - Override any size with the `--mascot-size-*` CSS custom properties on a
   *    parent, no need to fork the breakpoint logic.
   *
   * @example
   *   <Mascot
   *     baseSrc="/assets/ziplist-icon-base.svg"
   *     eyesSrc="/assets/ziplist-icon-eyes.svg"
   *     ariaLabel="Start recording"
   *     on:click={handleClick}
   *   />
   */
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /** Body / base SVG layer. Optional if using the default slot. */
  export let baseSrc = "";
  /** Eyes SVG layer (blinks on a timer). Optional. */
  export let eyesSrc = "";
  /** Accessible label — also decides whether it renders as a button. */
  export let ariaLabel = "";
  /** Render as a tappable button (true) or a static decorative icon. */
  export let interactive = true;
  /** Float idle bob. */
  export let float = true;
  /** Idle "tappable" aura ring (only meaningful when interactive). */
  export let aura = true;

  function handleClick(event) {
    if (!interactive) return;
    dispatch("click", event);
  }
</script>

<svelte:element
  this={interactive ? "button" : "div"}
  type={interactive ? "button" : undefined}
  class="mascot"
  class:is-interactive={interactive}
  class:has-aura={aura && interactive}
  aria-label={interactive ? ariaLabel : undefined}
  aria-hidden={interactive ? undefined : "true"}
  on:click={handleClick}
>
  <div class="mascot-art" class:is-floating={float}>
    {#if $$slots.default}
      <slot />
    {:else}
      {#if baseSrc}
        <img src={baseSrc} alt="" class="mascot-base" />
      {/if}
      {#if eyesSrc}
        <img src={eyesSrc} alt="" class="mascot-eyes" />
      {/if}
    {/if}
  </div>
</svelte:element>

<style>
  /*
   * Sizing tokens — the SoftStack mascot scale, matched to TalkType ghost ink.
   * Override on a parent to resize without touching breakpoints, e.g.:
   *   :global(.my-app) { --mascot-size-mobile: 96px; }
   */
  .mascot {
    --mascot-size-mobile: 110px; /* ~105px visible ink — matches TalkType */
    --mascot-size-sm: 120px; /* >= 640px */
    --mascot-size-md: 140px; /* >= 768px */
    --mascot-size-lg: 160px; /* >= 1024px — matches TalkType ~174 ink */
    --mascot-gap: 0.625rem; /* bottom spacing under the mascot */
    --mascot-aura-color-1: rgba(255, 204, 51, 0.18);
    --mascot-aura-color-2: rgba(255, 106, 194, 0.12);
    --mascot-aura-color-3: rgba(113, 201, 206, 0.08);
    --mascot-hover-glow: rgba(255, 176, 0, 0.6);
    --mascot-focus-ring: #ff6ac2;

    position: relative;
    width: var(--mascot-size-mobile);
    height: var(--mascot-size-mobile);
    margin-bottom: var(--mascot-gap);
    z-index: 20;
  }

  .mascot.is-interactive {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    outline: none;
  }

  /* Idle pulse ring — hints it's tappable, after entrance settles. */
  .mascot.has-aura::after {
    content: "";
    position: absolute;
    inset: -10px;
    border-radius: 28px;
    background: radial-gradient(
      circle at 50% 54%,
      var(--mascot-aura-color-1) 0%,
      var(--mascot-aura-color-2) 42%,
      var(--mascot-aura-color-3) 58%,
      transparent 74%
    );
    filter: blur(1px);
    animation: mascot-aura 3.4s ease-in-out infinite;
    animation-delay: 2.2s;
    opacity: 0;
    pointer-events: none;
  }

  @keyframes mascot-aura {
    0% {
      opacity: 0;
      transform: scale(0.9);
    }
    36% {
      opacity: 0.72;
    }
    72% {
      opacity: 0.38;
    }
    100% {
      opacity: 0;
      transform: scale(1.06);
    }
  }

  .mascot.is-interactive:focus-visible {
    outline: 3px solid var(--mascot-focus-ring);
    outline-offset: 4px;
    border-radius: 28px;
  }

  .mascot-art {
    position: relative;
    width: 100%;
    height: 100%;
    transition: filter 0.3s ease;
  }

  .mascot-art.is-floating {
    animation: mascot-float 6s ease-in-out infinite;
  }

  .mascot.is-interactive:hover .mascot-art {
    filter: drop-shadow(0 0 15px var(--mascot-hover-glow));
  }

  .mascot-base {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    max-width: none;
    object-fit: contain;
  }

  .mascot-eyes {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform-origin: center 34%;
    animation: mascot-blink 4s infinite;
  }

  @keyframes mascot-float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-15px);
    }
  }

  @keyframes mascot-blink {
    0%,
    48%,
    52%,
    100% {
      transform: scaleY(1);
    }
    50% {
      transform: scaleY(0.1);
    }
  }

  /* Responsive scale — the matched SoftStack mascot breakpoints. */
  @media (min-width: 640px) {
    .mascot {
      width: var(--mascot-size-sm);
      height: var(--mascot-size-sm);
    }
  }

  @media (min-width: 768px) {
    .mascot {
      width: var(--mascot-size-md);
      height: var(--mascot-size-md);
      margin-bottom: 0;
    }
  }

  @media (min-width: 1024px) {
    .mascot {
      width: var(--mascot-size-lg);
      height: var(--mascot-size-lg);
    }
  }

  /* Respect reduced-motion: kill float / blink / aura. */
  @media (prefers-reduced-motion: reduce) {
    .mascot-art.is-floating,
    .mascot-eyes,
    .mascot.has-aura::after {
      animation: none;
    }
  }
</style>
