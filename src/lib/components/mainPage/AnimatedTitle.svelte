<script>
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  import { AppSuffix, Mascot } from "$lib/components/ui";
  import { hapticService } from "$lib/services/infrastructure/hapticService";
  import { isRecording } from "$lib/services/infrastructure/stores.js";

  const dispatch = createEventDispatcher();

  // Component props
  export let title = "ZipList";
  export let subtitle =
    "Speak up a list, lickety split.\nThe shareable voice list thing.";

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
  <!-- The Floating Dude — shared Mascot component (SoftStack standard).
       Named label + live state so screen readers can tell it apart from the
       record button (the old static "Start recording" never flipped). -->
  <Mascot
    ariaLabel={$isRecording
      ? "ZipList mascot — stop recording"
      : "ZipList mascot — start recording"}
    on:click={handleDudeClick}
  />

  <h1
    class="mb-1 text-[clamp(3rem,7.5vmin_+_1rem,5.5rem)] font-black tracking-normal text-center cursor-default select-none staggered-text"
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
  class="mx-auto mt-3 mb-3 text-base text-center cursor-default select-none slide-in-subtitle max-w-prose text-gray-700/85 sm:mt-3 sm:mb-3 sm:text-lg md:text-xl"
  style="font-weight: 400; letter-spacing: 0; line-height: 1.4; max-inline-size: 40ch; text-wrap: balance; font-variation-settings: 'wght' 400, 'opsz' 16;"
>
  {#each subtitle.split("\n") as line, i}
    {#if i > 0}<br />{/if}{line}
  {/each}
</p>

<style>
  /* Mascot styling lives in the shared Mascot component (ui/Mascot.svelte). */

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
  /* Compact desktop viewports (≤820px tall): smaller wordmark so the list
     card surfaces above the fold. */
  @media (min-width: 768px) and (max-height: 820px) {
    h1.staggered-text {
      font-size: 4rem;
      line-height: 1.05;
    }
    .slide-in-subtitle {
      margin-bottom: 0.5rem;
    }
  }

  /* Squat laptops: smaller still. */
  @media (min-width: 768px) and (max-height: 740px) {
    h1.staggered-text {
      font-size: 3.25rem;
    }
    .slide-in-subtitle {
      margin-top: 0.5rem;
      margin-bottom: 0.4rem;
    }
  }

  @media (max-width: 640px) {
    h1.staggered-text {
      font-size: 3rem;
      line-height: 1.1;
    }

    /* Adjust suffix for tablet screens */
    .suffix-wrapper {
      transform: scale(0.98);
    }

    /* No need for major mobile overrides anymore */

    .slide-in-subtitle {
      max-inline-size: 28ch !important;
      font-size: 1rem;
      line-height: 1.6;
      text-wrap: balance;
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
  }
</style>
