<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { listsStore, activeList } from '$lib/services/lists/listsStore';
  import { listsService } from '$lib/services/lists/listsService';
  import { shareList } from '$lib/services/share';
  import { hapticService } from '$lib/services/infrastructure/hapticService';

  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  
  // Props
  export let listId = null; // If provided, this component will display this specific list

  // State variables
  let list = { name: '', items: [] };
  let draggedItemId = null;
  let dragOverItemId = null;
  let editingItemId = null;
  let editedItemText = '';
  let isCreatingNewItem = false;
  let newItemText = '';
  let shareStatus = null; // To track share operation status
  
  // Subscribe to the appropriate list
  let unsubscribe;

  $: {
    // Clean up previous subscription if exists
    if (unsubscribe) unsubscribe();

    if (listId) {
      // Subscribe to specific list from the main store
      unsubscribe = listsStore.subscribe(state => {
        const foundList = state.lists.find(l => l.id === listId);
        if (foundList) {
          list = foundList;
        }
      });
    } else {
      // Fallback to active list (legacy behavior)
      unsubscribe = activeList.subscribe(activeListData => {
        if (activeListData) {
          list = activeListData;
        }
      });
    }
  }

  onMount(() => {
    // Initialize the lists store if not already done
    // listsStore.initialize(); // Should be done at app root now
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });
  
  // Share list function
  async function handleShareList() {
    if (!list || !list.items || list.items.length === 0) {
      shareStatus = { success: false, message: 'Cannot share an empty list' };
      setTimeout(() => shareStatus = null, 3000); // Clear message after 3 seconds
      return;
    }

    try {
      const result = await shareList(list);
      if (result.success) {
        if (result.urlTooLong) {
          shareStatus = { success: true, message: 'Share link copied! Note: Very long URL, may not work in all apps.' };
        } else {
          shareStatus = { success: true, message: 'Share link copied!' };
        }
        // Track successful share
        // postHogService.trackListShared(list.items.length, true);
      } else {
        shareStatus = { success: false, message: 'Failed to share list' };
        // Track failed share
        // postHogService.trackListShared(list.items.length, false);
      }
      setTimeout(() => shareStatus = null, result.urlTooLong ? 5000 : 3000); // Show warning longer
    } catch (error) {
      console.error('Failed to share list:', error);
      shareStatus = { success: false, message: 'Failed to share list' };
      // Track failed share
      // postHogService.trackListShared(list.items.length, false);
      setTimeout(() => shareStatus = null, 3000); // Clear message after 3 seconds
    }
  }
  
  // Separated active and completed items
  $: activeItems = list.items.filter(item => !item.checked);
  $: completedItems = list.items.filter(item => item.checked);

  // Sort items - active items first, completed items last
  $: sortedItems = [...activeItems, ...completedItems];

  // Format item text with first-letter capitalization of each word - with memoization
  const textCache = new Map();
  function formatItemText(text) {
    // Return cached result if available
    if (textCache.has(text)) {
      return textCache.get(text);
    }

    // Otherwise compute, cache and return
    const formattedText = text.split(' ').map(word =>
      word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    ).join(' ');

    // Cache the result (limit cache size to prevent memory issues)
    if (textCache.size > 100) {
      const firstKey = textCache.keys().next().value;
      textCache.delete(firstKey);
    }
    textCache.set(text, formattedText);

    return formattedText;
  }

  // Helper function to calculate staggered delay for animations
  async function handleEmptyStateClick() {
    // Add a new item to start editing
    listsService.addItem('Type here...');
    await tick();
    
    // Find the new item (last one) and start editing
    if (list.items.length > 0) {
      const newItem = list.items[list.items.length - 1];
      startEditingItem(newItem);
      // Clear the placeholder text immediately so user can type
      editedItemText = ''; 
    }
  }
  function getStaggerDelay(index) {
    return index * 50; // 50ms between each item
  }

  // Action to auto-focus an input element when it's created
  function autoFocus(node) {
    node.focus();
    return {};
  }

  // Action for detecting clicks outside an element
  function clickOutside(node, { enabled, callback }) {
    const handleClick = (event) => {
      if (enabled && !node.contains(event.target)) {
        callback();
      }
    };

    document.addEventListener('click', handleClick, true);
    
    return {
      update(params) {
        enabled = params.enabled;
        callback = params.callback;
      },
      destroy() {
        document.removeEventListener('click', handleClick, true);
      }
    };
  }
  
  // Drag and drop functions
  function handleDragStart(event, itemId) {
    // Prevent dragging if item is being edited
    if (editingItemId === itemId) {
      event.preventDefault();
      return;
    }

    // Set data and styling
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    draggedItemId = itemId;

    // Haptic feedback
    // Haptic feedback
    hapticService.impact('light');
  }

  function handleDragEnd(event) {
    // Remove styling
    draggedItemId = null;
    dragOverItemId = null;

    // Haptic feedback
    // Haptic feedback
    hapticService.impact('medium');
  }

  function handleDragOver(event, itemId) {
    // Prevent default to allow drop
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    // Don't allow drag over on checked items or the dragged item itself
    if (draggedItemId === itemId) return;

    // Get the target item to check if it's checked
    const targetItem = list.items.find(item => item.id === itemId);
    if (targetItem?.checked) return;

    // Only update if we're moving to a new item
    if (dragOverItemId === itemId) return;

    // Update dragover state with haptic feedback
    dragOverItemId = itemId;

    // Add subtle haptic feedback when moving over a valid drop target
    // Add subtle haptic feedback when moving over a valid drop target
    hapticService.impact('light');
  }

  function handleDrop(event, targetItemId) {
    // Prevent default action
    event.preventDefault();

    dragOverItemId = null;

    // If dropped on itself, do nothing
    if (draggedItemId === targetItemId) return;

    // Check if target is a completed item (don't allow dropping on completed items)
    const targetItem = list.items.find(item => item.id === targetItemId);
    if (targetItem?.checked) return;

    // Haptic feedback - stronger for successful drop
    // Haptic feedback - stronger for successful drop
    hapticService.impact('heavy');

    // Reorder items
    const reorderedItems = [...list.items];
    const sourceIndex = reorderedItems.findIndex(item => item.id === draggedItemId);
    const targetIndex = reorderedItems.findIndex(item => item.id === targetItemId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      // Remove the item from the source position
      const [movedItem] = reorderedItems.splice(sourceIndex, 1);

      // Insert the item at the target position
      reorderedItems.splice(targetIndex, 0, movedItem);

      // Update the list with the new order
      listsService.reorderItems(reorderedItems);
    }
  }
  
  // Handle item toggle with sparkle animation
  function toggleItem(itemId) {
    const itemToToggle = list.items.find(item => item.id === itemId);

    // Apply haptic feedback
    if (itemToToggle) {
      hapticService.impact(itemToToggle.checked ? 'light' : 'medium');
    }

    // Toggle the item state
    listsService.toggleItem(itemId, list.id);

    // If checking the item (not unchecking), add sparkle animation
    if (!itemToToggle?.checked) {
      // Add sparkle animation after a small delay
      setTimeout(() => {
        const checkbox = document.getElementById(`item-${list.id}-${itemId}`);
        if (checkbox) {
          // Force reflow to restart animation
          void checkbox.offsetWidth;

          // Check if we've completed all items
          const allCompleted = list.items.length > 1 &&
            list.items.filter(i => i.id !== itemId).every(i => i.checked);

          // If this completes the list, trigger haptic feedback but no message
          if (allCompleted) {
            hapticService.notification('success');
          }
        }
      }, 50);
    }
  }


  function startEditingItem(item) {
    if (item.checked) return;
    editingItemId = item.id;
    editedItemText = item.text;
  }

  function saveItemEdit() {
    if (editingItemId !== null && editedItemText.trim() !== '') {
      listsService.editItem(editingItemId, editedItemText, list.id);
      editingItemId = null;
      editedItemText = '';
    } else if (editedItemText.trim() === '') {
      // If empty, remove the item
      listsService.removeItem(editingItemId, list.id);
      editingItemId = null;
    }
  }

  function cancelItemEdit() {
    editingItemId = null;
    editedItemText = '';
  }

  function handleEditItemKeyDown(event) {
    if (event.key === 'Enter') {
      saveItemEdit();
    } else if (event.key === 'Escape') {
      cancelItemEdit();
    }
  }
</script>

<div class="zl-card">
  <div class="card-content">
    <!-- List header with share button -->
    <!-- Header removed as per request -->
    
    <!-- List Items -->
    <div class="zl-list-container" style="position: relative; min-height: {list.items.length > 0 ? 100 + (list.items.length * 90) : 320}px;">
      {#if list.items.length > 0}
        <ul class="zl-list" role="list" in:fade={{ duration: 200 }}>
          {#each sortedItems as item, index (item.id)}
            <li
              class="zl-item {item.checked ? 'checked' : ''} {editingItemId === item.id ? 'editing' : ''}"
              class:dragging={draggedItemId === item.id}
              class:drag-over={dragOverItemId === item.id}
              draggable={!item.checked && editingItemId !== item.id}
              on:dragstart|passive={(e) => handleDragStart(e, item.id)}
              on:dragend|passive={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
              animate:flip={{ duration: 300 }}
              in:fly={{ y: 20, duration: 300, delay: getStaggerDelay(index) }}
              out:fly={{ y: -20, duration: 300 }}
              aria-grabbed={draggedItemId === item.id ? 'true' : 'false'}
              aria-dropeffect="move"
              role="listitem"
            >
              {#if dragOverItemId === item.id}
                <div class="drop-indicator">
                  <div class="drop-arrow"></div>
                </div>
              {/if}

              <label class="zl-checkbox-wrapper">
                <input
                  type="checkbox"
                  id="item-{list.id}-{item.id}"
                  checked={item.checked}
                  on:change={() => listsService.toggleItem(item.id, list.id)}
                  class="zl-checkbox"
                />
                <span class="zl-checkbox-custom {item.checked ? 'animate-pop' : ''}"></span>
              </label>

              <div class="edit-wrapper">
                {#if editingItemId === item.id}
                  <input
                    id="edit-item-{list.id}-{item.id}"
                    class="zl-edit-input"
                    placeholder="Enter item text..."
                    bind:value={editedItemText}
                    on:blur={saveItemEdit}
                    on:keydown={handleEditItemKeyDown}
                    transition:fade={{ duration: 150 }}
                    use:autoFocus
                  />
                {:else}
                  <button
                    type="button"
                    class="zl-item-text-button {item.checked ? 'checked' : ''}"
                    on:click|stopPropagation={() => {
                      if (!item.checked) startEditingItem(item);
                    }}
                    on:keydown={(e) => e.key === 'Enter' && !item.checked && startEditingItem(item)}
                    disabled={item.checked}
                    aria-label="Edit item: {item.text}"
                  >
                    <span class="zl-item-text {item.checked ? 'checked' : ''}">
                      {formatItemText(item.text)}
                    </span>
                  </button>
                {/if}
              </div>

                {#if !item.checked && editingItemId !== item.id}
                  <div class="grab-indicator" aria-hidden="true" title="Drag to reorder">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                {/if}

                <button 
                  type="button" 
                  class="delete-button" 
                  on:click|stopPropagation={() => listsService.removeItem(item.id, list.id)}
                  title="Delete item"
                  aria-label="Delete item: {item.text}"
                >
                  <span class="delete-icon">×</span>
                </button>
            </li>
          {/each}
        </ul>
      {:else}
        <div 
          class="zl-empty-state" 
          on:click={handleEmptyStateClick}
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleEmptyStateClick();
            }
          }}
          role="button"
          tabindex="0"
          class:isCreatingNewItem={isCreatingNewItem}
        >
          <div class="zl-empty-content">
            <p class="zl-empty-title">Ready.</p>
            <p class="zl-empty-description">Tap to start.</p>
            <p class="zl-empty-hint">or click to type</p>
          </div>
          
          {#if isCreatingNewItem}
            <div 
              class="zl-new-item-container" 
              transition:fade={{ duration: 150 }}
              use:clickOutside={{ 
                enabled: isCreatingNewItem, 
                callback: () => {
                  newItemText = '';
                  isCreatingNewItem = false;
                }
              }}
            >
              <input 
                type="text" 
                class="zl-new-item-input" 
                placeholder="Type your item here..." 
                bind:value={newItemText}
                on:keydown={async (e) => {
                  if (e.key === 'Enter') {
                    if (newItemText.trim()) {
                      listsService.addItem(newItemText, list.id);
                      newItemText = '';
                      isCreatingNewItem = false;
                      
                      // Provide haptic feedback
                      hapticService.light();
                      
                      // Wait for DOM update then focus the new item to edit it immediately
                      await tick();
                      
                      // Find the newly added item (it will be the last one in active items)
                      // We need to get the latest list state
                      const currentItems = list.items.filter(i => !i.checked);
                      if (currentItems.length > 0) {
                        // The newest item usually has the highest ID or is last in the list
                        // Assuming it's the last one added
                        const newItem = currentItems[currentItems.length - 1];
                        startEditingItem(newItem);
                      }
                    } else {
                      isCreatingNewItem = false;
                    }
                  } else if (e.key === 'Escape') {
                    newItemText = '';
                    isCreatingNewItem = false;
                  }
                }}
                use:autoFocus
                on:click|stopPropagation={() => {}}
              />
              <div class="zl-new-item-hint">Press Enter to add, Escape to cancel, or click outside</div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ========================================
     1. ANIMATION KEYFRAMES
     ======================================== */
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
    50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  @keyframes check-pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  .animate-pop {
    animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  
  @keyframes soft-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  
  @keyframes pulse {
    0%, 100% { 
      transform: scale(1); 
      box-shadow: 0 0 15px rgba(236, 158, 255, 0.2);
    }
    50% { 
      transform: scale(1.02); 
      box-shadow: 0 0 20px rgba(236, 158, 255, 0.3);
    }
  }
  
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  /**
   * Keyframes for the `gradient-shift` animation.
   * 
   * This animation moves the oversized background gradient by changing its position,
   * creating a flowing, shifting effect. The positions form a smooth path that:
   * 1. Starts at the top-left (0%, 0%)
   * 2. Moves toward the center (50%, 50%)
   * 3. Continues to the bottom-right (100%, 100%)
   * 4. Returns toward the center (50%, 50%)
   * 5. Finally returns to the start for a seamless loop
   * 
   * This carefully crafted path creates a gentle, natural-looking motion that
   * enhances the "pillowy" feel of the card without being distracting.
   */
  @keyframes gradient-shift {
    0% { background-position: 0% 0%; }
    25% { background-position: 50% 50%; }
    50% { background-position: 100% 100%; }
    75% { background-position: 50% 50%; }
    100% { background-position: 0% 0%; }
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  
  
  /**
   * Card styling with animated gradient background.
   * 
   * The .zl-card element features a soft, peachy gradient that subtly
   * animates in the background, enhanced with a "chonky" feel through
   * generous border-radius, padding, and drop shadow.
   */
  .zl-card {
    /* Core shape and structure */
    border-radius: var(--zl-card-border-radius); /* Pillowy, rounded corners */
    border: var(--zl-card-border-width) solid var(--zl-card-border-color);
    padding: 2.5rem; /* Generous padding for content */
    position: relative;
    overflow: hidden;
    
    /* Size and positioning */
    width: 100%;
    max-width: 600px; /* Balanced width for desktop */
    margin: 0 auto;
    margin-top: 2rem;
    margin-bottom: 2.5rem;
    height: auto;
    
    /* Typography */
    font-family: 'Space Mono', monospace;
    
    /* Transitions */
    transition: var(--zl-transition-standard);
    
    /* Shadow for depth */
    box-shadow: var(--zl-card-box-shadow);
    
    /**
     * ANIMATED GRADIENT BACKGROUND:
     * 
     * 1. The linear-gradient creates a smooth blend of three colors
     *    at the angle specified by the custom property.
     * 
     * 2. The background-size is set to 300% 300%, making the gradient
     *    much larger than the actual element. This is essential for
     *    the animation effect, as it allows different portions of the
     *    gradient to be visible as the background-position changes.
     * 
     * 3. The animation applies the gradient-shift keyframes over the
     *    specified duration, using ease timing for smooth movement,
     *    and repeating infinitely for a continuous effect.
     */
    /* Distinct background with jazzxy tones */
    background: linear-gradient(135deg, #FFFDF5 0%, #fff5f7 100%);
    border: 2px solid rgba(255, 176, 0, 0.15);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
  
  .zl-card:hover {
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 30px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.25);
    transform: translateY(-2px);
    background: linear-gradient(135deg, #ffffff 60%, #ffe4e6 100%); /* White to Rose */
    border-color: #fda4af; /* Rose-300 */
  }

  /* Media query for mobile responsiveness */
  /* ========================================
     8. RESPONSIVE ADJUSTMENTS
     ======================================== */
     
  @media (max-width: 480px) {
    .zl-card {
      padding: 2rem 1rem; /* Reduced side padding on mobile */
      border-radius: 24px; /* Slightly smaller radius on mobile */
      max-width: 100%; /* Full width on mobile */
    }

    .zl-item {
      border-radius: 16px; /* Slightly smaller radius on mobile */
      padding: 16px 14px; /* Slightly reduced padding for mobile to optimize space */
    }

    .zl-list {
      gap: 20px; /* Maintain or slightly increase gap for touch on mobile */
    }

    .zl-item-text {
      font-size: 1.1rem; /* Slightly larger text on mobile for readability */
    }

    .edit-wrapper {
      width: calc(100% - 32px - 32px - 1.75rem); /* Adjusted calculation for mobile padding */
    }

    .zl-edit-input {
      padding: 0.75rem 1rem; /* Slightly reduced padding on mobile */
    }
  }
  
  /* ========================================
     2. CARD STYLING
     ======================================== */
     
  /* Subtle inner border effect */
  .zl-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 28px;
    padding: 2px;
    background: var(--zl-card-inner-border-gradient);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: destination-out;
    mask-composite: exclude;
    pointer-events: none;
    z-index: 1;
    opacity: 0.7;
  }
  
  /* Subtle light effect in the corner */
  .zl-card::after {
    content: '';
    position: absolute;
    top: -50px;
    left: -50px;
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(var(--zl-primary-color-rgb, 255, 171, 119), 0.3) 0%, rgba(var(--zl-primary-color-rgb, 255, 171, 119), 0) 70%);
    border-radius: 50%;
    opacity: 0.5;
    pointer-events: none;
    animation: soft-pulse 8s infinite alternate ease-in-out;
  }

  /* Hide soft glow for neo-brutalist mode */
  :global(html.mode-neo-brutalist) .zl-card::after {
    display: none;
  }
  
  /* Hide inner border for neo-brutalist mode */
  :global(html.mode-neo-brutalist) .zl-card::before {
    display: none;
  }
  
  /* Card content container */
  .card-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    min-height: 320px;
    overflow: hidden;
  }
  
  /* ========================================
     3. LIST STRUCTURE
     ======================================== */
     
  /* List container */
  .zl-list-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  
  .zl-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--zl-spacing-m); /* Increased from 14px to 20px for more "chonky" separation */
    margin-bottom: var(--zl-spacing-m);
    position: relative;
    /* Optimize rendering with content-visibility */
    content-visibility: auto;
    contain-intrinsic-size: auto 400px; /* Approximate list height */
  }
  
  /* ========================================
     4. LIST ITEMS & INTERACTION STATES
     ======================================== */
     
  /**
   * Individual list items
   * 
   * Styled using CSS variables for easy theming. The default appearance is a light
   * card with subtle shadows and borders that react to hover and interaction states.
   */
  .zl-item {
    /* Base appearance */
    border-radius: var(--zl-item-border-radius, 20px);
    background: var(--zl-item-bg, rgba(255, 255, 255, 0.5));
    padding: var(--zl-spacing-s) var(--zl-spacing-s); /* Adjusted to 16px horizontal padding to avoid excessive text wrapping */
    
    /* Structural layout */
    display: flex;
    align-items: flex-start; /* Allow items to expand vertically */
    gap: 1.25rem; /* Space between elements */
    justify-content: space-between;
    
    /* Sizing */
    min-height: 80px; /* Minimum height for consistent sizing */
    height: auto; /* Allow height to grow with content */
    max-height: none; /* Remove any max height constraints */
    
    /* Visual effects */
    box-shadow: var(--zl-item-box-shadow, 0 4px 10px rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.1));
    border: 2px solid var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
    border-left: 4px solid var(--zl-item-border-color, rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.3));
    
    /* Interaction */
    position: relative;
    cursor: grab;
    transition: var(--zl-transition-standard);
  }

  /* Performance optimization - only add will-change to draggable items */
  .zl-item:not(.checked):not(.editing) {
    /* Use transform and opacity for better GPU acceleration */
    will-change: transform, opacity;
  }
  
  /* Remove will-change during inactivity to save resources */
  @media (prefers-reduced-motion) {
    .zl-item:not(:hover):not(.dragging):not(.drag-over) {
      will-change: auto;
    }
  }

  /* Change cursor for items being edited */
  .zl-item:has(.zl-edit-input),
  .zl-item.editing {
    cursor: default;
  }

  /* Hover state - elevate and highlight the item */
  .zl-item:hover {
    background: var(--zl-item-hover-bg, rgba(255, 255, 255, 0.8));
    transform: translateY(-3px);
    box-shadow: var(--zl-item-hover-box-shadow, 0 8px 20px rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.2));
    border-left: 4px solid var(--zl-item-border-hover-color, rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.7));
    border-color: var(--zl-item-border-hover-color, rgba(255, 212, 218, 0.9));
  }

  /* Neo-brutalist specific hover */
  :global(html.mode-neo-brutalist) .zl-item:hover {
    transform: translate(-4px, -4px);
    box-shadow: 8px 8px 0px 0px #000000;
  }

  /* Neo-brutalist active state (click) */
  :global(html.mode-neo-brutalist) .zl-item:active {
    transform: translate(0px, 0px);
    box-shadow: 4px 4px 0px 0px #000000;
    transition: all 0.1s;
  }
  
  .zl-item::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 60%;
    height: 100%;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 235, 246, 0.3) 100%);
    border-radius: 0 18px 18px 0;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  
  .zl-item:hover::after {
    opacity: 1;
  }
  
  /**
   * Checked (completed) item styling
   * 
   * Reduces visual prominence with decreased opacity, scale, and shadow
   * while maintaining the theme connection through border and background
   */
  .zl-item.checked {
    opacity: var(--zl-item-checked-opacity, 0.75);
    background: var(--zl-item-checked-bg, rgba(245, 240, 250, 0.4));
    border-left: 4px solid var(--zl-item-checked-border-color, rgba(201, 120, 255, 0.2));
    transform: scale(0.98);
    box-shadow: 0 2px 6px rgba(0, 151, 167, 0.05);
    border-color: var(--zl-item-checked-border-color, rgba(255, 212, 218, 0.4));
  }
  
  /**
   * Item text styling
   * 
   * Controls the appearance of text within list items, including size,
   * weight, color, and spacing - all themeable through CSS variables
   */
  .zl-item-text {
    /* Typography */
    font-size: 1.1rem;
    font-weight: 800;
    line-height: 1.5;
    color: var(--zl-text-color-primary);
    font-family: 'Space Mono', monospace;
    letter-spacing: 0.8px;
    
    /* Layout and wrapping */
    box-sizing: border-box;
    display: inline-block;
    width: 100%;
    text-align: left;
    position: relative;
    vertical-align: middle;
    padding: 6px 0; /* Vertical spacing */
    min-height: 32px; /* Match checkbox height for vertical alignment */
    
    /* Text wrapping for long content */
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto; /* Enable hyphenation for better text breaks */
    
    /* Animation - use GPU-accelerated properties only */
    transition: var(--zl-transition-fast);
    will-change: transform, color;
  }

  /**
   * Hover state for unchecked item text
   * 
   * Provides visual feedback when hovering over editable text with color
   * change, subtle glow, and slight elevation
   */
  /* Simplified selector for better performance */
  .zl-item-text-button:hover .zl-item-text:not(.checked) {
    color: var(--zl-text-hover-color, #c978ff);
    text-shadow: 0 0 8px rgba(0, 151, 167, 0.3);
    transform: translateY(-1px) scale(1.01);
  }

  /**
   * Checked text styling
   * 
   * Visually indicates completion with a themed strikethrough and muted color
   */
  .zl-item-text.checked {
    text-decoration: line-through var(--zl-primary-color, rgba(201, 120, 255, 0.5)) 1.5px;
    color: var(--zl-text-color-disabled, #9d9d9d);
  }

  /* Text button styling */
  .zl-item-text-button {
    background: transparent;
    border: none;
    padding: 5px 8px; /* Increased padding for better touch target */
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: flex-start; /* Align at the top for long content */
    width: 100%; /* Ensure button takes up full width of container */
    border-radius: 8px; /* Increased from 6px for softer corners */
    transition: all 0.2s ease;
    margin-right: auto;
    position: relative;
    min-height: 36px; /* Minimum height for the button */
    height: auto; /* Allow height to expand with content */
    align-self: stretch; /* Stretch to match container height */
    flex-wrap: wrap; /* Allow wrapping of text content */
  }

  .zl-item-text-button:hover:not(:disabled),
  .zl-item-text-button:focus-visible:not(:disabled) {
    background: linear-gradient(135deg, rgba(252, 235, 246, 0.7), rgba(255, 242, 253, 0.9));
    outline: none;
    border-radius: 12px;
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.2);
    transform: translateY(-1px);
  }

  /* Pencil icon removed as requested */

  /* Enhanced sparkle effect on hover */
  .zl-item-text-button:hover:not(:disabled)::before {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    background-image:
      radial-gradient(circle at 20% 30%, rgba(255, 186, 255, 0.9) 0%, rgba(255, 186, 255, 0) 15%),
      radial-gradient(circle at 80% 20%, rgba(255, 186, 255, 0.9) 0%, rgba(255, 186, 255, 0) 15%),
      radial-gradient(circle at 40% 70%, rgba(255, 186, 255, 0.7) 0%, rgba(255, 186, 255, 0) 10%);
    background-size: 100% 100%;
    opacity: 0;
    z-index: 1;
    border-radius: 8px;
    animation: sparkleIn 0.5s forwards ease-out;
    pointer-events: none;
    mix-blend-mode: screen;
  }

  /* We can replace these with our more flexible animations using CSS variables */

  .zl-item-text-button:focus-visible:not(:disabled) {
    box-shadow: 0 0 0 2px rgba(201, 120, 255, 0.3);
  }

  .zl-item-text-button:disabled {
    cursor: default;
  }
  
  /* ========================================
     5. INTERACTIVE ELEMENTS (CHECKBOXES, BUTTONS)
     ======================================== */
     
  /**
   * Custom checkbox styling
   * 
   * Creates a visually appealing, themeable custom checkbox that
   * animates on interaction and shows a sparkle effect when checked
   */
  .zl-checkbox-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 4px; /* Added padding to increase touch target */
    align-self: center; /* Center vertically in the list item */
  }

  /* Hide the actual checkbox input while keeping it accessible */
  .zl-checkbox {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  /**
   * Custom checkbox visual element
   * 
   * The visual representation of the checkbox that users see and interact with,
   * fully customizable through CSS variables
   */
  .zl-checkbox-custom {
    position: relative;
    display: inline-block;
    width: var(--zl-checkbox-size, 32px);
    height: var(--zl-checkbox-size, 32px);
    border: var(--zl-checkbox-border, 2px solid rgba(201, 120, 255, 0.5));
    border-radius: var(--zl-checkbox-border-radius, 12px);
    background-color: var(--zl-checkbox-bg, rgba(255, 255, 255, 0.8));
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: var(--zl-checkbox-shadow, 0 3px 7px rgba(0, 151, 167, 0.15));
  }
  
  /* Hover state for the checkbox */
  .zl-checkbox-wrapper:hover .zl-checkbox-custom {
    border: var(--zl-checkbox-hover-border, 2px solid rgba(0, 188, 212, 0.7));
    background-color: var(--zl-checkbox-hover-bg, rgba(255, 245, 250, 0.8));
    transform: scale(1.1);
    box-shadow: var(--zl-checkbox-hover-shadow, 0 3px 8px rgba(0, 151, 167, 0.15));
  }
  
  /**
   * Checked state styling
   * 
   * Changes the appearance when checked with a gradient background
   * that uses theme colors defined in CSS variables
   */
  .zl-checkbox:checked + .zl-checkbox-custom {
    background: linear-gradient(145deg, 
      var(--zl-checkbox-checked-gradient-start, #4dd0e1) 0%, 
      var(--zl-checkbox-checked-gradient-end, #0097a7) 100%);
    border-color: transparent;
    box-shadow: var(--zl-checkbox-checked-shadow, 0 3px 8px rgba(0, 151, 167, 0.2));
  }
  
  /**
   * Sparkle effect when checkbox is checked
   * 
   * Creates a radiating glow effect that provides visual feedback
   * when an item is marked as complete
   */
  .zl-checkbox:checked + .zl-checkbox-custom::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: radial-gradient(circle, 
      var(--zl-checkbox-sparkle-color, rgba(255, 255, 255, 0.8)) 0%, 
      rgba(255, 255, 255, 0) 70%);
    --sparkle-opacity-start: 0;
    --sparkle-scale-start: 0;
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    animation: sparkle 0.5s var(--zl-transition-easing-bounce) forwards;
    z-index: 5;
  }
  
  /* ========================================
     6. EMPTY STATE
     ======================================== */
     
  /* Friendly minimalist empty state */  
  .zl-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 5rem 1.5rem;
    height: 320px; /* Fixed height instead of min-height */
    width: 100%;
    box-sizing: border-box;
    background: #f9fafb; /* Light gray background */
    border: 4px dashed #d1d5db; /* Thicker dashed border */
    border-radius: 24px;
    margin: 1.5rem 0;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    cursor: pointer;
  }
  
  .zl-empty-state:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
    transform: scale(1.02);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  }


  .zl-empty-state:active {
    transform: scale(0.98);
  }

  .zl-empty-state.isCreatingNewItem {
    cursor: default;
    background-color: var(--zl-item-bg);
  }
  
  .zl-empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1;
    opacity: 1;
    transition: opacity 0.2s ease;
  }
  
  .isCreatingNewItem .zl-empty-content {
    opacity: 0;
    pointer-events: none;
  }

  .zl-new-item-container {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .zl-new-item-input {
    width: 100%;
    padding: 1rem 1.5rem;
    border-radius: 18px;
    border: 2px solid rgba(201, 120, 255, 0.4);
    background: white;
    font-family: 'Space Mono', monospace;
    font-size: 1.1rem;
    color: #333;
    outline: none;
    transition: all 0.2s ease;
  }

  .zl-new-item-input:focus {
    border-color: rgba(201, 120, 255, 0.7);
    box-shadow: 0 0 0 3px rgba(201, 120, 255, 0.1);
  }

  .zl-new-item-hint {
    font-size: 0.9rem;
    color: #666;
    margin-top: 0.8rem;
    font-family: 'Space Mono', monospace;
  }
  
  .zl-empty-title {
    font-weight: 800;
    color: #333; /* Dark color for better contrast */
    margin-bottom: 1.5rem;
    font-size: 2.2rem;
    font-family: 'Space Mono', monospace;
    letter-spacing: 0.8px;
  }
  
  .zl-empty-description {
    color: var(--zl-text-color-secondary);
    font-size: 1.3rem;
    font-family: 'Space Mono', monospace;
    line-height: 1.5;
    letter-spacing: 0.5px;
    font-weight: 600;
    margin-bottom: 0.3rem;
  }
  
  .zl-empty-hint {
    color: var(--zl-text-color-secondary);
    font-size: 1.1rem;
    font-family: 'Space Mono', monospace;
    font-weight: 400;
    letter-spacing: 0.4px;
  }
  
  
  /* Edit wrapper container */
  .edit-wrapper {
    flex: 1;
    position: relative;
    min-height: 60px; /* Match input height */
    margin-right: auto;
    display: flex;
    align-items: center;
    padding-top: 0;
    align-self: stretch;
    width: auto; /* Let flex handle width */
  }

  /* Input fields - enhanced for "chonky" feel to match list items */
  .zl-edit-input {
    font-family: 'Space Mono', monospace;
    font-weight: 800;
    border: 2px solid rgba(201, 120, 255, 0.3);
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 16px; /* Increased from 12px to match list items */
    padding: 0.75rem 1.25rem; /* Increased for more space and to match list items */
    outline: none;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    color: #444444;
    width: 100%;
    font-size: 1.1rem;
    letter-spacing: 0.8px;
    box-sizing: border-box;
    line-height: 1.5;
    margin: 0;
    min-height: 60px; /* Increased from 44px to match list item height */
    height: 60px; /* Set same as min-height for consistency */
    text-align: left;
    display: flex;
    align-items: center;
  }
  
  /* Specific edit input styling */
  .zl-edit-input {
    position: relative;
    top: auto;
    left: auto;
    transform: none;
    width: 100%;
    max-width: none;
  }

  .zl-edit-input::placeholder {
    color: #aaaaaa;
  }

  .zl-edit-input:focus {
    border-color: rgba(201, 120, 255, 0.6);
    box-shadow: 0 0 0 3px rgba(201, 120, 255, 0.1);
    background-color: rgba(255, 255, 255, 0.95);
  }
  
  
  
  /* ========================================
     7. DRAG AND DROP INTERACTIONS
     ======================================== */
     
  /**
   * DRAG AND DROP STYLING
   *
   * Styles for drag and drop interactions that provide clear visual feedback
   * to users when moving items or hovering over drop targets.
   */
  /**
   * Float animation with slight rotation
   * 
   * Used for: dragged items, hover effects
   * Adds subtle movement and rotation for a more organic feel
   */
  @keyframes float {
    0%, 100% { 
      transform: translateY(var(--float-y-min, 0)) rotate(var(--float-rotate-min, -0.5deg)); 
    }
    50% { 
      transform: translateY(var(--float-y-max, -3px)) rotate(var(--float-rotate-max, 0.5deg)); 
    }
  }

  /**
   * Border color pulse animation
   * 
   * Used for: focus indicators, highlighting important elements
   * Pulses between standard and highlighted border colors
   */
  @keyframes pulse-border {
    0%, 100% { 
      border-color: var(--pulse-border-color-min, var(--zl-item-border-color, rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.6))); 
    }
    50% { 
      border-color: var(--pulse-border-color-max, var(--zl-item-border-hover-color, rgba(var(--zl-primary-color-rgb, 201, 120, 255), 1))); 
    }
  }

  /**
   * Item being dragged styling
   * 
   * Enhances visibility and provides motion feedback during drag operations
   */
  .zl-item.dragging {
    opacity: 1; /* Fully opaque for better visibility */
    background-color: var(--zl-item-dragging-bg, rgba(255, 255, 255, 1));
    transform: scale(1.03);
    box-shadow: var(--zl-item-dragging-shadow, 0 15px 30px rgba(var(--zl-accent-color-rgb, 0, 151, 167), 0.4));
    z-index: 10;
    border: var(--zl-item-dragging-border, 3px solid rgba(var(--zl-accent-color-rgb, 0, 188, 212), 0.85));
    --float-y-min: 0;
    --float-y-max: -3px;
    --float-rotate-min: -0.5deg;
    --float-rotate-max: 0.5deg;
    animation: float 2s infinite ease-in-out;
    cursor: grabbing;
    will-change: transform, opacity, border;
  }

  /**
   * Item being hovered over as a drop target
   * 
   * Indicates where the dragged item will be placed when dropped
   */
  .zl-item.drag-over {
    position: relative;
    margin-top: 20px; /* Creates space for the item to fit */
    background-color: var(--zl-item-dragover-bg, rgba(252, 242, 255, 0.9));
    border: var(--zl-item-dragover-border, 2px solid rgba(0, 188, 212, 0.8));
    box-shadow: var(--zl-item-dragover-shadow, 0 8px 20px rgba(0, 151, 167, 0.3));
    transform: translateY(2px); /* Subtle shift to indicate item movement */
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); /* Springy transition */
  }

  /**
   * Drop indicator line
   * 
   * Horizontal indicator that shows where an item will be inserted
   */
  .drop-indicator {
    position: absolute;
    top: -12px;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, transparent, var(--zl-drop-indicator-color, rgba(0, 188, 212, 0.7)), transparent);
    border-radius: 2px;
    animation: pulse-opacity 1.5s infinite ease-in-out;
    z-index: 5;
    pointer-events: none;
  }

  /**
   * Drop target arrow
   * 
   * Small arrow that points to the exact insertion point when dragging
   */
  .drop-arrow {
    position: absolute;
    top: -6px;
    left: 50%;
    width: 14px;
    height: 14px;
    background-color: var(--zl-drop-arrow-bg, rgba(0, 188, 212, 0.9));
    border-radius: 50%;
    transform: translateX(-50%);
    box-shadow: var(--zl-drop-arrow-shadow, 0 0 8px rgba(0, 151, 167, 0.4));
    animation: pulse-glow 1.5s infinite ease-in-out;
  }

  /* Arrow down indicator using a rotated square */
  .drop-arrow::after {
    content: '';
    position: absolute;
    top: 4px;
    left: 3px;
    width: 8px;
    height: 8px;
    border-right: 2px solid white;
    border-bottom: 2px solid white;
    transform: rotate(45deg);
  }

  /**
   * Specific pulse-opacity animation instance
   * Already covered by our generic pulse-opacity above
   * Keeping name for clarity in existing code
   */
  @keyframes pulse-opacity {
    0%, 100% { opacity: var(--pulse-opacity-min, 0.5); }
    50% { opacity: var(--pulse-opacity-max, 1); }
  }

  /**
   * Box shadow pulse animation
   * 
   * Used for: focus effects, attention grabbers
   * Pulses box shadow intensity for a glowing effect
   */
  @keyframes pulse-glow {
    0%, 100% { 
      box-shadow: 0 0 8px rgba(var(--zl-primary-color-rgb, 201, 120, 255), var(--pulse-glow-opacity-min, 0.4)); 
    }
    50% { 
      box-shadow: 0 0 12px rgba(var(--zl-primary-color-rgb, 201, 120, 255), var(--pulse-glow-opacity-max, 0.7)); 
    }
  }

  /**
   * Grab handle indicator
   *
   * Visual element indicating an item can be dragged, with three horizontal lines
   * that react to hover states and maintain proper touch target sizing.
   */
  .grab-indicator {
    display: flex;
    flex-direction: column;
    gap: 4px; /* Spacing between lines */
    margin-right: 12px; /* Maintain side margin */
    opacity: var(--zl-grab-handle-opacity, 0.6);
    transition: all 0.25s ease;
    padding: 8px 8px; /* Increased padding to ensure 32px touch target */
    min-width: 32px; /* Ensures minimum width for touch target */
    min-height: 32px; /* Ensures minimum height for touch target */
    justify-content: center; /* Center lines vertically */
    align-self: center; /* Center vertically in list item regardless of text wrap */
    cursor: grab; /* Explicit grab cursor on the handle */
    position: relative;
  }

  /* Individual grab handle lines */
  .grab-indicator span {
    width: 16px; /* Slightly smaller than original 18px */
    height: 2.5px; /* Slightly smaller than original 3px */
    background-color: var(--zl-grab-handle-color, rgba(0, 188, 212, 0.8));
    border-radius: 2px;
    transition: transform 0.2s ease, width 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  }

  /* Hover state for the grab handle */
  .zl-item:hover .grab-indicator {
    opacity: var(--zl-grab-handle-hover-opacity, 1);
    transform: scale(1.1); /* Subtle scale effect on hover */
  }

  /* Enhanced visibility of grab handle lines on hover */
  .zl-item:hover .grab-indicator span {
    background-color: var(--zl-grab-handle-color, rgba(0, 188, 212, 1)); 
    box-shadow: 0 1px 3px rgba(0, 151, 167, 0.3); /* Subtle glow */
  }
  
  /**
   * Delete button styling
   *
   * Small circular button that appears on hover to allow item deletion,
   * with appropriate transitions and hover effects.
   */
  .delete-button {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--zl-delete-button-bg, rgba(255, 255, 255, 0.8));
    border: var(--zl-delete-button-border, 1px solid rgba(0, 188, 212, 0.4));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0; /* Hidden until item is hovered */
    transform: scale(0.8);
    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 10;
    box-shadow: 0 2px 5px rgba(0, 151, 167, 0.15);
  }
  
  /* X icon inside delete button */
  .delete-icon {
    font-size: 18px;
    line-height: 1;
    color: var(--zl-delete-button-text-color, rgba(0, 188, 212, 0.9));
    font-weight: bold;
  }
  
  /* Show delete button when list item is hovered */
  .zl-item:hover .delete-button {
    opacity: 1;
    transform: scale(1);
  }
  
  /* Delete button hover state */
  .delete-button:hover {
    background: var(--zl-delete-button-hover-bg, rgba(255, 225, 240, 0.95));
    border-color: var(--zl-delete-button-hover-border, rgba(0, 188, 212, 0.8));
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(0, 151, 167, 0.3);
  }
  
  /* Delete button active state (when clicked) */
  .delete-button:active {
    transform: scale(0.9);
    background: rgba(255, 200, 230, 1);
  }
  
  /**
   * List header and share button styles
   *
   * Styles for the list header with title and share button,
   * maintaining the theme system for consistency
   */
  .zl-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px dashed var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
  }
  
  .zl-list-title {
    font-family: 'Space Mono', monospace;
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--zl-text-color-primary, #444444);
    margin: 0;
    padding: 0;
    letter-spacing: 1px;
  }
  
  .zl-list-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .zl-share-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, 
      var(--zl-checkbox-checked-gradient-start, #e9a8ff) 0%, 
      var(--zl-checkbox-checked-gradient-end, #c978ff) 100%);
    border: none;
    border-radius: 16px;
    padding: 0.5rem 1rem;
    color: white;
    font-family: 'Space Mono', monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: var(--zl-checkbox-checked-shadow, 0 3px 8px rgba(201, 120, 255, 0.2));
  }
  
  .zl-share-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(201, 120, 255, 0.3);
  }
  
  .zl-share-button:active {
    transform: translateY(1px);
  }
  
  .share-icon {
    font-size: 1.2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  
  @media (max-width: 480px) {
    .zl-list-title {
      font-size: 1.3rem;
    }
    
    .share-text {
      display: none; /* Hide text on small screens */
    }
    
    .zl-share-button {
      padding: 0.5rem;
    }
  }
  
  /* Share notification styles */
  .zl-share-notification {
    background: white;
    border-radius: 16px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    text-align: center;
    font-family: 'Space Mono', monospace;
    font-size: 0.9rem;
    box-shadow: 0 3px 10px rgba(201, 120, 255, 0.15);
    position: relative;
  }
  
  .zl-share-notification.success {
    background: linear-gradient(135deg, rgba(240, 255, 240, 1), rgba(220, 255, 230, 1));
    border: 1px solid rgba(100, 200, 100, 0.3);
    color: #2c7b2c;
  }
  
  .zl-share-notification.error {
    background: linear-gradient(135deg, rgba(255, 240, 240, 1), rgba(255, 220, 220, 1));
    border: 1px solid rgba(200, 100, 100, 0.3);
    color: #7b2c2c;
  }
</style>