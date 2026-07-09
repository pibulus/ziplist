<script>
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { listsStore } from "$lib/services/lists/listsStore";
  import {
    connectToLive,
    disconnectFromLive,
  } from "$lib/services/realtime/liveListsService";
  import { getOrCreateAvatar } from "$lib/services/realtime/avatarService";
  import SingleList from "$lib/components/list/SingleList.svelte";
  import { fade, fly } from "svelte/transition";

  // Get room ID from URL
  $: roomId = $page.params.roomId;
  $: password = $page.url.searchParams.get("pwd");

  let isLoading = true;
  let error = null;
  let errorCode = null;
  let listId = null;
  let avatar = "";

  onMount(async () => {
    avatar = getOrCreateAvatar();

    try {
      // Create a temporary list ID for this session
      listId = `live_${roomId}`;

      // Connect to the live room
      await connectToLive(listId, roomId, password);

      isLoading = false;

      // After connection, set this as the active list
      // The list data will be populated by the onInit callback in liveListsService
      listsStore.setActiveList(listId);
    } catch (err) {
      errorCode = err.code || null;
      if (errorCode === "room_expired") {
        console.info("Live list room has expired:", roomId);
      } else {
        console.error("Failed to join live list:", err);
      }
      error = err.message || "That live link needs one more try.";
      isLoading = false;
    }
  });

  onDestroy(() => {
    if (listId) {
      disconnectFromLive(listId);
    }
  });
</script>

<svelte:head>
  <title>Join Live List | ZipList</title>
  <meta
    name="description"
    content="Join a shared live ZipList room and collaborate on a list in real time."
  />
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ZipList" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:url" content={`https://ziplist.app/live/${roomId}`} />
  <meta property="og:title" content="Join a Live ZipList" />
  <meta
    property="og:description"
    content="Open a shared ZipList room and collaborate on a list in real time."
  />
  <meta property="og:image" content="https://ziplist.app/og-image.png" />
  <meta
    property="og:image:secure_url"
    content="https://ziplist.app/og-image.png"
  />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="ZipList live shared list room" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content={`https://ziplist.app/live/${roomId}`} />
  <meta name="twitter:title" content="Join a Live ZipList" />
  <meta
    name="twitter:description"
    content="Open a shared ZipList room and collaborate on a list in real time."
  />
  <meta name="twitter:image" content="https://ziplist.app/og-image.png" />
  <meta name="twitter:image:alt" content="ZipList live shared list room" />
</svelte:head>

<div class="live-join-container">
  {#if isLoading}
    <div class="loading-state" role="status" aria-live="polite" in:fade>
      <div class="spinner" aria-hidden="true"></div>
      <h2>Joining live list...</h2>
      <p>Connected as <strong>{avatar}</strong></p>
    </div>
  {:else if error}
    <div
      class="error-state"
      class:popped-state={errorCode === "room_expired"}
      role="alert"
      in:fly={{ y: 20 }}
    >
      <div class="error-icon" aria-hidden="true">
        {errorCode === "room_expired" ? "✦" : "!"}
      </div>
      <h2>
        {errorCode === "room_expired"
          ? "This room popped"
          : "Live link needs another try"}
      </h2>
      <p>
        {errorCode === "room_expired"
          ? "The live link has gone quiet. Start fresh and make a new one."
          : error}
      </p>
      <button type="button" class="btn-primary" on:click={() => goto("/")}>
        {errorCode === "room_expired" ? "Start Fresh" : "Go Home"}
      </button>
    </div>
  {:else}
    <span class="live-status-sr" role="status" aria-live="polite">
      Live collaboration is active.
    </span>
    <SingleList {listId} showListManagement={false} />
  {/if}
</div>

<style>
  .live-join-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* The cream ground is the brand's constant — live rooms are no
     exception (without this the page fell through to the dark html bg). */
  :global(body:has(.live-join-container)) {
    background-color: #fff6e6;
    background-image: radial-gradient(
      circle at center,
      #fff6e6 0%,
      #fff6e6 40%,
      #fff0d4 70%,
      #ffe8c8 100%
    );
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3rem 2rem;
    min-height: 60vh;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 176, 0, 0.22);
    border-top-color: #ffb000;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1.5rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state h2,
  .error-state h2 {
    font-family: "Space Mono", monospace;
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #111827;
  }

  .loading-state p,
  .error-state p {
    font-family: "Space Mono", monospace;
    color: #4b5563;
    margin-bottom: 1rem;
  }

  .error-icon {
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
    margin-bottom: 1rem;
    width: 5rem;
  }

  .popped-state {
    background:
      radial-gradient(
        circle at 50% 16%,
        rgba(255, 176, 0, 0.2),
        transparent 34%
      ),
      rgba(255, 255, 255, 0.88);
    border: 2px dashed rgba(255, 176, 0, 0.32);
    border-radius: 28px;
  }

  .popped-state h2 {
    color: #252525;
  }

  .popped-state p {
    color: #5e5140;
  }

  .btn-primary {
    background: var(--zl-cta-color, #ffb000);
    color: #111111;
    border: none;
    border-radius: 16px;
    padding: 0.75rem 1.5rem;
    font-family: "Space Mono", monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 3px 8px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.24);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    filter: saturate(1.08) brightness(1.04);
    box-shadow: 0 4px 12px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.35);
  }

  .live-status-sr {
    border: 0;
    clip: rect(0, 0, 0, 0);
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  @media (max-width: 480px) {
    .live-join-container {
      padding: 0.7rem;
    }
  }
</style>
