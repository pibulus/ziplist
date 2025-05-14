<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { listsStore, activeList } from '$lib/services/lists/listsStore';
  import { listsService } from '$lib/services/lists/listsService';
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  
  // State variables
  let list = { name: '', items: [] };
  let draggedItemId = null;
  let dragOverItemId = null;
  let editingItemId = null;
  let editedItemText = '';
  let isCreatingNewItem = false;
  let newItemText = '';
  
  // Subscribe to the active list
  const unsubscribe = activeList.subscribe(activeListData => {
    if (activeListData) {
      list = activeListData;
    }
  });

  onMount(() => {
    // Initialize the lists store
    listsStore.initialize();
    listsService.getAllLists();
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });
  
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
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  function handleDragEnd(event) {
    // Remove styling
    draggedItemId = null;
    dragOverItemId = null;

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([20, 30, 20]);
    }
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
    if (navigator.vibrate) {
      navigator.vibrate(15); // Very subtle pulse
    }
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
    if (navigator.vibrate) {
      navigator.vibrate(80);
    }

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
    if (itemToToggle && navigator.vibrate) {
      navigator.vibrate(itemToToggle.checked ? 20 : [20, 30, 20]);
    }

    // Toggle the item state
    listsService.toggleItem(itemId);

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
          if (allCompleted && navigator.vibrate) {
            navigator.vibrate([30, 50, 30, 50, 30]);
          }
        }
      }, 50);
    }
  }


  // Item editing functions
  function startEditingItem(item) {
    // Don't start editing checked items
    if (item.checked) return;

    editingItemId = item.id;
    editedItemText = item.text;

    // No need for manual focus with the autoFocus action
  }

  function saveItemEdit() {
    if (editedItemText.trim() && editingItemId !== null) {
      // Process text for capitalization but store original
      listsService.editItem(editingItemId, editedItemText.trim());
      cancelItemEdit();
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
              <!-- Drop indicator visible when item is a drop target -->
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
                  on:change={() => toggleItem(item.id)}
                  class="zl-checkbox"
                />
                <span class="zl-checkbox-custom"></span>
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

                <!-- Enhanced drag handle indicator -->
                {#if !item.checked && editingItemId !== item.id}
                  <div class="grab-indicator" aria-hidden="true" title="Drag to reorder">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                {/if}
                
                <!-- Delete button - visible on hover -->
                <button 
                  type="button" 
                  class="delete-button" 
                  on:click|stopPropagation={() => listsService.removeItem(item.id)}
                  title="Delete item"
                  aria-label="Delete item: {item.text}"
                >
                  <span class="delete-icon">×</span>
                </button>
            </li>
          {/each}
        </ul>
      {:else}
        <!-- Friendly minimalist empty state -->
        <div class="zl-empty-state"
          in:fade={{ duration: 300, delay: 50 }}
          on:click={() => { isCreatingNewItem = true; }}
          class:clickable={!isCreatingNewItem}
          class:isCreatingNewItem={isCreatingNewItem}
        >
          <div class="zl-empty-content">
            <p class="zl-empty-title">Your list awaits</p>
            <p class="zl-empty-description">Hit that yellow button</p>
            <p class="zl-empty-hint">or click here to type</p>
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
                on:keydown={(e) => {
                  if (e.key === 'Enter' && newItemText.trim()) {
                    listsService.addItem(newItemText.trim());
                    newItemText = '';
                    isCreatingNewItem = false;
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
  /* 
  * Define CSS Custom Properties (variables) for the animated gradient background.
  * These variables allow for easy theme customization and maintenance.
  */
  :root {
    /* -- START .zl-card Animated Gradient Theme Variables -- */
    
    /* Angle of the linear gradient - controls the direction of the gradient flow */
    --zl-card-bg-gradient-angle: 120deg;
    
    /* Start color of the gradient - cool mint tone */
    --zl-card-bg-gradient-color-start: #e0f7fa;
    
    /* Second color - vibrant turquoise tone for more visible gradient */
    --zl-card-bg-gradient-color-second: #40e0d0;
    
    /* Middle color of the gradient - soft aqua tone */
    --zl-card-bg-gradient-color-mid: #4dd0e1;
    
    /* Fourth color - deeper aqua green for gradient variation */
    --zl-card-bg-gradient-color-fourth: #00bcd4;
    
    /* End color of the gradient - deeper blue tone */
    --zl-card-bg-gradient-color-end: #0097a7;
    
    /* Duration for one full cycle of the background gradient animation */
    --zl-card-bg-gradient-animation-duration: 15s;
    
    /* Size of the background gradient - larger than the element for the shifting effect */
    --zl-card-bg-gradient-size: 400% 400%;
    
    /* Border radius for the card - creates the pillowy, rounded appearance */
    --zl-card-border-radius: 32px;
    
    /* Border width and color for the card - contributes to the "chonky" feel */
    --zl-card-border-width: 4px;
    --zl-card-border-color: rgba(0, 188, 212, 0.6);
    
    /* Box shadow for the card - adds depth and dimension */
    --zl-card-box-shadow: 0 12px 30px rgba(0, 151, 167, 0.25);
    
    /* -- END .zl-card Animated Gradient Theme Variables -- */
    
    /* -- START List Item Theme Variables -- */
    
    /* Base colors - derived from card gradient */
    --zl-primary-color: var(--zl-card-bg-gradient-color-fourth, #00bcd4);
    --zl-secondary-color: var(--zl-card-bg-gradient-color-mid, #4dd0e1);
    --zl-accent-color: var(--zl-card-bg-gradient-color-end, #0097a7);
    --zl-highlight-color: var(--zl-card-bg-gradient-color-second, #40e0d0);
    
    /* Text colors */
    --zl-text-color-primary: #444444;
    --zl-text-color-secondary: #666666;
    --zl-text-color-disabled: #9d9d9d;
    --zl-text-hover-color: #0097a7;
    
    /* List item styling */
    --zl-item-bg: rgba(255, 255, 255, 0.5);
    --zl-item-hover-bg: rgba(255, 255, 255, 0.8);
    --zl-item-border-radius: 20px;
    --zl-item-border-color: rgba(0, 188, 212, 0.6);
    --zl-item-border-hover-color: rgba(0, 188, 212, 0.9);
    --zl-item-box-shadow: 0 4px 10px rgba(0, 151, 167, 0.1);
    --zl-item-hover-box-shadow: 0 8px 20px rgba(0, 151, 167, 0.2);
    
    /* Checked item styling */
    --zl-item-checked-opacity: 0.75;
    --zl-item-checked-bg: rgba(245, 240, 250, 0.4);
    --zl-item-checked-border-color: rgba(0, 188, 212, 0.2);
    
    /* Drag and drop styling */
    --zl-item-dragging-border: 3px solid rgba(0, 188, 212, 0.85);
    --zl-item-dragging-bg: rgba(255, 255, 255, 1);
    --zl-item-dragging-shadow: 0 15px 30px rgba(0, 151, 167, 0.4);
    --zl-item-dragover-bg: rgba(252, 242, 255, 0.9);
    --zl-item-dragover-border: 2px solid rgba(0, 188, 212, 0.8);
    --zl-item-dragover-shadow: 0 8px 20px rgba(0, 151, 167, 0.3);
    
    /* Checkbox styling */
    --zl-checkbox-size: 32px;
    --zl-checkbox-border-radius: 12px;
    --zl-checkbox-border: 2px solid rgba(0, 188, 212, 0.5);
    --zl-checkbox-bg: rgba(255, 255, 255, 0.8);
    --zl-checkbox-hover-border: 2px solid rgba(0, 188, 212, 0.7);
    --zl-checkbox-hover-bg: rgba(255, 245, 250, 0.8);
    --zl-checkbox-checked-gradient-start: var(--zl-card-bg-gradient-color-fourth, #00bcd4);
    --zl-checkbox-checked-gradient-end: var(--zl-card-bg-gradient-color-end, #0097a7);
    --zl-checkbox-checked-shadow: 0 3px 8px rgba(0, 151, 167, 0.2);
    --zl-checkbox-sparkle-color: rgba(255, 255, 255, 0.8);
    
    /* Text button styling */
    --zl-text-button-hover-bg: linear-gradient(135deg, rgba(224, 247, 250, 0.7), rgba(77, 208, 225, 0.2));
    --zl-text-button-focus-shadow: 0 3px 8px rgba(0, 188, 212, 0.2);
    
    /* Grab handle styling */
    --zl-grab-handle-color: rgba(0, 188, 212, 0.8);
    --zl-grab-handle-opacity: 0.6;
    --zl-grab-handle-hover-opacity: 1;
    
    /* Delete button styling */
    --zl-delete-button-bg: rgba(255, 255, 255, 0.8);
    --zl-delete-button-border: 1px solid rgba(0, 188, 212, 0.4);
    --zl-delete-button-hover-bg: rgba(255, 225, 240, 0.95);
    --zl-delete-button-hover-border: rgba(0, 188, 212, 0.8);
    --zl-delete-button-text-color: rgba(0, 188, 212, 0.9);
    
    /* Drop indicator styling */
    --zl-drop-indicator-color: rgba(0, 188, 212, 0.7);
    --zl-drop-arrow-bg: rgba(0, 188, 212, 0.9);
    --zl-drop-arrow-shadow: 0 0 8px rgba(0, 151, 167, 0.4);
    
    /* Edit input styling */
    --zl-edit-input-border: 2px solid rgba(0, 188, 212, 0.3);
    --zl-edit-input-bg: rgba(255, 255, 255, 0.8);
    --zl-edit-input-focus-border: rgba(0, 188, 212, 0.6);
    --zl-edit-input-focus-shadow: 0 0 0 3px rgba(0, 188, 212, 0.1);
    
    /* Empty state styling */
    --zl-empty-state-bg: linear-gradient(135deg, rgba(255, 245, 250, 0.4), rgba(255, 235, 245, 0.4));
    --zl-empty-state-border: 3px dashed rgba(0, 188, 212, 0.3);
    --zl-empty-title-color: var(--zl-primary-color, #00bcd4);
    
    /* New item input styling */
    --zl-new-item-input-border: 2px solid rgba(0, 188, 212, 0.4);
    --zl-new-item-input-focus-border: rgba(0, 188, 212, 0.7);
    --zl-new-item-input-focus-shadow: 0 0 0 3px rgba(0, 188, 212, 0.1);
    
    /* -- END List Item Theme Variables -- */
  }
  
  /* 
  * Original theme - peachy pink gradient.
  * To revert to this theme, uncomment and apply to a parent element.
  
  .theme-peachy {
    --zl-card-bg-gradient-color-start: #fff6e5;
    --zl-card-bg-gradient-color-mid: #ffd4da;
    --zl-card-bg-gradient-color-end: #ffc6e5;
    --zl-card-border-color: rgba(255, 212, 218, 0.8);
    --zl-card-box-shadow: 0 12px 30px rgba(201, 120, 255, 0.25);
  }
  */
  
  /* Animation keyframes */
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
    50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
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
    20% { background-position: 30% 50%; }
    40% { background-position: 70% 20%; }
    60% { background-position: 100% 100%; }
    80% { background-position: 50% 70%; }
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
    max-width: 540px; /* Optimized for text wrapping */
    margin: 0 auto;
    margin-top: 2rem;
    margin-bottom: 2.5rem;
    height: auto;
    
    /* Typography */
    font-family: 'Space Mono', monospace;
    
    /* Transitions */
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    
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
    background: linear-gradient(
      var(--zl-card-bg-gradient-angle),
      var(--zl-card-bg-gradient-color-start),
      var(--zl-card-bg-gradient-color-second),
      var(--zl-card-bg-gradient-color-mid),
      var(--zl-card-bg-gradient-color-fourth),
      var(--zl-card-bg-gradient-color-end)
    );
    background-size: var(--zl-card-bg-gradient-size);
    animation: gradient-shift var(--zl-card-bg-gradient-animation-duration) ease infinite;
  }

  /* Media query for mobile responsiveness */
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
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.6), rgba(201, 120, 255, 0.2));
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
    background: radial-gradient(circle, rgba(255, 202, 236, 0.3) 0%, rgba(255, 202, 236, 0) 70%);
    border-radius: 50%;
    opacity: 0.5;
    pointer-events: none;
    animation: soft-pulse 8s infinite alternate ease-in-out;
  }
  
  /* Card content */
  .card-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    min-height: 320px;
    overflow: hidden;
  }
  
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
    gap: 20px; /* Increased from 14px to 20px for more "chonky" separation */
    margin-bottom: 1.5rem;
    position: relative;
  }
  
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
    padding: 16px 16px; /* Adjusted to 16px horizontal padding to avoid excessive text wrapping */
    
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
    box-shadow: var(--zl-item-box-shadow, 0 4px 10px rgba(201, 120, 255, 0.1));
    border: 2px solid var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
    border-left: 4px solid var(--zl-item-border-color, rgba(201, 120, 255, 0.3));
    
    /* Interaction */
    position: relative;
    cursor: grab;
    transition: all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  /* Performance optimization - only add will-change to draggable items */
  .zl-item:not(.checked):not(.editing) {
    will-change: transform;
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
    box-shadow: var(--zl-item-hover-box-shadow, 0 8px 20px rgba(201, 120, 255, 0.2));
    border-left: 4px solid var(--zl-item-border-hover-color, rgba(201, 120, 255, 0.7));
    border-color: var(--zl-item-border-hover-color, rgba(255, 212, 218, 0.9));
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
    color: var(--zl-text-color-primary, #444444);
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
    
    /* Animation */
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  /**
   * Hover state for unchecked item text
   * 
   * Provides visual feedback when hovering over editable text with color
   * change, subtle glow, and slight elevation
   */
  .zl-item:not(.checked) .zl-item-text-button:hover .zl-item-text {
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

  @keyframes sparkleIn {
    0% { opacity: 0; }
    30% { opacity: 0.5; }
    100% { opacity: 0.8; }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-50%) translateX(-5px); }
    to { opacity: 1; transform: translateY(-50%) translateX(0); }
  }

  .zl-item-text-button:focus-visible:not(:disabled) {
    box-shadow: 0 0 0 2px rgba(201, 120, 255, 0.3);
  }

  .zl-item-text-button:disabled {
    cursor: default;
  }
  
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
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    animation: sparkle 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.5) forwards;
    z-index: 5;
  }
  
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
    background: linear-gradient(135deg, rgba(255, 245, 250, 0.4), rgba(255, 235, 245, 0.4));
    border: 3px dashed rgba(201, 120, 255, 0.3);
    border-radius: 24px;
    margin: 1.5rem 0;
    transition: background 0.2s ease, border-color 0.2s ease; /* Transition only non-layout properties */
  }

  .zl-empty-state.clickable {
    cursor: pointer;
  }

  .zl-empty-state.clickable:hover {
    background: linear-gradient(135deg, rgba(255, 245, 250, 0.6), rgba(255, 235, 245, 0.6));
    border-color: rgba(201, 120, 255, 0.5);
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
    color: #c978ff;
    margin-bottom: 1.5rem;
    font-size: 2.2rem;
    font-family: 'Space Mono', monospace;
    letter-spacing: 0.8px;
  }
  
  .zl-empty-description {
    color: #555;
    font-size: 1.3rem;
    font-family: 'Space Mono', monospace;
    line-height: 1.5;
    letter-spacing: 0.5px;
    font-weight: 600;
    margin-bottom: 0.3rem;
  }
  
  .zl-empty-hint {
    color: #666;
    font-size: 1.1rem;
    font-family: 'Space Mono', monospace;
    font-weight: 400;
    letter-spacing: 0.4px;
  }
  
  
  /* Edit wrapper container */
  .edit-wrapper {
    flex: 1;
    position: relative;
    min-height: 44px;
    margin-right: auto;
    display: flex;
    align-items: flex-start; /* Align at the top for multi-line content */
    padding-top: 4px; /* Add a little padding at the top for vertical alignment */
    align-self: stretch; /* Stretch to fill the height of the parent */
    width: calc(100% - 32px - 32px - 2rem); /* Full width minus checkbox, handle, and padding */
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
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    width: calc(100% - 16px); /* Full width within container minus small margin */
    max-width: none; /* Ensure it doesn't collapse to text width */
  }

  .zl-edit-input::placeholder {
    color: #aaaaaa;
  }

  .zl-edit-input:focus {
    border-color: rgba(201, 120, 255, 0.6);
    box-shadow: 0 0 0 3px rgba(201, 120, 255, 0.1);
    background-color: rgba(255, 255, 255, 0.95);
  }
  
  
  
  /**
   * DRAG AND DROP STYLING
   *
   * Styles for drag and drop interactions that provide clear visual feedback
   * to users when moving items or hovering over drop targets.
   */
  @keyframes float {
    0%, 100% { transform: translateY(0) rotate(-0.5deg); }
    50% { transform: translateY(-3px) rotate(0.5deg); }
  }

  @keyframes pulse-border {
    0%, 100% { border-color: var(--zl-item-border-color, rgba(201, 120, 255, 0.6)); }
    50% { border-color: var(--zl-item-border-hover-color, rgba(201, 120, 255, 1)); }
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
    box-shadow: var(--zl-item-dragging-shadow, 0 15px 30px rgba(0, 151, 167, 0.4));
    z-index: 10;
    border: var(--zl-item-dragging-border, 3px solid rgba(0, 188, 212, 0.85));
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

  @keyframes pulse-opacity {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 8px rgba(201, 120, 255, 0.4); }
    50% { box-shadow: 0 0 12px rgba(201, 120, 255, 0.7); }
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
  
</style>