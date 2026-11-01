<script>
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    savedSharedLists,
    forgetSharedList,
  } from "$lib/services/realtime/savedSharedLists.js";

  let expanded = false;
  const motionDuration = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 180;
</script>

{#if $savedSharedLists.length}
  <section class="saved-shared" aria-label="Saved shared lists">
    <button
      type="button"
      class="saved-toggle"
      aria-expanded={expanded}
      aria-controls="saved-shared-links"
      on:click={() => (expanded = !expanded)}
    >
      <span
        >Shared with me <span class="saved-count"
          >{$savedSharedLists.length}</span
        ></span
      >
      <span class:expanded class="saved-chevron" aria-hidden="true">⌄</span>
    </button>
    {#if expanded}
      <div
        class="saved-links"
        id="saved-shared-links"
        transition:slide={{ duration: motionDuration(), easing: cubicOut }}
      >
        {#each $savedSharedLists as entry (entry.roomId)}
          <div class="saved-chip" style={`--shared-color: ${entry.color}`}>
            <a
              href={`/live/${encodeURIComponent(entry.roomId)}`}
              title={entry.name}
            >
              <span class="saved-dot" aria-hidden="true"></span>
              <span class="saved-name">{entry.name}</span>
            </a>
            <button
              type="button"
              on:click={() => forgetSharedList(entry.roomId)}
              aria-label={`Forget ${entry.name} shared link`}
              title="Forget this link"><span aria-hidden="true">×</span></button
            >
          </div>
        {/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .saved-shared {
    width: min(100%, 540px);
    margin: 0 auto 0.7rem;
    padding: 0 0.35rem;
    color: #1e1714;
  }
  .saved-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 44px;
    padding: 0.2rem 0.7rem;
    border: 1px solid rgba(30, 23, 20, 0.22);
    border-radius: 12px;
    background: #fbf1e4;
    color: inherit;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.02em;
    cursor: pointer;
  }
  .saved-toggle:hover,
  .saved-toggle:focus-visible {
    background: #fff2d7;
  }
  .saved-count {
    margin-left: 0.25rem;
    font-weight: 700;
    opacity: 0.68;
  }
  .saved-chevron {
    font-size: 1.15rem;
    line-height: 1;
    transition: transform 180ms ease;
  }
  .saved-chevron.expanded {
    transform: rotate(180deg);
  }
  .saved-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    padding: 0.55rem 0.1rem 0.15rem;
  }
  .saved-chip {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 100%;
    border: 2px solid #1e1714;
    border-radius: 999px;
    background: #fbf1e4;
    box-shadow: 2px 2px 0 #1e1714;
    font-size: 0.8rem;
    font-weight: 800;
  }
  .saved-chip a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
    min-height: 44px;
    padding: 0.3rem 0.35rem 0.3rem 0.7rem;
    color: inherit;
    text-decoration: none;
    white-space: nowrap;
  }
  .saved-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .saved-dot {
    width: 0.65rem;
    height: 0.65rem;
    flex: 0 0 0.65rem;
    border: 1px solid #1e1714;
    border-radius: 50%;
    background: var(--shared-color);
  }
  .saved-chip button {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #1e1714;
    font-size: 1.2rem;
    cursor: pointer;
  }
  .saved-chip button span {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    margin: auto;
    transition: transform 0.22s linear(0, 0.5 15%, 1.15 40%, 0.97 65%, 1);
  }
  .saved-chip button:hover,
  .saved-chip button:focus-visible {
    outline-offset: -4px;
  }
  .saved-chip button:hover span,
  .saved-chip button:focus-visible span {
    background: color-mix(in srgb, var(--shared-color) 20%, #fbf1e4);
    transform: scale(1.1);
  }
  .saved-chip button:active span {
    transform: scale(0.86);
  }
  @media (prefers-reduced-motion: reduce) {
    .saved-chevron,
    .saved-chip button span {
      transition: none;
    }
  }
</style>
