<script>
  import "./ghost-animations.css";
  import "./ghost-themes.css";
  import ghostPathsUrl from "./ghost-paths.svg?url";
  import {
    initGradientAnimation,
    cleanupAnimation,
    cleanupAllAnimations,
  } from "./gradientAnimator";
  import { onMount, onDestroy } from "svelte";

  // Direct theme prop - no store subscription
  export let theme = "focus";
  export let size = "40px";
  export let seed = Math.floor(Math.random() * 10000);

  // DOM references
  let ghostSvg;
  let leftEye;
  let rightEye;
  let eyesClosed = false;

  // Simple blink animation with random timing based on seed
  let blinkTimeoutId;
  let blinkCounter = 0;

  // Seeded random function
  function seedRandom(min, max) {
    const x = Math.sin(seed + blinkCounter++) * 10000;
    const random = x - Math.floor(x);
    return min + random * (max - min);
  }

  // Simplified blink scheduler
  function scheduleBlink() {
    clearTimeout(blinkTimeoutId);

    // Random delay with seed for unique timing per ghost
    const delay = 4000 + seedRandom(0, 1) * 5000;

    blinkTimeoutId = setTimeout(() => {
      // Single blink animation
      eyesClosed = true;
      updateEyes();

      // Open eyes after short delay
      setTimeout(() => {
        eyesClosed = false;
        updateEyes();

        // Schedule next blink
        scheduleBlink();
      }, 300);
    }, delay);
  }

  // Apply eye state
  function updateEyes() {
    if (!leftEye || !rightEye) return;

    if (eyesClosed) {
      leftEye.style.transform = `scaleY(0.05)`;
      rightEye.style.transform = `scaleY(0.05)`;
    } else {
      leftEye.style.transform = `translate(0, 0)`;
      rightEye.style.transform = `translate(0, 0)`;
    }
  }

  // Force reflow helper
  function forceReflow(element) {
    if (!element) return;
    void element.offsetWidth;
  }

  // Lifecycle
  onMount(() => {
    // Initialize gradient animation for current theme
    if (ghostSvg) {
      const svgElement = ghostSvg.querySelector("svg");
      if (svgElement) {
        initGradientAnimation(theme, svgElement);
      }
    }

    // Start blinking
    scheduleBlink();
  });

  onDestroy(() => {
    clearTimeout(blinkTimeoutId);
    cleanupAllAnimations();
  });
</script>

<div class="display-ghost" style="width:{size}; height:{size};">
  <div bind:this={ghostSvg} class="ghost-container theme-{theme}">
    <svg
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      class="ghost-svg theme-{theme}"
    >
      <defs>
        <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--ghost-focus-start)" />
          <stop offset="35%" stop-color="var(--ghost-focus-mid1)" />
          <stop offset="65%" stop-color="var(--ghost-focus-mid2)" />
          <stop offset="85%" stop-color="var(--ghost-focus-mid3)" />
          <stop offset="100%" stop-color="var(--ghost-focus-end)" />
        </linearGradient>

        <linearGradient id="chillGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--ghost-chill-start)" />
          <stop offset="35%" stop-color="var(--ghost-chill-mid1)" />
          <stop offset="65%" stop-color="var(--ghost-chill-mid2)" />
          <stop offset="85%" stop-color="var(--ghost-chill-mid3)" />
          <stop offset="100%" stop-color="var(--ghost-chill-end)" />
        </linearGradient>

        <linearGradient id="zenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--ghost-zen-start)" />
          <stop offset="35%" stop-color="var(--ghost-zen-mid1)" />
          <stop offset="65%" stop-color="var(--ghost-zen-mid2)" />
          <stop offset="85%" stop-color="var(--ghost-zen-mid3)" />
          <stop offset="100%" stop-color="var(--ghost-zen-end)" />
        </linearGradient>

        <linearGradient
          id="nocturneGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stop-color="var(--ghost-nocturne-start)" />
          <stop offset="25%" stop-color="var(--ghost-nocturne-mid1)" />
          <stop offset="50%" stop-color="var(--ghost-nocturne-mid2)" />
          <stop offset="75%" stop-color="var(--ghost-nocturne-mid3)" />
          <stop offset="100%" stop-color="var(--ghost-nocturne-end)" />
        </linearGradient>
      </defs>

      <g class="ghost-layer ghost-bg">
        <use
          xlink:href={ghostPathsUrl}
          href={ghostPathsUrl + "#ghost-background"}
          class="ghost-shape"
          id="ghost-shape"
          fill="url(#{theme}Gradient)"
        />
      </g>

      <g class="ghost-layer ghost-outline">
        <use
          xlink:href={ghostPathsUrl}
          href={ghostPathsUrl + "#ghost-body-path"}
          class="ghost-outline-path"
          fill="#000000"
          opacity="1"
        />
      </g>

      <g class="ghost-layer ghost-eyes">
        <use
          bind:this={leftEye}
          xlink:href={ghostPathsUrl}
          href={ghostPathsUrl + "#ghost-eye-left-path"}
          class="ghost-eye ghost-eye-left"
          fill="#000000"
        />
        <use
          bind:this={rightEye}
          xlink:href={ghostPathsUrl}
          href={ghostPathsUrl + "#ghost-eye-right-path"}
          class="ghost-eye ghost-eye-right"
          fill="#000000"
        />
      </g>
    </svg>
  </div>
</div>

<style>
  .display-ghost {
    position: relative;
    overflow: hidden;
  }

  .ghost-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .ghost-svg {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
  }

  .ghost-layer {
    transform-origin: center center;
  }

  /* Override default theme glows for DisplayGhost to be more subtle */
  :global(.display-ghost .ghost-container.theme-focus) {
    filter: drop-shadow(0 0 2px rgba(255, 120, 160, 0.15))
      drop-shadow(0 0 4px rgba(255, 150, 120, 0.1));
  }

  :global(.display-ghost .ghost-container.theme-chill) {
    filter: drop-shadow(0 0 2px rgba(80, 235, 170, 0.15))
      drop-shadow(0 0 4px rgba(60, 220, 240, 0.1));
  }

  :global(.display-ghost .ghost-container.theme-zen) {
    filter: drop-shadow(0 0 2px rgba(200, 140, 255, 0.15))
      drop-shadow(0 0 4px rgba(255, 110, 180, 0.1));
  }

  :global(.display-ghost .ghost-container.theme-nocturne) {
    filter: drop-shadow(0 0 2px rgba(255, 170, 190, 0.15))
      drop-shadow(0 0 4px rgba(210, 180, 255, 0.1))
      drop-shadow(0 0 1px rgba(255, 255, 255, 0.2));
  }
</style>
