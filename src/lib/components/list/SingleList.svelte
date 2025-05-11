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
              {#if dragOverItemId === item.id && draggedItemId !== null && draggedItemId !== item.id}
                <div
                  class="drop-indicator"
                  transition:fade={{ duration: 100 }}
                  aria-hidden="true"
                >
                  <!-- Triangle drop marker -->
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
              
              {#if editingItemId === item.id}
                <input
                  id="edit-item-{list.id}-{item.id}"
                  class="zl-edit-input"
                  placeholder="Enter item text..."
                  bind:value={editedItemText}
                  on:blur={saveItemEdit}
                  on:keydown={handleEditItemKeyDown}
                  transition:slide={{ duration: 120 }}
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
  
  /* Card styling with improved gradient */
  .zl-card {
    border-radius: 28px;
    background: linear-gradient(135deg, #fff6e5, #ffd4da, #ffc6e5);
    background-size: 300% 300%;
    animation: gradient-shift 30s ease infinite;
    box-shadow: 0 10px 25px rgba(201, 120, 255, 0.2);
    border: 3px solid rgba(255, 212, 218, 0.8);
    padding: 1.8rem;
    position: relative;
    overflow: hidden;
    font-family: 'Space Mono', monospace;
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    margin-top: 1.5rem;
    margin-bottom: 2rem;
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
    gap: 14px;
    margin-bottom: 1.5rem;
  }
  
  /* Individual list items */
  .zl-item {
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.5);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 4px 10px rgba(201, 120, 255, 0.1);
    position: relative;
    cursor: pointer;
    border-left: 4px solid rgba(201, 120, 255, 0.3);
    border: 2px solid rgba(255, 212, 218, 0.6);
    min-height: 54px;
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
    transition: all 0.2s ease;
    font-family: 'Space Mono', monospace;
    letter-spacing: 0.8px;
    min-height: 30px;
    box-sizing: border-box;
    display: inline-block;
    width: 100%;
  }

  .zl-item-text.checked {
    text-decoration: line-through rgba(201, 120, 255, 0.5) 1.5px;
    color: #9d9d9d;
  }

  /* Text button styling */
  .zl-item-text-button {
    background: transparent;
    border: none;
    padding: 3px 5px;
    text-align: left;
    cursor: pointer;
    flex-grow: 1;
    font-family: inherit;
    display: block;
    width: 100%;
    border-radius: 6px;
    transition: background-color 0.2s ease;
  }

  .zl-item-text-button:hover:not(:disabled),
  .zl-item-text-button:focus-visible:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.5);
    outline: none;
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
    display: inline-block;
    cursor: pointer;
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
    width: 24px;
    height: 24px;
    border: 2px solid rgba(201, 120, 255, 0.5);
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.8);
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 2px 5px rgba(201, 120, 255, 0.1);
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
  
  /* Empty state */
  .zl-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2.5rem 1rem;
    min-height: 200px;
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
  
  /* Add item form */
  .zl-add-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.2rem;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 18px;
    box-shadow: 0 5px 15px rgba(201, 120, 255, 0.1);
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.8);
  }
  
  .zl-form-buttons {
    display: flex;
    gap: 0.8rem;
    justify-content: flex-end;
  }
  
  /* Input fields */
  .zl-input, .zl-edit-input {
    font-family: 'Space Mono', monospace;
    font-weight: 800;
    border: 2px solid rgba(201, 120, 255, 0.3);
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 12px;
    padding: 0.5rem 0.8rem;
    outline: none;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    color: #444444;
    width: 100%;
    font-size: 1.1rem;
    letter-spacing: 0.8px;
    box-sizing: border-box;
    line-height: 1.5;
    margin: 0;
    min-height: 30px;
    height: 44px;
  }
  
  .zl-input::placeholder, .zl-edit-input::placeholder {
    color: #aaaaaa;
  }
  
  .zl-input:focus, .zl-edit-input:focus {
    border-color: rgba(201, 120, 255, 0.6);
    box-shadow: 0 0 0 3px rgba(201, 120, 255, 0.1);
    background-color: rgba(255, 255, 255, 0.95);
  }
  
  /* Buttons */
  .zl-button {
    border: none;
    border-radius: 12px;
    padding: 0.6rem 1.1rem;
    font-weight: 500;
    font-size: 0.95rem;
    font-family: 'Space Mono', monospace;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  
  .zl-button.primary {
    background: linear-gradient(135deg, #e9a8ff 0%, #c978ff 100%);
    color: white;
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.2);
  }
  
  .zl-button.primary:hover:not(:disabled) {
    box-shadow: 0 5px 12px rgba(201, 120, 255, 0.3);
    transform: translateY(-2px);
  }
  
  .zl-button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .zl-button.secondary {
    background: rgba(255, 255, 255, 0.8);
    color: #c978ff;
    border: 1px solid rgba(201, 120, 255, 0.3);
  }
  
  .zl-button.secondary:hover {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(201, 120, 255, 0.5);
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.1);
    transform: translateY(-2px);
  }
  
  /* Add button in top right corner */
  .zl-add-button {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #e9a8ff 0%, #c978ff 100%);
    border: none;
    color: white;
    border-radius: 50%;
    font-weight: 400;
    font-size: 2rem;
    line-height: 1;
    font-family: 'Space Mono', monospace;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(201, 120, 255, 0.2);
    position: relative;
  }
  
  .zl-add-button:hover {
    box-shadow: 0 8px 20px rgba(201, 120, 255, 0.3);
    transform: translateY(-3px) scale(1.05);
  }
  
  /* DRAMATIC DRAG AND DROP STYLING */
  .zl-item.dragging {
    opacity: 0.8;
    border: 3px dashed #c978ff; 
    background-color: rgba(250, 245, 255, 0.7);
    transform: rotate(2deg) scale(1.02);
    box-shadow: 0 10px 20px rgba(201, 120, 255, 0.3);
    z-index: 10;
  }
  
  .zl-item.drag-over {
    margin-top: 30px;
    background-color: rgba(252, 242, 255, 0.8);
    box-shadow: 0 8px 20px rgba(201, 120, 255, 0.3);
    border-color: #c978ff;
  }
  
  /* Super visible drop indicator */
  .drop-indicator {
    position: absolute;
    top: -26px;
    left: 0;
    right: 0;
    height: 26px;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 5;
  }
  
  .drop-arrow {
    width: 0;
    height: 0;
    border-left: 12px solid transparent;
    border-right: 12px solid transparent;
    border-top: 16px solid #c978ff;
    animation: bounce 0.7s infinite alternate ease-in-out;
  }
  
  /* Tailwind margin utilities */
  .my-2 {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
</style>