<script>
  /**
   * Mascot — portable app-icon/mascot component (ZipList lite shell).
   *
   * The shared SoftStack standard for app mascots (ZipList dude, TalkType
   * ghost, future apps). Sizing is matched across apps by *visible ink*, not
   * box dimensions: the defaults below render ~106px of art on mobile up to
   * ~174px on large desktop, matching the TalkType ghost so sister apps read
   * the same size side by side.
   *
   * THEME-RECOLOR (bug fix): the hero silhouette is now an INLINE SVG whose
   * body fills with `url(#<themeGradient>)`, where the gradient stops are CSS
   * variables (`--zl-mascot-gradient-start/-mid/-end`) defined per-theme in
   * theme-variables.css. So the dude RECOLORS with the active vibe instead of
   * the old baked-in <img> that was frozen on the neo gradient. Each instance
   * gets a unique gradient id so multiple mascots on a page don't collide.
   *
   * Portable by design:
   *  - Default render = the themed inline SVG (ZipList dude geometry).
   *  - Or pass a default slot for fully custom art.
   *  - `baseSrc` / `eyesSrc` are kept for backward-compat (renders the legacy
   *    two-layer <img> pair) but do NOT theme-recolor — prefer the inline path.
   *  - Override any size with the `--mascot-size-*` CSS custom properties on a
   *    parent, no need to fork the breakpoint logic.
   *
   * @example
   *   <Mascot ariaLabel="Start recording" on:click={handleClick} />
   */
  import { createEventDispatcher, onDestroy } from "svelte";

  const dispatch = createEventDispatcher();

  onDestroy(() => {
    if (tapTimer) clearTimeout(tapTimer);
  });

  /** Legacy body / base SVG layer. Optional — does NOT theme-recolor. */
  export let baseSrc = "";
  /** Legacy eyes SVG layer (blinks on a timer). Optional. */
  export let eyesSrc = "";
  /** Accessible label — also decides whether it renders as a button. */
  export let ariaLabel = "";
  /** Render as a tappable button (true) or a static decorative icon. */
  export let interactive = true;
  /** Float idle bob. */
  export let float = true;
  /** Idle "tappable" aura ring (only meaningful when interactive). */
  export let aura = true;
  /** Listening/recording look — stronger, faster aura + a warm glow. */
  export let active = false;

  // Tap squish — the dude acknowledges every poke with a squash-and-stretch
  // before whatever the click actually does (usually: start recording).
  let tapped = false;
  let tapTimer = null;

  // Unique gradient id per instance so hero + modal mascots don't share a fill.
  const gid = `zlMascotGradient-${Math.random().toString(36).slice(2, 8)}`;

  // Legacy <img> path only when an explicit baseSrc is passed AND no slot.
  $: useLegacyImg = !!baseSrc;

  function handleClick(event) {
    if (!interactive) return;
    // Restartable squish: drop the class for a frame so rapid taps re-fire.
    tapped = false;
    requestAnimationFrame(() => {
      tapped = true;
    });
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      tapped = false;
      tapTimer = null;
    }, 420);
    dispatch("click", event);
  }
</script>

<svelte:element
  this={interactive ? "button" : "div"}
  type={interactive ? "button" : undefined}
  class="mascot"
  class:is-interactive={interactive}
  class:has-aura={aura && interactive}
  class:is-active={active}
  aria-label={interactive ? ariaLabel : undefined}
  aria-hidden={interactive ? undefined : "true"}
  on:click={handleClick}
>
  <div class="mascot-art" class:is-floating={float} class:tapped>
    {#if $$slots.default}
      <slot />
    {:else if useLegacyImg}
      <!-- Legacy two-layer <img> pair (does not theme-recolor). -->
      <img src={baseSrc} alt="" class="mascot-base" />
      {#if eyesSrc}
        <img src={eyesSrc} alt="" class="mascot-eyes" />
      {/if}
    {:else}
      <!-- Themed inline silhouette — body fills with the per-theme gradient so
           it recolors with the active vibe. Eyes ride in their own <g> so the
           blink scaleY animation applies. Geometry = canonical ZipList dude. -->
      <svg
        class="mascot-svg"
        viewBox="96 56 832 872"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={gid}
            x1="150"
            y1="130"
            x2="860"
            y2="820"
            gradientUnits="userSpaceOnUse"
          >
            <stop
              offset="0"
              stop-color="var(--zl-mascot-gradient-start, #ffe86b)"
            />
            <stop
              offset="0.42"
              stop-color="var(--zl-mascot-gradient-mid, #ff9a8c)"
            />
            <stop
              offset="1"
              stop-color="var(--zl-mascot-gradient-end, #76ead7)"
            />
          </linearGradient>
        </defs>

        <!-- Speech-bubble body, gradient-filled (the part that recolors). -->
        <path
          d="M308 118H716C815 118 878 181 878 280V574C878 673 815 736 716 736H600L542 846C529 870 495 870 482 846L424 736H308C209 736 146 673 146 574V280C146 181 209 118 308 118Z"
          fill="url(#{gid})"
          stroke="#000000"
          stroke-width="54"
          stroke-linejoin="round"
        />

        <!-- List rows. -->
        <g
          fill="none"
          stroke="#000000"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="334" y="520" width="44" height="44" rx="6" stroke-width="18" />
          <path d="M430 542H690" stroke-width="21" />
          <rect x="334" y="598" width="44" height="44" rx="6" stroke-width="18" />
          <path d="M430 620H690" stroke-width="21" />
        </g>

        <!-- Eyes (blink). -->
        <g class="mascot-eyes-group">
          <ellipse cx="424" cy="326" rx="39" ry="60" fill="#000000" />
          <ellipse cx="600" cy="326" rx="39" ry="60" fill="#000000" />
        </g>
      </svg>
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
    /* HERO-SPEC.md slot — the family mascot SLOT is fixed at 176/192/224/256
       (= talktype's ghost wrapper) so titles land at identical y across apps.
       Ink parity is tuned separately: the dude's svg is near-full-bleed (~90%
       ink) vs the ghost's ~68%, so .mascot-art pads 12% to read ghost-sized.
       Measured live 2026-07-21: ghost ink 174px @lg, dude ink 174px with this. */
    --mascot-size-mobile: 176px;
    --mascot-size-sm: 192px; /* >= 640px */
    --mascot-size-md: 224px; /* >= 768px */
    --mascot-size-lg: 256px; /* >= 1024px */
    --mascot-gap: 1rem; /* bottom spacing under the mascot (0 at md+) */
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
    /* Ink-parity padding — see slot comment above. Modal-sized instances
       (Intro/About) zero this out; they were tuned full-bleed. */
    padding: var(--mascot-ink-pad, 12%);
    box-sizing: border-box;
  }

  .mascot-art.is-floating {
    animation: mascot-float 6s ease-in-out infinite;
  }

  /* Tap acknowledgment — squash, overshoot, settle. Rides ON TOP of the
     float via a wrapper-level scale so the two don't fight. */
  .mascot-art.tapped {
    animation:
      mascot-tap-squish 0.42s cubic-bezier(0.34, 1.56, 0.64, 1),
      mascot-float 6s ease-in-out infinite;
  }

  @keyframes mascot-tap-squish {
    0% {
      scale: 1 1;
    }
    30% {
      scale: 1.08 0.86;
    }
    62% {
      scale: 0.94 1.08;
    }
    100% {
      scale: 1 1;
    }
  }

  /* Listening look — the aura stops teasing and commits: continuous,
     quicker, brighter, plus a warm glow on the art itself. */
  .mascot.is-active .mascot-art {
    filter: drop-shadow(0 0 16px var(--mascot-hover-glow));
  }

  .mascot.is-active.has-aura::after {
    animation: mascot-aura 1.5s ease-in-out infinite;
    animation-delay: 0s;
  }

  .mascot.is-interactive:hover .mascot-art {
    filter: drop-shadow(0 0 15px var(--mascot-hover-glow));
  }

  /* Inline themed SVG — fills the box, overflow visible for the stroke. */
  .mascot-svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  /* Eyes blink — same timing as the legacy two-layer version. */
  .mascot-eyes-group {
    transform-origin: center 34%;
    animation: mascot-blink 4s infinite;
  }

  /* Legacy <img> layers (only when baseSrc/eyesSrc passed). */
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

  /* Respect reduced-motion: kill float / blink / aura / squish. */
  @media (prefers-reduced-motion: reduce) {
    .mascot-art.is-floating,
    .mascot-art.tapped,
    .mascot-eyes,
    .mascot-eyes-group,
    .mascot.has-aura::after {
      animation: none;
    }
  }
</style>
