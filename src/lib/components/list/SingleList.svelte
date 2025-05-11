<script>
  import { onMount, onDestroy } from 'svelte';
  import { listsStore, activeList } from '$lib/services/lists/listsStore';
  import { listsService } from '$lib/services/lists/listsService';
  import { slide, fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  
  // State variables
  let list = { name: '', items: [] };
  let draggedItemId = null;
  let dragOverItemId = null;
  let newItemText = '';
  let isAddingItem = false;
  let editingItemId = null;
  let editedItemText = '';
  
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

  // Format item text with first-letter capitalization of each word
  function formatItemText(text) {
    return text.split(' ').map(word =>
      word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    ).join(' ');
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
  
  // Drag and drop functions
  function handleDragStart(event, itemId) {
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

    // Only update if we're moving to a new item
    if (dragOverItemId === itemId) return;

    // Update dragover state
    dragOverItemId = itemId;
  }

  function handleDrop(event, targetItemId) {
    // Prevent default action
    event.preventDefault();

    dragOverItemId = null;

    // If dropped on itself, do nothing
    if (draggedItemId === targetItemId) return;

    // Haptic feedback
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

  // Add new item functions
  function toggleAddItemForm() {
    isAddingItem = !isAddingItem;
    if (isAddingItem) {
      // Input will be focused automatically with the autoFocus action
    } else {
      newItemText = '';
    }
  }

  function handleAddItem() {
    if (newItemText.trim()) {
      listsService.addItem(newItemText.trim());
      newItemText = '';
    }
  }

  function handleAddItemKeyDown(event) {
    if (event.key === 'Enter') {
      handleAddItem();
    } else if (event.key === 'Escape') {
      toggleAddItemForm();
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
    <div class="zl-list-container">
      {#if list.items.length > 0 || isAddingItem}
        <ul class="zl-list" role="list">
          {#each sortedItems as item, index (item.id)}
            <li
              class="zl-item {item.checked ? 'checked' : ''}"
              class:dragging={draggedItemId === item.id}
              class:drag-over={dragOverItemId === item.id}
              class:editing={editingItemId === item.id}
              draggable={!item.checked}
              on:dragstart={(e) => handleDragStart(e, item.id)}
              on:dragend={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
              animate:flip={{ duration: 300 }}
              in:fly={{ y: 20, duration: 300, delay: getStaggerDelay(index) }}
              aria-grabbed={draggedItemId === item.id ? 'true' : 'false'}
              aria-dropeffect="move"
              role="listitem"
            >
              <!-- Drop indicator visible only when item is drop target -->
              <!-- No indicator for drag over, just space -->
            
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
              
              <div class="zl-content-wrapper">
                {#if editingItemId === item.id}
                  <textarea
                    id="edit-item-{list.id}-{item.id}"
                    class="zl-edit-input"
                    placeholder="Enter item text..."
                    bind:value={editedItemText}
                    on:blur={saveItemEdit}
                    on:keydown={handleEditItemKeyDown}
                    use:autoFocus
                    style="resize: none;"
                  ></textarea>
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

                <!-- Subtle drag handle indicator -->
                {#if !item.checked}
                  <div class="grab-indicator" aria-hidden="true">
                    <span></span>
                    <span></span>
                  </div>
                {/if}
            </li>
          {/each}

          {#if isAddingItem}
            <li class="zl-add-form" transition:slide={{ duration: 200 }}>
              <input
                id="add-item-{list.id}"
                class="zl-input"
                placeholder="What are we zipping up today?"
                bind:value={newItemText}
                on:keydown={handleAddItemKeyDown}
                transition:fade={{ duration: 150 }}
                use:autoFocus
              />
              <div class="zl-form-buttons">
                <button
                  class="zl-button primary"
                  on:click|stopPropagation={handleAddItem}
                  disabled={!newItemText.trim()}
                >
                  Add
                </button>
                <button
                  class="zl-button secondary"
                  on:click|stopPropagation={toggleAddItemForm}
                >
                  Cancel
                </button>
              </div>
            </li>
          {/if}
        </ul>
      {:else}
        <!-- Empty state -->
        <div class="zl-empty-state" transition:fade={{ duration: 200 }}>
          <p class="zl-empty-title">No thoughts, just vibes</p>
          <p class="zl-empty-description">Your list is a blank canvas waiting for inspiration</p>
          <button
            class="zl-add-button"
            on:click|stopPropagation={toggleAddItemForm}
          >
            +
          </button>
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
    padding: 2.5rem 2rem; /* Adjusted horizontal padding to 2rem for better text wrapping */
    position: relative;
    overflow: hidden;
    font-family: 'Space Mono', monospace;
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    width: 100%;
    max-width: 560px; /* Increased to 560px for better text wrapping */
    margin: 0 auto;
    margin-top: 2rem; /* Increased from 1.75rem */
    margin-bottom: 2.5rem; /* Increased from 2.25rem */
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
  }
  
  /* List container */
  .zl-list-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
  }
  
  .zl-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 20px; /* Increased from 14px to 20px for more "chonky" separation */
    margin-bottom: 1.5rem;
  }
  
  /* Individual list items */
  .zl-item {
    border-radius: 20px; /* Increased to 20px as per feedback for desktop */
    background: rgba(255, 255, 255, 0.5);
    padding: 16px 14px; /* Reduced horizontal padding to 14px for more text space */
    display: flex;
    align-items: flex-start; /* Changed from center to allow items to expand vertically */
    gap: 1rem; /* Adjusted to 1rem for better horizontal space efficiency */
    transition: all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 4px 10px rgba(201, 120, 255, 0.1);
    position: relative;
    cursor: grab; /* Changed back to a grab hand cursor */
    border-left: 4px solid rgba(201, 120, 255, 0.3);
    border: 2px solid rgba(255, 212, 218, 0.6);
    min-height: 60px; /* Minimum height, but allow growth for multi-line content */
    height: auto; /* Allow growth based on content */
    width: 100%; /* Full width */
    box-sizing: border-box; /* Include padding and border in height/width */
    justify-content: space-between;
  }

  .zl-item:hover {
    background: rgba(255, 255, 255, 0.8);
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(201, 120, 255, 0.2);
    border-left: 4px solid rgba(201, 120, 255, 0.7);
    border-color: rgba(255, 212, 218, 0.9);
    min-height: 60px; /* Maintain minimum height on hover */
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
    height: 60px; /* Keep consistent with non-checked items */
  }

  /* Content wrapper - added for better layout */
  .zl-content-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    position: relative;
    min-height: 60px;  /* your standard item height */
    box-sizing: border-box;
  }

  /* Editing state styling */
  .zl-item.editing {
    position: relative;
    height: auto !important;
    width: 100% !important; /* Fixed exact width - same as non-editing */
    box-sizing: border-box !important;
  }

  .zl-item.editing .zl-item-text {
    visibility: hidden;
  }

  .zl-item.editing .zl-content-wrapper {
    /* Ensure the container maintains its size */
    min-height: 60px;
  }

  .zl-item.editing .zl-edit-input {
    display: inline-block;       /* shrink-to-fit mode */
    width: auto;                 /* let it grow with content */
    max-width: calc(100% - 80px);/* checkbox (32px) + handle (32px) + 16px total padding */
    padding: 0.75rem 1rem;
    box-sizing: border-box;

    /* Auto-height instead of forced height or scrollbar: */
    height: auto !important;
    overflow: visible !important;
    resize: none;

    line-height: 1.5;
    font-size: 1.1rem;
    white-space: pre-wrap;
    word-break: break-word;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid rgba(201, 120, 255, 0.4);
    margin: 0;
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
    width: auto; /* Fit content width */
    max-width: 100%; /* Don't overflow */
    text-align: left;
    position: relative;
    padding: 0;
    min-height: 38px; /* Minimum height instead of fixed height */
    white-space: normal; /* Allow wrapping */
    overflow: visible; /* Show all text */
    word-break: break-word; /* Ensure words break properly */
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
    padding: 0 0.5rem; /* Minimal padding for better space usage */
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: flex-start; /* Align to top for multi-line text */
    width: auto; /* Fit content */
    max-width: calc(100% - 42px); /* Match edit input width */
    border-radius: 12px; /* Match edit input */
    transition: all 0.2s ease;
    position: relative;
    min-height: 38px; /* Minimum height instead of fixed */
    height: auto; /* Allow expansion */
    box-sizing: border-box;
    overflow: visible; /* Show all content */
  }

  .zl-item-text-button:hover:not(:disabled),
  .zl-item-text-button:focus-visible:not(:disabled) {
    background: linear-gradient(135deg, rgba(252, 235, 246, 0.7), rgba(255, 242, 253, 0.9));
    outline: none;
    border-radius: 12px;
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.2);
    transform: translateY(-1px);
  }

  .zl-item-text-button:hover:not(:disabled)::after {
    content: '';
    position: absolute;
    width: 26px;
    height: 26px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='rgba(201, 120, 255, 0.5)' stroke='rgba(201, 120, 255, 1)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'%3E%3C/path%3E%3C/svg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    right: -28px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0;
    animation: fadeIn 0.3s forwards ease-out;
    filter: drop-shadow(0 0 8px rgba(201, 120, 255, 0.6));
    z-index: 2;
  }

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
    padding: 4px;
    align-self: center;
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
    width: 32px;
    height: 32px;
    border: 2px solid rgba(201, 120, 255, 0.5);
    border-radius: 12px;
    background-color: rgba(255, 255, 255, 0.8);
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 3px 7px rgba(201, 120, 255, 0.15);
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
  
  /* Empty state - enhanced for "chonky" feel */
  .zl-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3.5rem 1.5rem;
    min-height: 240px;
    position: relative;
  }
  
  .zl-empty-state::before {
    content: '';
    position: absolute;
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(236, 158, 255, 0.15) 0%, rgba(236, 158, 255, 0) 70%);
    border-radius: 50%;
    z-index: 0;
    animation: pulse 5s infinite ease-in-out;
  }
  
  .zl-empty-title {
    font-weight: 600;
    color: #c978ff;
    margin-bottom: 0.8rem;
    font-size: 1.2rem;
    font-family: 'Space Mono', monospace;
    position: relative;
    z-index: 1;
  }
  
  .zl-empty-description {
    color: #9d9d9d;
    font-size: 0.95rem;
    max-width: 270px;
    font-family: 'Space Mono', monospace;
    position: relative;
    z-index: 1;
    margin-bottom: 2rem;
  }
  
  /* Add item form - enhanced for "chonky" feel */
  .zl-add-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.65);
    border-radius: 20px;
    box-shadow: 0 6px 18px rgba(201, 120, 255, 0.15);
    position: relative;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.9);
    margin-top: 8px;
  }
  
  .zl-form-buttons {
    display: flex;
    gap: 0.8rem;
    justify-content: flex-end;
  }
  
  /* Input fields styling */
  .zl-input, .zl-edit-input {
    font-family: 'Space Mono', monospace;
    font-weight: 800;
    border: 2px solid rgba(201, 120, 255, 0.3);
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 16px;
    padding: 1rem;
    outline: none;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    color: #444444;
    width: 100%;
    font-size: 1.1rem;
    letter-spacing: 0.8px;
    line-height: 1.5;
    min-height: 60px;
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
  
  /* Add button in top right corner - enhanced for "chonky" feel */
  .zl-add-button {
    width: 60px; /* Increased from 50px for more "chonky" feel */
    height: 60px; /* Increased from 50px for more "chonky" feel */
    background: linear-gradient(135deg, #e9a8ff 0%, #c978ff 100%);
    border: none;
    color: white;
    border-radius: 50%;
    font-weight: 400;
    font-size: 2.25rem; /* Increased from 2rem for better visibility */
    line-height: 1;
    font-family: 'Space Mono', monospace;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 15px rgba(201, 120, 255, 0.3); /* Enhanced shadow */
    position: relative;
    border: 3px solid rgba(255, 255, 255, 0.7); /* Added border for definition */
    margin: 1.5rem auto 1rem; /* Center horizontally with vertical spacing */
  }

  .zl-add-button:hover {
    box-shadow: 0 10px 25px rgba(201, 120, 255, 0.4); /* Enhanced shadow on hover */
    transform: translateY(-4px) scale(1.08); /* Increased from scale(1.05) */
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
    opacity: 0.95;
    background-color: rgba(252, 245, 255, 0.95);
    transform: scale(1.03);
    box-shadow: 0 15px 30px rgba(201, 120, 255, 0.3);
    z-index: 10;
    border: 3px dashed rgba(201, 120, 255, 0.7);
    animation:
      float 2s infinite ease-in-out,
      pulse-border 1.5s infinite ease-in-out;
    cursor: grabbing; /* This is the closed hand cursor when actively dragging */
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

  /* Enhanced grab indicator - visual indicator only */
  .grab-indicator {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-right: 12px;
    opacity: 0.6;
    transition: all 0.25s ease;
    padding: 8px 8px;
    min-width: 32px;
    min-height: 32px;
    justify-content: center;
    align-self: center;
    pointer-events: none; /* Make it non-interactive, entire item is draggable */
    z-index: 1; /* Keep it behind any other elements but still visible */
  }

  .grab-indicator span {
    width: 18px;
    height: 3px;
    background-color: rgba(201, 120, 255, 0.8);
    border-radius: 2px;
    transition: transform 0.2s ease, width 0.2s ease;
  }

  .zl-item:hover .grab-indicator {
    opacity: 1;
    transform: scale(1.1);
  }

  .zl-item:hover .grab-indicator span {
    background-color: rgba(201, 120, 255, 1);
  }
  
  /* Tailwind margin utilities */
  .my-2 {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
</style>