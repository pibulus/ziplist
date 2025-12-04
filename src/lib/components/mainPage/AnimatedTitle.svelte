<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { AppSuffix } from '$lib/components/ui';
  import { hapticService } from '$lib/services/haptics';

  const dispatch = createEventDispatcher();
  
  // Component props
  export let title = 'ZipList';
  export let subtitle = "Zip up a list lickety-split.\nEasy and quick, say it and tick.";
  
  // AppSuffix configuration
  export let showAppSuffix = true;
  
  function handleDudeClick() {
    hapticService.medium(); // Tactile feedback
    dispatch('toggleRecording');
  }
  
  onMount(() => {
    // Set up animation sequence timing (for title/subtitle)
    setTimeout(() => {
      dispatch('titleAnimationComplete');
    }, 1200); // After staggered animation
    
    setTimeout(() => {
      dispatch('subtitleAnimationComplete');
    }, 2000); // After subtitle slide-in
  });
</script>

<!-- Typography with improved kerning and weight using font-variation-settings -->
<div class="relative title-container">
  <!-- The Floating Dude -->
  <button 
    class="floating-dude" 
    on:click={handleDudeClick}
    aria-label="Start Recording"
  >
    <div class="dude-wrapper">
      <img src="/assets/ziplist-icon-base.svg" alt="" class="dude-base" />
      <img src="/assets/ziplist-icon-eyes.svg" alt="" class="dude-eyes" />
    </div>
  </button>

  <h1
    class="mb-1 text-5xl font-black tracking-tight text-center cursor-default select-none staggered-text sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl"
    style="font-weight: 900; letter-spacing: -0.02em; font-feature-settings: 'kern' 1; font-kerning: normal; font-variation-settings: 'wght' 900, 'opsz' 32;"
    aria-label={title}
  >
    <!-- Use aria-hidden for spans if H1 has aria-label -->
    <span class="ziplist-main-word">
      <span class="stagger-letter mr-[-0.01em]" aria-hidden="true">Z</span><span class="stagger-letter ml-[0.01em]" aria-hidden="true">i</span><span
        class="stagger-letter mr-[-0.02em]" aria-hidden="true">p</span
      ><span class="stagger-letter mr-[-0.02em]" aria-hidden="true">L</span><span class="stagger-letter" aria-hidden="true">i</span><span
        class="stagger-letter ml-[0.01em]" aria-hidden="true">s</span
      ><span class="stagger-letter" aria-hidden="true">t</span>
    </span>
    
    {#if showAppSuffix}
      <span class="app-suffix-container stagger-letter" style="animation-delay: 0.45s; position: relative;">
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
  style="font-weight: 400; letter-spacing: 0.015em; line-height: 1.4; max-inline-size: 40ch; text-wrap: balance; font-variation-settings: 'wght' 400, 'opsz' 16;"
>
  {#each subtitle.split('\n') as line, i}
    {#if i > 0}<br>{/if}{line}
  {/each}
</p>

<style>
  /* Floating Dude Styles */
  .floating-dude {
    position: absolute;
    top: -100px; /* Adjust based on size */
    left: 50%;
    transform: translateX(-50%);
    width: 100px;
    height: 100px;
    background: none;
    border: none;
    cursor: pointer;
    z-index: 20;
    padding: 0;
    outline: none;
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
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .dude-eyes {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    animation: blink 4s infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-15px); }
  }

  @keyframes blink {
    0%, 48%, 52%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(0.1); }
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
    transform: translateY(15px);
    animation: staggerFadeIn 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards;
    will-change: transform, opacity;
  }

  /* Apply different delays to each letter */
  .stagger-letter:nth-child(1) { animation-delay: 0.05s; }
  .stagger-letter:nth-child(2) { animation-delay: 0.1s; }
  .stagger-letter:nth-child(3) { animation-delay: 0.15s; }
  .stagger-letter:nth-child(4) { animation-delay: 0.2s; }
  .stagger-letter:nth-child(5) { animation-delay: 0.25s; }
  .stagger-letter:nth-child(6) { animation-delay: 0.3s; }
  .stagger-letter:nth-child(7) { animation-delay: 0.35s; }
  .stagger-letter:nth-child(8) { animation-delay: 0.4s; }

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
    margin-top: 110px; /* Space for the floating dude (100px + buffer) */
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
    letter-spacing: -0.01em;
    font-variation-settings: inherit;
  }
  
  /* Media queries for mobile optimization */
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
      font-size: 1rem; /* 16px on mobile as requested */
      line-height: 1.6;
      text-wrap: balance;
    }
    
    .floating-dude {
      width: 80px;
      height: 80px;
      top: -80px;
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
</style>