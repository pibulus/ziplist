<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { MainContainer } from '$lib/components/mainPage';
  import { listsStore } from '$lib/services/lists/listsStore';
  import { get } from 'svelte/store';

  onMount(() => {
    // Handle deep linking to specific lists via ?list=ID
    const listId = $page.url.searchParams.get('list');
    
    if (listId) {
      const state = get(listsStore);
      const exists = state.lists.some(l => l.id === listId);
      
      if (!exists) {
        // Create a stub list so we can connect to it
        // The real data will be populated by the live service
        listsStore.update(s => ({
          ...s,
          lists: [...s.lists, {
            id: listId,
            name: 'Loading...',
            items: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }]
        }));
      }
      
      // Set as active list
      listsStore.setActiveList(listId);
      
      // Clean up URL without reloading
      const newUrl = new URL($page.url);
      newUrl.searchParams.delete('list');
      // history.replaceState(history.state, '', newUrl); // Optional: keep clean URL
    }
  });
</script>

<MainContainer />
