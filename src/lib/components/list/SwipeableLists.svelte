<script>
  import { onDestroy } from 'svelte';
  import { spring } from 'svelte/motion';
  import { listsStore } from '$lib/services/lists/listsStore';
  import { hapticService } from '$lib/services/infrastructure/hapticService';
  import SingleList from './SingleList.svelte';

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
  let isSwiping = false;
  let activeIndex = 0;
  
  // Spring store for smooth physics-based movement
  const coords = spring({ x: 0 }, {
    stiffness: 0.15,
    damping: 0.5
  });

  $: if (lists.length > 0 && activeListId) {
    const index = lists.findIndex(l => l.id === activeListId);
    if (index !== -1 && index !== activeIndex) {
      activeIndex = index;
      // Update spring target
      if (!isSwiping) {
        coords.set({ x: -activeIndex * 100 });
      }
    }
  }

  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    isSwiping = true;
    // When dragging starts, we want immediate response, but spring handles it well too
    // We can adjust stiffness/damping dynamically if needed, but default is usually fine
  }

  function handleTouchMove(e) {
    if (!isSwiping) return;
    const touchCurrentX = e.changedTouches[0].screenX;
    const diff = touchCurrentX - touchStartX;
    
    // Calculate percentage shift based on screen width
    const screenWidth = window.innerWidth;
    const percentShift = (diff / screenWidth) * 100;
    
    let targetX = (-activeIndex * 100) + percentShift;
    
    // Apply resistance at edges
    if ((activeIndex === 0 && diff > 0) || (activeIndex === lists.length - 1 && diff < 0)) {
        targetX = (-activeIndex * 100) + (percentShift * 0.3);
    }
    
    // Set spring immediately (hard: false allows some springiness even while dragging, or true for direct 1:1)
    // For "lush" feel, let the spring follow the finger with slight lag
    coords.set({ x: targetX }, { hard: true }); 
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
        coords.set({ x: -activeIndex * 100 });
      }
    } else {
      // Snap back if threshold not met
      coords.set({ x: -activeIndex * 100 });
    }
  }

  function setActiveList(index) {
    if (index >= 0 && index < lists.length) {
      activeIndex = index;
      coords.set({ x: -index * 100 });
      listsStore.setActiveList(lists[index].id);
      
      // Haptic feedback on successful switch
      hapticService.impact('medium');
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
    style="transform: translateX({$coords.x}%);"
  >
    {#each lists as list (list.id)}
      <div 
        class="list-slide" 
        class:active={list.id === activeListId}
        style="--list-primary: {list.primaryColor}; --list-accent: {list.accentColor}; --list-glow: {list.glowColor}"
      >
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
        style="--dot-primary: {list.primaryColor}; --dot-accent: {list.accentColor}; --dot-glow: {list.glowColor}"
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
    background-color: var(--dot-accent);
    opacity: 0.4;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .dot.active {
    transform: scale(1.5);
    background-color: var(--dot-primary);
    opacity: 1;
    box-shadow: 0 2px 8px var(--dot-glow), 0 0 12px var(--dot-glow);
  }
  
  .dot:hover:not(.active) {
    opacity: 0.7;
    transform: scale(1.2);
  }
</style>
