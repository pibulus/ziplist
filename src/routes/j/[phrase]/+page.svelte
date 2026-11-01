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
  <title>A shared list · ZipList</title>
  <meta
    name="description"
    content="A shared list, ready to tick together. No account needed."
  />
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ZipList" />
  <meta property="og:title" content="A shared list · ZipList" />
  <meta
    property="og:description"
    content="Add items and tick together, live. No account needed."
  />
  <meta
    property="og:url"
    content={`https://ziplist.app/j/${encodeURIComponent($page.params.phrase || "")}`}
  />
  <meta property="og:image" content="https://ziplist.app/og-card.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="ZipList shared list" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="A shared list · ZipList" />
  <meta
    name="twitter:description"
    content="Add items and tick together, live. No account needed."
  />
  <meta name="twitter:image" content="https://ziplist.app/og-card.png" />
  <meta name="twitter:image:alt" content="ZipList shared list" />
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
