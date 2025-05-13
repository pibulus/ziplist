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
        <ul class="zl-list" role="list">
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
          transition:fade={{ duration: 400, delay: 100 }}
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
  
  .fade-in {
    animation: fade-in 0.3s ease-out forwards;
  }
  
  /* Card styling with improved gradient - enhanced for "chonky" feel */
  .zl-card {
    border-radius: 32px; /* Increased from 28px for more pillowy feel */
    background: linear-gradient(135deg, #fff6e5, #ffd4da, #ffc6e5);
    background-size: 300% 300%;
    animation: gradient-shift 30s ease infinite;
    box-shadow: 0 12px 30px rgba(201, 120, 255, 0.25); /* Enhanced shadow */
    border: 4px solid rgba(255, 212, 218, 0.8); /* Increased from 3px for more "chonky" feel */
    padding: 2.5rem; /* Increased to 2.5rem as per feedback */
    position: relative;
    overflow: hidden;
    font-family: 'Space Mono', monospace;
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    width: 100%;
    max-width: 540px; /* Increased from 480px to improve text wrapping */
    margin: 0 auto;
    margin-top: 2rem; /* Increased from 1.75rem */
    margin-bottom: 2.5rem; /* Increased from 2.25rem */
    height: auto;
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

    .zl-input, .zl-edit-input {
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
  
  /* Individual list items */
  .zl-item {
    border-radius: 20px; /* Increased to 20px as per feedback for desktop */
    background: rgba(255, 255, 255, 0.5);
    padding: 16px 16px; /* Adjusted to 16px horizontal padding to avoid excessive text wrapping */
    display: flex;
    align-items: flex-start; /* Changed from center to allow items to expand vertically */
    gap: 1.25rem; /* Increased from 1rem for better element separation */
    transition: all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 4px 10px rgba(201, 120, 255, 0.1);
    position: relative;
    cursor: grab;
    border-left: 4px solid rgba(201, 120, 255, 0.3);
    border: 2px solid rgba(255, 212, 218, 0.6);
    min-height: 80px; /* Minimum height for consistent sizing */
    height: auto; /* Allow height to grow with content */
    max-height: none; /* Remove any max height constraints */
    justify-content: space-between;
  }

  /* Only add will-change to unchecked items that can be dragged - don't use it on all items to avoid performance issues */
  .zl-item:not(.checked):not(.editing) {
    will-change: transform;
  }

  /* Change cursor for items being edited */
  .zl-item:has(.zl-edit-input),
  .zl-item.editing {
    cursor: default;
  }

  .zl-item:hover {
    background: rgba(255, 255, 255, 0.8);
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(201, 120, 255, 0.2);
    border-left: 4px solid rgba(201, 120, 255, 0.7);
    border-color: rgba(255, 212, 218, 0.9);
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
  
  .zl-item.checked {
    opacity: 0.75;
    background: rgba(245, 240, 250, 0.4);
    border-left: 4px solid rgba(201, 120, 255, 0.2);
    transform: scale(0.98);
    box-shadow: 0 2px 6px rgba(201, 120, 255, 0.05);
    border-color: rgba(255, 212, 218, 0.4);
  }
  
  /* Item text */
  .zl-item-text {
    font-size: 1.1rem;
    font-weight: 800;
    line-height: 1.5;
    color: #444444;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    font-family: 'Space Mono', monospace;
    letter-spacing: 0.8px;
    box-sizing: border-box;
    display: inline-block;
    width: 100%;
    text-align: left;
    position: relative;
    vertical-align: middle;
    padding: 6px 0; /* Increased from 4px for better vertical spacing */
    min-height: 32px; /* Match checkbox height for vertical alignment */
    word-wrap: break-word; /* Ensure text wraps properly */
    overflow-wrap: break-word; /* Modern property for text wrapping */
    hyphens: auto; /* Enable hyphenation for better text breaks */
  }

  /* Edit state indication for unchecked items */
  .zl-item:not(.checked) .zl-item-text-button:hover .zl-item-text {
    color: #c978ff;
    text-shadow: 0 0 8px rgba(201, 120, 255, 0.3);
    transform: translateY(-1px) scale(1.01);
  }

  .zl-item-text.checked {
    text-decoration: line-through rgba(201, 120, 255, 0.5) 1.5px;
    color: #9d9d9d;
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
  
  /* Custom checkbox styling */
  .zl-checkbox-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 4px; /* Added padding to increase touch target */
    align-self: center; /* Center vertically in the list item */
  }

  .zl-checkbox {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .zl-checkbox-custom {
    position: relative;
    display: inline-block;
    width: 32px; /* Increased to 32px as per feedback for better touch target */
    height: 32px; /* Increased to 32px as per feedback for better touch target */
    border: 2px solid rgba(201, 120, 255, 0.5);
    border-radius: 12px; /* Increased from 10px for softer corners */
    background-color: rgba(255, 255, 255, 0.8);
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 3px 7px rgba(201, 120, 255, 0.15); /* Enhanced shadow */
  }
  
  .zl-checkbox-wrapper:hover .zl-checkbox-custom {
    border-color: rgba(201, 120, 255, 0.7);
    background-color: rgba(255, 245, 250, 0.8);
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.15);
  }
  
  /* Checkbox checked state */
  .zl-checkbox:checked + .zl-checkbox-custom {
    background: linear-gradient(145deg, #e9a8ff 0%, #c978ff 100%);
    border-color: transparent;
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.2);
  }
  
  /* Sparkle effect - simplified */
  .zl-checkbox:checked + .zl-checkbox-custom::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 70%);
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
  .zl-input, .zl-edit-input {
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

  .zl-input::placeholder, .zl-edit-input::placeholder {
    color: #aaaaaa;
  }

  .zl-input:focus, .zl-edit-input:focus {
    border-color: rgba(201, 120, 255, 0.6);
    box-shadow: 0 0 0 3px rgba(201, 120, 255, 0.1);
    background-color: rgba(255, 255, 255, 0.95);
  }
  
  /* Buttons - enhanced for "chonky" feel */
  .zl-button {
    border: none;
    border-radius: 14px; /* Increased from 12px for softer corners */
    padding: 0.7rem 1.3rem; /* Increased from 0.6rem 1.1rem for larger touch target */
    font-weight: 600; /* Increased from 500 for more visibility */
    font-size: 1rem; /* Increased from 0.95rem for better readability */
    font-family: 'Space Mono', monospace;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    position: relative;
    overflow: hidden;
    min-height: 48px; /* Added to ensure consistent height and good touch target */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .zl-button.primary {
    background: linear-gradient(135deg, #e9a8ff 0%, #c978ff 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(201, 120, 255, 0.25); /* Enhanced shadow */
    border: 2px solid rgba(201, 120, 255, 0.1); /* Added subtle border */
  }

  .zl-button.primary:hover:not(:disabled) {
    box-shadow: 0 6px 15px rgba(201, 120, 255, 0.35); /* Enhanced shadow on hover */
    transform: translateY(-3px) scale(1.03); /* Added subtle scale effect */
  }

  .zl-button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .zl-button.secondary {
    background: rgba(255, 255, 255, 0.8);
    color: #c978ff;
    border: 2px solid rgba(201, 120, 255, 0.3); /* Increased from 1px for more "chonky" feel */
  }

  .zl-button.secondary:hover {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(201, 120, 255, 0.5);
    box-shadow: 0 4px 10px rgba(201, 120, 255, 0.15); /* Enhanced shadow */
    transform: translateY(-3px) scale(1.02); /* Added subtle scale effect */
  }
  
  
  /* ELEGANT DRAG AND DROP STYLING */
  @keyframes float {
    0%, 100% { transform: translateY(0) rotate(-0.5deg); }
    50% { transform: translateY(-3px) rotate(0.5deg); }
  }

  @keyframes pulse-border {
    0%, 100% { border-color: rgba(201, 120, 255, 0.6); }
    50% { border-color: rgba(201, 120, 255, 1); }
  }

  .zl-item.dragging {
    opacity: 1; /* Fully opaque instead of slightly transparent */
    background-color: rgba(255, 255, 255, 1); /* Solid white background */
    transform: scale(1.03);
    box-shadow: 0 15px 30px rgba(201, 120, 255, 0.4); /* Enhanced shadow */
    z-index: 10;
    border: 3px solid rgba(201, 120, 255, 0.85); /* Solid border instead of dashed */
    animation: float 2s infinite ease-in-out;
    cursor: grabbing;
    will-change: transform, opacity, border;
  }

  .zl-item.drag-over {
    position: relative;
    margin-top: 20px; /* Creates space for the item to fit */
    background-color: rgba(252, 242, 255, 0.9);
    border: 2px solid rgba(201, 120, 255, 0.8);
    box-shadow: 0 8px 20px rgba(201, 120, 255, 0.3);
    transform: translateY(2px); /* Subtle shift to indicate item movement */
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); /* Springy transition */
  }

  /* Enhanced drop indicator for clearer visual feedback */
  .drop-indicator {
    position: absolute;
    top: -12px;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, transparent, rgba(201, 120, 255, 0.7), transparent);
    border-radius: 2px;
    animation: pulse-opacity 1.5s infinite ease-in-out;
    z-index: 5;
    pointer-events: none;
  }

  /* Dropdown arrow to show insertion position */
  .drop-arrow {
    position: absolute;
    top: -6px;
    left: 50%;
    width: 14px;
    height: 14px;
    background-color: rgba(201, 120, 255, 0.9);
    border-radius: 50%;
    transform: translateX(-50%);
    box-shadow: 0 0 8px rgba(201, 120, 255, 0.4);
    animation: pulse-glow 1.5s infinite ease-in-out;
  }

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

  /* Enhanced grab indicator with lines - slightly smaller than original */
  .grab-indicator {
    display: flex;
    flex-direction: column;
    gap: 4px; /* Spacing between lines */
    margin-right: 12px; /* Maintain side margin */
    opacity: 0.6; /* Increased from 0.5 for better visibility */
    transition: all 0.25s ease;
    padding: 8px 8px; /* Increased padding to ensure 32px touch target */
    min-width: 32px; /* Ensures minimum width for touch target */
    min-height: 32px; /* Ensures minimum height for touch target */
    justify-content: center; /* Center lines vertically */
    align-self: center; /* Center vertically in list item regardless of text wrap */
    cursor: grab; /* Explicit grab cursor on the handle */
    position: relative;
  }


  .grab-indicator span {
    width: 16px; /* Slightly smaller than original 18px */
    height: 2.5px; /* Slightly smaller than original 3px */
    background-color: rgba(201, 120, 255, 0.8);
    border-radius: 2px;
    transition: transform 0.2s ease, width 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  }

  .zl-item:hover .grab-indicator {
    opacity: 1;
    transform: scale(1.1); /* Maintain subtle scale effect on hover */
  }


  .zl-item:hover .grab-indicator span {
    background-color: rgba(201, 120, 255, 1); /* Fully opaque on hover */
  }

  /* Subtle hover effect for drag handle */
  .zl-item:hover .grab-indicator span {
    background-color: rgba(201, 120, 255, 1); /* Fully opaque on hover */
    box-shadow: 0 1px 3px rgba(201, 120, 255, 0.3); /* Subtle glow */
  }
  
  /* Delete button styling */
  .delete-button {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(201, 120, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 10;
    box-shadow: 0 2px 5px rgba(201, 120, 255, 0.15);
  }
  
  .delete-icon {
    font-size: 18px;
    line-height: 1;
    color: rgba(201, 120, 255, 0.9);
    font-weight: bold;
  }
  
  .zl-item:hover .delete-button {
    opacity: 1;
    transform: scale(1);
  }
  
  .delete-button:hover {
    background: rgba(255, 225, 240, 0.95);
    border-color: rgba(201, 120, 255, 0.8);
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.3);
  }
  
  .delete-button:active {
    transform: scale(0.9);
    background: rgba(255, 200, 230, 1);
  }
  
  /* Tailwind margin utilities */
  .my-2 {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
</style>