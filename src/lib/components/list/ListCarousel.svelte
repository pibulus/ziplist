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
  
  // Swipe handling
  let touchStartX = 0;
  let touchEndX = 0;
  
  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
  }
  
  function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }
  
  function handleSwipe() {
    const swipeThreshold = 50; // Minimum px distance for swipe
    
    // Calculate current active index
    const activeIndex = lists.findIndex(list => list.id === activeListId);
    
    if (touchEndX < touchStartX - swipeThreshold) {
      // Swipe left - go to next card
      if (activeIndex < lists.length - 1) {
        handleSelectList(lists[activeIndex + 1].id);
      }
    }
    
    if (touchEndX > touchStartX + swipeThreshold) {
      // Swipe right - go to previous card
      if (activeIndex > 0) {
        handleSelectList(lists[activeIndex - 1].id);
      }
    }
  }
  
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
  
  function handleReorderItems(reorderedItems) {
    listsService.reorderItems(reorderedItems);
  }

  function handleAddItem(listId, text) {
    if (listId === activeListId) {
      listsService.addItem(text);
    }
  }

  function handleEditItem(listId, itemId, newText) {
    if (listId === activeListId) {
      listsService.editItem(itemId, newText);
    }
  }
  
  // Update active card with visual swipe effect
  function scrollToActiveList() {
    if (!carouselElement || !activeListId) return;
    
    // Update data attributes to trigger transitions
    const items = carouselElement.querySelectorAll('.carousel-item');
    const activeIndex = lists.findIndex(list => list.id === activeListId);
    
    items.forEach((item, index) => {
      item.setAttribute('data-active', (index === activeIndex).toString());
      item.setAttribute('data-prev', (index === activeIndex - 1).toString());
      item.setAttribute('data-next', (index === activeIndex + 1).toString());
    });
  }
</script>

<div class="lists-container">
  <div class="flex justify-between items-center mb-2">
    <h2 class="text-lg font-bold">My Lists</h2>
    <button class="btn btn-xs btn-{themeService.getCurrentTheme()}" on:click={handleCreateList}>
      New List
    </button>
  </div>
  
  {#if lists.length > 0}
    <div class="carousel w-full p-4 bg-transparent rounded-box flex justify-center"
         bind:this={carouselElement}
         on:touchstart={handleTouchStart}
         on:touchend={handleTouchEnd}>
      {#each lists as list, index (list.id)}
        <div 
          class="carousel-item" 
          data-list-id={list.id}
          data-active={list.id === activeListId}
          data-prev={index === lists.findIndex(l => l.id === activeListId) - 1}
          data-next={index === lists.findIndex(l => l.id === activeListId) + 1}
        >
          <ListCard
            {list}
            isActive={list.id === activeListId}
            onSelect={() => handleSelectList(list.id)}
            onToggleItem={(itemId) => handleToggleItem(list.id, itemId)}
            onDeleteList={() => handleDeleteList(list.id)}
            onRenameList={(newName) => handleRenameList(list.id, newName)}
            onClearList={() => handleClearList(list.id)}
            onReorderItems={handleReorderItems}
            onAddItem={(text) => handleAddItem(list.id, text)}
            onEditItem={(itemId, newText) => handleEditItem(list.id, itemId, newText)}
          />
        </div>
      {/each}
    </div>
    
    <!-- Navigation buttons -->
    <div class="flex justify-between items-center mt-4 px-1 relative z-20">
      <button 
        class="btn btn-circle btn-xs btn-{themeService.getCurrentTheme()}/70"
        on:click={() => {
          if (carouselElement) {
            // Find the current active list index
            const activeIndex = lists.findIndex(list => list.id === activeListId);
            if (activeIndex > 0) {
              // Select the previous list
              handleSelectList(lists[activeIndex - 1].id);
              // scrollToActiveList is called by the reactive store subscription
            }
          }
        }}
        disabled={lists.findIndex(list => list.id === activeListId) === 0}
      >
        ❮
      </button>
      
      <div class="text-center mx-2 text-xs">
        List {lists.findIndex(list => list.id === activeListId) + 1} of {lists.length}
      </div>
      
      <button 
        class="btn btn-circle btn-xs btn-{themeService.getCurrentTheme()}/70"
        on:click={() => {
          if (carouselElement) {
            // Find the current active list index
            const activeIndex = lists.findIndex(list => list.id === activeListId);
            if (activeIndex < lists.length - 1) {
              // Select the next list
              handleSelectList(lists[activeIndex + 1].id);
              // scrollToActiveList is called by the reactive store subscription
            }
          }
        }}
        disabled={lists.findIndex(list => list.id === activeListId) === lists.length - 1}
      >
        ❯
      </button>
    </div>
  {:else}
    <div class="card w-full max-w-[640px] min-h-[420px] shadow-lg bg-white border border-gray-200 mx-auto flex items-center justify-center">
      <div class="text-center p-6">
        <div class="text-gray-400 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p class="text-gray-500 mb-4">No lists found</p>
        <p class="text-sm text-gray-400">Create a new list to get started</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .lists-container {
    margin: 1rem auto;
    width: 95%;
    max-width: 700px; /* Narrower container to match card width */
    padding: 0 1rem;
    overflow-x: hidden; /* Ensure no horizontal scrollbar */
  }
  
  .carousel {
    overflow: visible;
    position: relative;
    height: auto;
    min-height: 450px; /* Minimum height for cards */
    perspective: 1200px; /* Enhanced 3D effect */
    transform-style: preserve-3d;
    padding: 20px 0;
  }
  
  .carousel-item {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 10px;
    opacity: 0;
    transform: translateX(0) translateY(20px) translateZ(-100px) scale(0.85);
    transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
    pointer-events: none;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
  }
  
  .carousel-item[data-active="true"] {
    opacity: 1;
    transform: translateX(0) translateY(0) translateZ(0) scale(1);
    pointer-events: all;
    z-index: 10;
    filter: drop-shadow(0 10px 15px rgba(0,0,0,0.2));
  }
  
  .carousel-item[data-prev="true"] {
    opacity: 0.7;
    transform: translateX(-30px) translateY(10px) translateZ(-40px) scale(0.95) rotateZ(-2deg);
    z-index: 5;
    pointer-events: none;
  }
  
  .carousel-item[data-next="true"] {
    opacity: 0.7;
    transform: translateX(30px) translateY(10px) translateZ(-40px) scale(0.95) rotateZ(2deg);
    z-index: 5;
    pointer-events: none;
  }
  
  /* Cards slightly visible in the stack */
  .carousel-item:not([data-active="true"]):not([data-prev="true"]):not([data-next="true"]) {
    opacity: 0.2;
    transform: translateX(0) translateY(30px) translateZ(-80px) scale(0.85);
    z-index: 1;
  }
</style>