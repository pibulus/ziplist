<script>
  import { onMount, onDestroy } from 'svelte';
  import { listsStore } from '$lib/services/lists/listsStore';
  import SingleList from './SingleList.svelte';
  import { fade } from 'svelte/transition';

  // Subscribe to lists store
  let lists = [];
  let activeListId = null;
  
  const unsubscribe = listsStore.subscribe(state => {
    lists = state.lists;
    activeListId = state.activeListId;
  });

  // Swipe handling state
  let touchStartX = 0;
  let touchEndX = 0;
  let containerRef;
  let isSwiping = false;
  let currentTranslateX = 0;
  let activeIndex = 0;

  $: if (lists.length > 0 && activeListId) {
    const index = lists.findIndex(l => l.id === activeListId);
    if (index !== -1 && index !== activeIndex) {
      activeIndex = index;
      // Reset translation when active index changes externally
      if (!isSwiping) {
        currentTranslateX = -activeIndex * 100;
      }
    }
  }

  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    isSwiping = true;
  }

  function handleTouchMove(e) {
    if (!isSwiping) return;
    const touchCurrentX = e.changedTouches[0].screenX;
    const diff = touchCurrentX - touchStartX;
    
    // Calculate percentage shift based on screen width
    // Limit drag to prevent overscrolling too much
    const screenWidth = window.innerWidth;
    const percentShift = (diff / screenWidth) * 100;
    
    // Apply resistance at edges
    if ((activeIndex === 0 && diff > 0) || (activeIndex === lists.length - 1 && diff < 0)) {
        currentTranslateX = (-activeIndex * 100) + (percentShift * 0.3);
    } else {
        currentTranslateX = (-activeIndex * 100) + percentShift;
    }
  }

  function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    isSwiping = false;
    handleSwipeGesture();
  }

  function handleSwipeGesture() {
    const threshold = 50; // Minimum distance for swipe
    const diff = touchEndX - touchStartX;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && activeIndex > 0) {
        // Swipe Right -> Previous List
        setActiveList(activeIndex - 1);
      } else if (diff < 0 && activeIndex < lists.length - 1) {
        // Swipe Left -> Next List
        setActiveList(activeIndex + 1);
      } else {
        // Snap back
        currentTranslateX = -activeIndex * 100;
      }
    } else {
      // Snap back if threshold not met
      currentTranslateX = -activeIndex * 100;
    }
  }

  function setActiveList(index) {
    if (index >= 0 && index < lists.length) {
      activeIndex = index;
      currentTranslateX = -index * 100;
      listsStore.setActiveList(lists[index].id);
    }
  }

  onDestroy(() => {
    unsubscribe();
  });
</script>

<div 
  class="swipe-container"
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
>
  <div 
    class="lists-wrapper" 
    bind:this={containerRef}
    style="transform: translateX({currentTranslateX}%); transition: {isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'};"
  >
    {#each lists as list (list.id)}
      <div class="list-slide" class:active={list.id === activeListId}>
        <div class="list-content-wrapper">
            <SingleList listId={list.id} />
        </div>
      </div>
    {/each}
  </div>
  
  <!-- Pagination Indicators -->
  <div class="pagination-dots">
    {#each lists as list, i}
      <button 
        class="dot" 
        class:active={i === activeIndex}
        style="--dot-color: var(--zl-color-{list.color}, #ccc)"
        on:click={() => setActiveList(i)}
        aria-label="Switch to {list.name}"
      ></button>
    {/each}
  </div>
</div>

<style>
  .swipe-container {
    width: 100%;
    overflow: hidden;
    position: relative;
    /* Ensure it takes up available space but doesn't overflow vertically if possible */
    display: flex;
    flex-direction: column;
  }

  .lists-wrapper {
    display: flex;
    width: 100%;
    /* Will be transformed via inline styles */
    will-change: transform;
  }

  .list-slide {
    width: 100%;
    flex-shrink: 0;
    padding: 0 4px; /* Tiny padding between slides */
    box-sizing: border-box;
    opacity: 0.4;
    transform: scale(0.95);
    transition: opacity 0.3s, transform 0.3s;
    pointer-events: none; /* Disable interaction on non-active slides */
  }

  .list-slide.active {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
  }
  
  .list-content-wrapper {
    max-width: 600px; /* Match SingleList max-width */
    margin: 0 auto;
    height: 100%;
  }

  .pagination-dots {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #e5e7eb;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .dot.active {
    transform: scale(1.4);
    background-color: var(--dot-color);
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  }
  
  /* Define dot colors matching the lists */
  .dot[style*="blue"] { --dot-color: #4dd0e1; }
  .dot[style*="pink"] { --dot-color: #ff82ca; }
  .dot[style*="yellow"] { --dot-color: #ffd700; }
</style>
