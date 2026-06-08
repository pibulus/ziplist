<script>
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  import { AppSuffix } from "$lib/components/ui";
  import { hapticService } from "$lib/services/infrastructure/hapticService";

  const dispatch = createEventDispatcher();

  // Component props
  export let title = "ZipList";
  export let subtitle = "Make a list by talking.\nAdd more, tick things off.";

  // AppSuffix configuration
  export let showAppSuffix = true;

  $: titleCharacters = Array.from(title);

  function handleDudeClick() {
    hapticService.impact("medium");
    dispatch("toggleRecording");
  }

  onMount(() => {
    // Set up animation sequence timing (for title/subtitle)
    const titleTimer = setTimeout(() => {
      dispatch("titleAnimationComplete");
    }, 1200); // After staggered animation

    const subtitleTimer = setTimeout(() => {
      dispatch("subtitleAnimationComplete");
    }, 2000); // After subtitle slide-in

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(subtitleTimer);
    };
  });

  function getLetterDelay(index) {
    return `${0.05 + index * 0.05}s`;
  }
</script>

<!-- Typography with improved kerning and weight using font-variation-settings -->
<div class="relative title-container">
  <!-- The Floating Dude -->
  <button
    type="button"
    class="floating-dude"
    on:click={handleDudeClick}
    aria-label="Start recording"
  >
    <div class="dude-wrapper">
      <img src="/assets/ziplist-icon-base.svg" alt="" class="dude-base" />
      <img src="/assets/ziplist-icon-eyes.svg" alt="" class="dude-eyes" />
    </div>
  </button>

  <h1
    class="mb-1 text-5xl font-black tracking-normal text-center cursor-default select-none staggered-text sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl"
    style="font-weight: 900; letter-spacing: 0; font-feature-settings: 'kern' 1; font-kerning: normal; font-variation-settings: 'wght' 900, 'opsz' 32;"
    aria-label={title}
  >
    <!-- Use aria-hidden for spans if H1 has aria-label -->
    <span class="ziplist-main-word">
      {#each titleCharacters as character, index}
        <span
          class="stagger-letter"
          style={`--letter-delay:${getLetterDelay(index)}`}
          aria-hidden="true">{character}</span
        >
      {/each}
    </span>

    {#if showAppSuffix}
      <span
        class="app-suffix-container stagger-letter"
        style={`--letter-delay:${getLetterDelay(titleCharacters.length)}; position: relative;`}
      >
        <span class="suffix-wrapper">
          <AppSuffix
            color="#FFB000"
            size="35%"
            offsetX="-0.6em"
            offsetY="8px"
            position="bottom-right"
            customClass="title-suffix"
          />
        </span>
      </span>
    {/if}
  </h1>
</div>

<!-- Updated subheadline with improved typography and reduced bottom margin -->
<p
  class="mx-auto mt-4 mb-3 text-base text-center cursor-default select-none slide-in-subtitle max-w-prose text-gray-700/85 sm:mt-5 sm:mb-4 sm:text-lg md:text-xl lg:text-2xl"
  style="font-weight: 400; letter-spacing: 0; line-height: 1.4; max-inline-size: 40ch; text-wrap: balance; font-variation-settings: 'wght' 400, 'opsz' 16;"
>
  {#each subtitle.split("\n") as line, i}
    {#if i > 0}<br />{/if}{line}
  {/each}
</p>

<style>
  /* Floating Dude Styles */
  .floating-dude {
    position: absolute;
    top: -172px;
    left: 50%;
    transform: translateX(-50%);
    width: 156px;
    height: 156px;
    background: none;
    border: none;
    cursor: pointer;
    z-index: 20;
    padding: 0;
    outline: none;
  }

  /* Idle pulse ring — appears after entrance animation, hints it's tappable */
  .floating-dude::after {
    content: "";
    position: absolute;
    inset: -16px;
    border-radius: 36px;
    background: radial-gradient(
      circle at 50% 54%,
      rgba(255, 204, 51, 0.18) 0%,
      rgba(255, 106, 194, 0.12) 42%,
      rgba(113, 201, 206, 0.08) 58%,
      transparent 74%
    );
    filter: blur(1px);
    animation: dude-aura 3.4s ease-in-out infinite;
    animation-delay: 2.2s;
    opacity: 0;
    pointer-events: none;
  }

  @keyframes dude-aura {
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

  .floating-dude:focus-visible {
    outline: 3px solid #ff6ac2;
    outline-offset: 4px;
    border-radius: 28px;
  }

  .dude-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    animation: float 6s ease-in-out infinite;
    transition: filter 0.3s ease;
  }

  .floating-dude:hover .dude-wrapper {
    filter: drop-shadow(0 0 15px rgba(255, 176, 0, 0.6));
  }

  .dude-base {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    max-width: none;
    object-fit: contain;
  }

  .dude-eyes {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform-origin: center 34%;
    animation: blink 4s infinite;
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-15px);
    }
  }

  @keyframes blink {
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

  /* Staggered text animation for title - more reliable approach */
  .staggered-text {
    opacity: 1;
    font-feature-settings: "kern" 1;
    font-kerning: normal;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .stagger-letter {
    display: inline-block;
    opacity: 0;
    transform: translateY(15px) translateZ(0);
    animation: staggerFadeIn 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards;
    animation-delay: var(--letter-delay, 0s);
    will-change: transform, opacity;
    backface-visibility: hidden;
  }

  @keyframes staggerFadeIn {
    0% {
      opacity: 0;
      transform: translateY(15px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Slide-in animation for subtitle - with hardware acceleration for performance */
  .slide-in-subtitle {
    opacity: 0;
    transform: translateY(10px);
    animation: slideIn 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards;
    animation-delay: 0.6s;
    will-change: transform, opacity;
    backface-visibility: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: "kern" 1;
    font-kerning: normal;
    max-inline-size: 40ch;
    text-wrap: balance;
    line-height: 1.4;
  }

  @keyframes slideIn {
    0% {
      opacity: 0;
      transform: translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Main container for title to help with centering */
  .title-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    margin-top: 152px;
  }

  /* Container to visually center the main "Ziplist" word */
  .ziplist-main-word {
    display: inline-block;
    position: relative;
  }

  /* App suffix container styling */
  .app-suffix-container {
    display: inline-block;
    width: 0;
    height: 0;
    overflow: visible;
  }

  /* Suffix wrapper for precise positioning */
  .suffix-wrapper {
    position: absolute;
    display: inline-block;
    bottom: 0;
    right: 0.25em; /* Positioned more to the left under the 'pe' */
    z-index: 1;
  }

  /* Simple styles for the suffix in title context */
  :global(.title-suffix) {
    letter-spacing: 0;
    font-variation-settings: inherit;
  }

  /* Media queries for mobile optimization */
  @media (max-width: 640px) {
    h1.staggered-text {
      font-size: 2.85rem;
      line-height: 1.1;
    }

    /* Adjust suffix for tablet screens */
    .suffix-wrapper {
      transform: scale(0.98);
    }

    /* No need for major mobile overrides anymore */

    .slide-in-subtitle {
      max-inline-size: 28ch !important;
      margin-top: 0.6rem !important;
      margin-bottom: 0.4rem !important;
      font-size: 0.95rem;
      line-height: 1.45;
      text-wrap: balance;
    }

    .floating-dude {
      width: 104px;
      height: 104px;
      top: -116px;
    }

    .floating-dude::after {
      inset: -12px;
      border-radius: 30px;
    }

    .title-container {
      margin-top: 116px;
    }
  }

  /* Small mobile adjustments */
  @media (max-width: 480px) {
    /* Further adjust suffix for small screens */
    .suffix-wrapper {
      transform: scale(0.95);
      right: 0.05em;
    }
  }

  /* Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .stagger-letter,
    .slide-in-subtitle {
      animation: none;
      opacity: 1;
      transform: none;
      will-change: auto;
    }
    .dude-wrapper {
      animation: none;
    }
    .dude-eyes {
      animation: none;
    }
    .floating-dude::after {
      animation: none;
      opacity: 0;
    }
  }
</style>
