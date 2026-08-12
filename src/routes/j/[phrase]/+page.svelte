<script>
  // ═══════════════════════════════════════════════════════════════════════
  // /j/<four-words> — the short door into a live list
  // ═══════════════════════════════════════════════════════════════════════
  // The phrase DERIVES the room id, so this isn't a lookup table or a
  // shortener with a database behind it — there's nothing to store and
  // nothing to go stale. Four words hash to exactly one room, forever.
  //
  // It hands off to /live/<roomId> rather than duplicating that route's
  // connect-and-render logic, so there is still only one live view.

  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import {
    deriveRoomIdFromPhrase,
    isValidSyncPhrase,
  } from "$lib/services/realtime/syncPhrase.js";

  let failed = false;

  onMount(async () => {
    const phrase = $page.params.phrase || "";

    if (!isValidSyncPhrase(phrase)) {
      failed = true;
      return;
    }

    const roomId = await deriveRoomIdFromPhrase(phrase);
    if (!roomId) {
      failed = true;
      return;
    }

    const query = $page.url.searchParams.toString();
    await goto(`/live/${roomId}${query ? `?${query}` : ""}`, {
      replaceState: true,
    });
  });
</script>

<svelte:head>
  <title>Opening a live list · ZipList</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="zl-join">
  {#if failed}
    <p class="zl-join-miss">That link didn't lead anywhere.</p>
    <a class="zl-join-home" href="/">Start a list of your own →</a>
  {/if}
</div>

<style>
  .zl-join {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.9rem;
    min-height: 60vh;
    padding: 2rem 1.5rem;
    font-family: "Space Mono", monospace;
    text-align: center;
  }

  .zl-join-miss {
    margin: 0;
    font-weight: 700;
    color: var(--zl-text-color-primary, #1e1714);
  }

  .zl-join-home {
    color: color-mix(in srgb, var(--zl-primary-color, #a970ea) 72%, #1e1714);
    font-weight: 700;
    text-decoration: none;
  }
</style>
