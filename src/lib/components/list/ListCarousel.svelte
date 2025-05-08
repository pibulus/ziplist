<script>
  import { onMount, onDestroy } from 'svelte';
  import { listsStore, activeList } from '$lib/services/lists/listsStore';
  import { listsService } from '$lib/services/lists/listsService';
  import { themeService } from '$lib/services/theme';
  import ListCard from './ListCard.svelte';
  
  // State and data
  let lists = [];
  let activeListId = null;
  let carouselElement;
  
  // Subscribe to the lists store
  const unsubscribe = listsStore.subscribe(state => {
    lists = state.lists;
    activeListId = state.activeListId;
    
    // Ensure active list is in view when it changes
    setTimeout(() => {
      scrollToActiveList();
    }, 100);
  });
  
  onMount(() => {
    // Force explicit initialization of the store 
    console.log('ListCarousel component mounted, initializing lists');
    listsStore.initialize();
    listsService.getAllLists();
  });
  
  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });
  
  // Functions to manage lists
  function handleCreateList() {
    listsService.createList();
  }
  
  function handleSelectList(listId) {
    listsService.setActiveList(listId);
  }
  
  function handleToggleItem(listId, itemId) {
    if (listId === activeListId) {
      listsService.toggleItem(itemId);
    }
  }
  
  function handleDeleteList(listId) {
    listsService.deleteList(listId);
  }
  
  function handleRenameList(listId, newName) {
    if (listId === activeListId) {
      listsService.renameActiveList(newName);
    }
  }
  
  function handleClearList(listId) {
    if (listId === activeListId) {
      listsService.clearActiveList();
    }
  }
  
  // Scroll handling to show active list
  function scrollToActiveList() {
    if (!carouselElement || !activeListId) return;
    
    const activeCard = carouselElement.querySelector(`[data-list-id="${activeListId}"]`);
    if (activeCard) {
      activeCard.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest',
        inline: 'center'
      });
    }
  }
</script>

<div class="lists-container">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">My Lists</h2>
    <button class="btn btn-sm btn-{themeService.getCurrentTheme()}" on:click={handleCreateList}>
      New List
    </button>
  </div>
  
  {#if lists.length > 0}
    <div class="carousel carousel-center max-w-full p-4 space-x-4 bg-gray-100 rounded-box border border-{themeService.getCurrentTheme()}/20"
         bind:this={carouselElement}>
      {#each lists as list (list.id)}
        <div class="carousel-item" data-list-id={list.id}>
          <ListCard
            {list}
            isActive={list.id === activeListId}
            onSelect={() => handleSelectList(list.id)}
            onToggleItem={(itemId) => handleToggleItem(list.id, itemId)}
            onDeleteList={() => handleDeleteList(list.id)}
            onRenameList={(newName) => handleRenameList(list.id, newName)}
            onClearList={() => handleClearList(list.id)}
          />
        </div>
      {/each}
    </div>
    
    <!-- Optional navigation buttons -->
    <div class="flex justify-center gap-4 mt-4">
      <button 
        class="btn btn-circle btn-sm btn-{themeService.getCurrentTheme()}/70"
        on:click={() => {
          if (carouselElement) {
            carouselElement.scrollBy({ left: -300, behavior: 'smooth' });
          }
        }}
      >
        ❮
      </button>
      <button 
        class="btn btn-circle btn-sm btn-{themeService.getCurrentTheme()}/70"
        on:click={() => {
          if (carouselElement) {
            carouselElement.scrollBy({ left: 300, behavior: 'smooth' });
          }
        }}
      >
        ❯
      </button>
    </div>
  {:else}
    <div class="flex items-center justify-center h-40 bg-gray-100 rounded-box">
      <p class="text-gray-500">No lists found. Create a new list to get started.</p>
    </div>
  {/if}
</div>

<style>
  .lists-container {
    margin: 1rem auto;
    max-width: 1200px;
    padding: 0 1rem;
  }
  
  .carousel {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }
  
  .carousel-item {
    scroll-snap-align: center;
  }
</style>