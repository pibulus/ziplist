<script>
  import { onMount, onDestroy } from 'svelte';
  import { listsStore, activeList } from '$lib/services/lists/listsStore';
  import { listsService } from '$lib/services/lists/listsService';
  import { themeService } from '$lib/services/theme';
  import ListCard from './ListCard.svelte';
  import './list-components.css';
  
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
    
    // Update data attributes for better transitions
    const items = carouselElement.querySelectorAll('.carousel-item-mono');
    const activeIndex = lists.findIndex(list => list.id === activeListId);
    
    items.forEach((item, index) => {
      item.setAttribute('data-active', (index === activeIndex).toString());
      item.setAttribute('data-prev', (index === activeIndex - 1).toString());
      item.setAttribute('data-next', (index === activeIndex + 1).toString());
    });
  }
</script>

<div class="carousel-container list-mono">
  {#if lists.length > 0}
    <div 
      class="w-full"
      bind:this={carouselElement}
      on:touchstart={handleTouchStart}
      on:touchend={handleTouchEnd}
    >
      {#each lists as list, index (list.id)}
        <div 
          class="carousel-item-mono w-full flex justify-center"
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
            on:createList={handleCreateList}
          />
        </div>
      {/each}
    </div>
    
    <!-- Navigation buttons -->
    <div class="carousel-nav">
      <button 
        class="nav-btn-mono"
        on:click={() => {
          if (carouselElement) {
            // Find the current active list index
            const activeIndex = lists.findIndex(list => list.id === activeListId);
            if (activeIndex > 0) {
              // Select the previous list
              handleSelectList(lists[activeIndex - 1].id);
            }
          }
        }}
        disabled={lists.findIndex(list => list.id === activeListId) === 0}
        aria-label="Previous list"
      >
        ❮
      </button>
      
      <div class="nav-counter-mono">
        {lists.findIndex(list => list.id === activeListId) + 1} of {lists.length}
      </div>
      
      <button 
        class="nav-btn-mono"
        on:click={() => {
          if (carouselElement) {
            // Find the current active list index
            const activeIndex = lists.findIndex(list => list.id === activeListId);
            if (activeIndex < lists.length - 1) {
              // Select the next list
              handleSelectList(lists[activeIndex + 1].id);
            }
          }
        }}
        disabled={lists.findIndex(list => list.id === activeListId) === lists.length - 1}
        aria-label="Next list"
      >
        ❯
      </button>
    </div>
  {:else}
    <!-- Empty state -->
    <div class="card-mono w-full max-w-[640px] h-auto flex flex-col list-mono">
      <div class="card-content">
        <div class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p class="empty-title">No Lists Found</p>
          <p class="empty-description">Create your first list to get started</p>
          <button
            class="add-btn"
            on:click={() => handleCreateList()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Create New List
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>