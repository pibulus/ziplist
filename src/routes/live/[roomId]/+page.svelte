<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { listsStore } from '$lib/services/lists/listsStore';
  import { connectToLive } from '$lib/services/realtime/liveListsService';
  import { getPresenceStore } from '$lib/services/realtime/presenceStore';
  import { getOrCreateAvatar } from '$lib/services/realtime/avatarService';
  import SingleList from '$lib/components/list/SingleList.svelte';
  import { fade, fly } from 'svelte/transition';

  // Get room ID from URL
  $: roomId = $page.params.roomId;
  $: password = $page.url.searchParams.get('pwd');

  let isLoading = true;
  let error = null;
  let listId = null;
  let presence = [];
  let avatar = '';
  let presenceUnsubscribe = null;

  onMount(async () => {
    avatar = getOrCreateAvatar();

    try {
      // Create a temporary list ID for this session
      listId = `live_${roomId}`;

      // Connect to the live room
      await connectToLive(listId, roomId, password);

      // Subscribe to presence
      const presenceStore = getPresenceStore(listId);
      presenceUnsubscribe = presenceStore.subscribe(users => {
        presence = users;
      });

      isLoading = false;

      // After connection, set this as the active list
      // The list data will be populated by the onInit callback in liveListsService
      listsStore.setActiveList(listId);
    } catch (err) {
      console.error('Failed to join live list:', err);
      error = err.message || 'Failed to join live list';
      isLoading = false;
    }
  });

  onDestroy(() => {
    if (presenceUnsubscribe) {
      presenceUnsubscribe();
    }
  });
</script>

<div class="live-join-container">
  {#if isLoading}
    <div class="loading-state" in:fade>
      <div class="spinner"></div>
      <h2>Joining live list...</h2>
      <p>Connected as <strong>{avatar}</strong></p>
    </div>
  {:else if error}
    <div class="error-state" in:fly={{ y: 20 }}>
      <div class="error-icon">❌</div>
      <h2>Failed to Join</h2>
      <p>{error}</p>
      <button class="btn-primary" on:click={() => goto('/')}>
        Go Home
      </button>
    </div>
  {:else}
    <div class="live-header" in:fade>
      <div class="live-badge">
        <span class="live-pulse">🔴</span>
        <span>LIVE</span>
      </div>
      <div class="presence-avatars">
        {#each presence as user (user.id)}
          <div class="avatar-badge" title={user.avatar}>
            {user.avatar}
          </div>
        {/each}
      </div>
    </div>

    <SingleList />
  {/if}
</div>

<style>
  .live-join-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem 1rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
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
    border: 4px solid rgba(255, 107, 107, 0.2);
    border-top-color: #ff6b6b;
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
    font-family: 'Space Mono', monospace;
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #333;
  }

  .loading-state p,
  .error-state p {
    font-family: 'Space Mono', monospace;
    color: #666;
    margin-bottom: 1rem;
  }

  .error-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .btn-primary {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
    color: white;
    border: none;
    border-radius: 16px;
    padding: 0.75rem 1.5rem;
    font-family: 'Space Mono', monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 3px 8px rgba(255, 107, 107, 0.3);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
  }

  .live-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: white;
    border-radius: 16px;
    margin-bottom: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .live-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 12px;
    font-family: 'Space Mono', monospace;
    font-weight: 600;
    font-size: 0.9rem;
    box-shadow: 0 2px 6px rgba(255, 107, 107, 0.3);
  }

  .live-pulse {
    animation: pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse-red {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .presence-avatars {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .avatar-badge {
    background: linear-gradient(135deg, #e9a8ff 0%, #c978ff 100%);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: 12px;
    font-family: 'Space Mono', monospace;
    font-size: 0.8rem;
    font-weight: 600;
    box-shadow: 0 2px 6px rgba(201, 120, 255, 0.2);
    white-space: nowrap;
  }

  @media (max-width: 480px) {
    .live-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .presence-avatars {
      width: 100%;
    }

    .avatar-badge {
      font-size: 0.75rem;
      padding: 0.4rem 0.6rem;
    }
  }
</style>
