<script>
  import { onMount, onDestroy } from 'svelte';
  import { listsStore, activeList } from '$lib/services/lists/listsStore';
  import { listsService } from '$lib/services/lists/listsService';
  import { themeService } from '$lib/services/theme';
  import ListComponent from './ListComponent.svelte';
  
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
      updateCarouselState();
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
    // Initialize the lists store
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
  
  // Update active card with visual effects
  function updateCarouselState() {
    if (!carouselElement || !activeListId) return;
    
    // Update data attributes for better transitions
    const slides = carouselElement.querySelectorAll('.carousel-item');
    const activeIndex = lists.findIndex(list => list.id === activeListId);
    
    slides.forEach((slide, index) => {
      if (index === activeIndex) {
        slide.setAttribute('data-active', 'true');
        slide.removeAttribute('data-prev');
        slide.removeAttribute('data-next');
      } else if (index === activeIndex - 1) {
        slide.setAttribute('data-prev', 'true');
        slide.removeAttribute('data-active');
        slide.removeAttribute('data-next');
      } else if (index === activeIndex + 1) {
        slide.setAttribute('data-next', 'true');
        slide.removeAttribute('data-active');
        slide.removeAttribute('data-prev');
      } else {
        slide.removeAttribute('data-active');
        slide.removeAttribute('data-prev');
        slide.removeAttribute('data-next');
      }
    });
  }
</script>

<div class="carousel-container">
  {#if lists.length > 0}
    <div 
      class="card-carousel"
      bind:this={carouselElement}
      on:touchstart={handleTouchStart}
      on:touchend={handleTouchEnd}
    >
      {#each lists as list, index (list.id)}
        <div 
          class="carousel-item w-full flex justify-center"
          data-active={list.id === activeListId}
          data-prev={index === lists.findIndex(l => l.id === activeListId) - 1}
          data-next={index === lists.findIndex(l => l.id === activeListId) + 1}
        >
          <ListComponent
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
    <div class="carousel-nav">
      <button 
        class="nav-btn"
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
      
      <div class="nav-counter">
        {lists.findIndex(list => list.id === activeListId) + 1} of {lists.length}
      </div>
      
      <button 
        class="nav-btn"
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
    
    <div class="carousel-actions">
      <button 
        class="create-list-btn"
        on:click={handleCreateList}
      >
        Create New List
      </button>
    </div>
  {:else}
    <!-- Empty state -->
    <div class="empty-container">
      <div class="zl-card">
        <div class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="h-16 w-16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p class="empty-title">No Lists Found</p>
          <p class="empty-description">Create your first list to get started</p>
          <button
            class="create-list-btn"
            on:click={handleCreateList}
          >
            Create New List
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Animations and keyframes */
  @keyframes fadeScale {
    from {
      opacity: 0.7;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  /* Carousel container */
  .carousel-container {
    width: 100%;
    max-width: 700px;
    margin: 0 auto;
    padding: 0;
    min-height: 500px;
    position: relative;
  }
  
  .card-carousel {
    position: relative;
    min-height: 500px;
  }
  
  .carousel-item {
    opacity: 0;
    transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
    display: none;
    width: 100%;
  }
  
  .carousel-item[data-active="true"] {
    opacity: 1;
    display: block;
    z-index: 10;
    animation: fadeScale 0.5s cubic-bezier(0.19, 1, 0.22, 1);
  }
  
  /* Navigation and controls */
  .carousel-nav {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 1.75rem;
    gap: 1.25rem;
    font-family: 'Space Mono', monospace;
  }
  
  .nav-btn {
    width: 45px;
    height: 45px;
    border-radius: 50%;
    background: linear-gradient(145deg, #ffcdc1, #ffc6e5);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c978ff;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 3px 10px rgba(201, 120, 255, 0.15);
  }
  
  .nav-btn:hover:not(:disabled) {
    background: linear-gradient(145deg, #ffc6e5, #ffcdc1);
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 5px 15px rgba(201, 120, 255, 0.25);
    color: #b666e6;
  }
  
  .nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  .nav-counter {
    font-size: 0.9rem;
    font-weight: 500;
    color: #c978ff;
    background: rgba(201, 120, 255, 0.1);
    padding: 0.6rem 1.2rem;
    border-radius: 20px;
    box-shadow: 0 2px 5px rgba(201, 120, 255, 0.05);
    font-family: 'Space Mono', monospace;
  }
  
  .carousel-actions {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
  }
  
  .create-list-btn {
    background: linear-gradient(135deg, #e9a8ff 0%, #c978ff 100%);
    border: none;
    color: white;
    border-radius: 14px;
    padding: 0.8rem 1.5rem;
    font-weight: 500;
    font-size: 1rem;
    font-family: 'Space Mono', monospace;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(201, 120, 255, 0.25);
    position: relative;
    overflow: hidden;
  }
  
  .create-list-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 50%);
    border-radius: 14px;
  }
  
  .create-list-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 6px 15px rgba(201, 120, 255, 0.35);
  }
  
  /* Empty state styling */
  .empty-container {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
  }
  
  .zl-card {
    border-radius: 28px;
    background: linear-gradient(145deg, #ffcdc1, #ffc6e5);
    background-size: 200% 200%;
    animation: gradient-shift 20s ease infinite;
    box-shadow: 0 10px 20px rgba(201, 120, 255, 0.15);
    padding: 1.75rem;
    position: relative;
    overflow: hidden;
    font-family: 'Space Mono', monospace;
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    width: 100%;
    margin: 0 auto;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2.5rem 1rem;
    min-height: 300px;
    font-family: 'Space Mono', monospace;
  }
  
  .empty-icon {
    color: #e9a8ff;
    margin-bottom: 1.75rem;
    opacity: 0.9;
    filter: drop-shadow(0 4px 8px rgba(201, 120, 255, 0.2));
    transform: scale(1.1);
  }
  
  .empty-title {
    font-weight: 600;
    color: #c978ff;
    margin-bottom: 0.8rem;
    font-size: 1.5rem;
    font-family: 'Space Mono', monospace;
  }
  
  .empty-description {
    color: #9d9d9d;
    font-size: 1rem;
    margin-bottom: 1.75rem;
    max-width: 270px;
    font-family: 'Space Mono', monospace;
  }
  
  /* Utility classes */
  .w-full {
    width: 100%;
  }
  
  .flex {
    display: flex;
  }
  
  .justify-center {
    justify-content: center;
  }
</style>