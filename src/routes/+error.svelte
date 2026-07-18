<!--
  Branded error page — catches 404s and any unhandled route errors so ZipList
  never falls through to SvelteKit's cold framework default. Warm, on-brand,
  and never alarming: a missing page is a gentle nudge home, not a red wall.
-->
<script>
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import BrandMark from "$lib/components/ui/BrandMark.svelte";
  import { fly } from "svelte/transition";

  $: status = $page.status;
  $: isNotFound = status === 404;
  $: heading = isNotFound ? "This page went wandering" : "Something got tangled";
  $: blurb = isNotFound
    ? "We looked, but there's nothing here. The link may have a typo, or it moved. No worries — your lists are right where you left them."
    : "A little hiccup on our end. Give it another go, or head home and pick up where you left off.";
</script>

<svelte:head>
  <title>{isNotFound ? "Page went wandering" : "A little hiccup"} | ZipList</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="zl-error-container">
  <div class="zl-error-brand-row">
    <BrandMark />
  </div>
  <div class="zl-error-card" role="alert" in:fly={{ y: 20 }}>
    <div class="zl-error-icon" aria-hidden="true">✦</div>
    <h2>{heading}</h2>
    <p>{blurb}</p>
    <button type="button" class="zl-error-btn" on:click={() => goto("/")}>
      Go Home
    </button>
  </div>
</div>

<style>
  .zl-error-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Keep the brand's cream ground even on the error route (otherwise the page
     falls through to the dark html background). */
  :global(body:has(.zl-error-container)) {
    background-color: #fff6e6;
    background-image: radial-gradient(
      circle at 50% 35%,
      #fff8ed 0%,
      #fff6e6 52%,
      #fff3df 82%,
      #ffefda 100%
    );
  }

  .zl-error-brand-row {
    width: 100%;
    max-width: min(540px, calc(100vw - 2rem));
    margin: 0.5rem auto 0.35rem;
    padding-inline: 0.35rem;
  }

  .zl-error-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    max-width: 480px;
    margin: auto;
    padding: 2.5rem 2rem;
    background: rgba(255, 255, 255, 0.86);
    border: 2px solid rgba(255, 176, 0, 0.32);
    border-radius: 28px;
    box-shadow: 0 10px 24px rgba(255, 176, 0, 0.14);
  }

  .zl-error-icon {
    align-items: center;
    background: rgba(255, 255, 255, 0.82);
    border: 2px solid rgba(255, 176, 0, 0.42);
    border-radius: 24px;
    box-shadow:
      0 10px 24px rgba(255, 176, 0, 0.16),
      inset 0 0 0 2px rgba(255, 255, 255, 0.72);
    color: #c26d00;
    display: inline-flex;
    font-size: 2.6rem;
    height: 5rem;
    justify-content: center;
    margin-bottom: 1.25rem;
    width: 5rem;
  }

  .zl-error-card h2 {
    font-family: "Space Mono", monospace;
    font-size: 1.5rem;
    margin: 0 0 0.5rem;
    color: #111827;
  }

  .zl-error-card p {
    font-family: "Space Mono", monospace;
    color: #4b5563;
    margin-bottom: 1.75rem;
    line-height: 1.5;
  }

  .zl-error-btn {
    background: var(--zl-cta-color, #ffb000);
    color: #111111;
    border: none;
    border-radius: 999px;
    padding: 0.75rem 1.75rem;
    font-family: "Space Mono", monospace;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 3px 8px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.24);
  }

  .zl-error-btn:hover {
    transform: translateY(-2px);
    filter: saturate(1.08) brightness(1.04);
    box-shadow: 0 5px 15px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.32);
  }

  @media (max-width: 480px) {
    .zl-error-container {
      padding: 0.7rem;
    }
  }
</style>
