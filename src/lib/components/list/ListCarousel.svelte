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
  
  {#if lists.length > 0}
    <div class="carousel carousel-center w-full p-4 bg-transparent rounded-box"
         bind:this={carouselElement}
         on:touchstart={handleTouchStart}
         on:touchend={handleTouchEnd}>
      {#each lists as list, index (list.id)}
        <div
          class="carousel-item w-full"
          data-list-id={list.id}
          data-active={list.id === activeListId}
          data-prev={index === lists.findIndex(l => l.id === activeListId) - 1}
          data-next={index === lists.findIndex(l => l.id === activeListId) + 1}
        >
          <div class="w-full flex justify-center">
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
              on:createList={handleCreateList}
            />
          </div>
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
    <div class="card w-full max-w-[640px] min-h-[420px] shadow-lg bg-white border-[3px] border-[#e2d5f8] rounded-xl mx-auto flex items-center justify-center"
      style="box-shadow: 0 8px 20px rgba(186, 165, 240, 0.1);">
      <div class="text-center p-6">
        <div class="mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="#c4a9ff">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p class="text-gray-700 font-medium mb-4">No lists found</p>
        <p class="text-sm text-gray-500 mb-4">Create a new list to get started</p>
        <button
          class="btn btn-md mt-4"
          style="background-color: #b598ff; border: none; color: white; box-shadow: 0 2px 4px rgba(181, 152, 255, 0.3);"
          on:click|stopPropagation={() => {
            listsService.createList();
          }}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create New List
        </button>
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
    padding: 20px 0;
    min-height: 500px; /* Make sure there's room for the card content */
  }

  .carousel-item {
    /* For DaisyUI carousel items, we need to handle positioning differently */
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
    display: none; /* Hide non-active items */
  }

  .carousel-item[data-active="true"] {
    opacity: 1;
    display: block; /* Show only active item */
    z-index: 10;
  }

  /* Use the data attributes for special navigation styles */
  .carousel::after {
    content: "";
    display: block;
    height: 3px;
    width: 80px;
    margin: 20px auto 10px;
    background-color: var(--p);
    border-radius: 3px;
  }
</style>