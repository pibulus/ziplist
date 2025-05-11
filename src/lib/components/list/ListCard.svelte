<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { themeService } from '$lib/services/theme';
  
  // List data and event handlers
  export let list = { name: '', items: [] };
  export let isActive = false;
  export let onSelect = () => {};
  export let onToggleItem = () => {};
  export let onDeleteList = () => {};
  export let onRenameList = () => {};
  export let onClearList = () => {};
  export let onReorderItems = () => {};
  export let onAddItem = () => {};
  export let onEditItem = () => {};
  
  const dispatch = createEventDispatcher();
  
  // State variables
  let isEditingName = false;
  let editedName = '';
  let showCompleted = false;
  let draggedItemId = null;
  let dragOverItemId = null;
  let newItemText = '';
  let isAddingItem = false;
  let editingItemId = null;
  let editedItemText = '';
  
  // Filtered items
  $: filteredItems = showCompleted 
    ? list.items 
    : list.items.filter(item => !item.checked);
  
  // Count of hidden completed items
  $: hiddenCount = list.items.filter(item => item.checked).length;
  
  // Drag and drop functions
  function handleDragStart(event, itemId) {
    // Set data and styling
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    draggedItemId = itemId;
    
    // Add styling to the dragged element
    setTimeout(() => {
      event.target.classList.add('dragging');
    }, 0);
  }
  
  function handleDragEnd(event) {
    // Remove styling
    draggedItemId = null;
    dragOverItemId = null;
    event.target.classList.remove('dragging');
  }
  
  function handleDragOver(event, itemId) {
    // Prevent default to allow drop
    event.preventDefault();
    dragOverItemId = itemId;
    
    // Add visual cue for drop target
    const items = document.querySelectorAll('.list-item');
    items.forEach(item => {
      item.classList.remove('drag-over');
    });
    event.currentTarget.classList.add('drag-over');
  }
  
  function handleDrop(event, targetItemId) {
    // Prevent default action
    event.preventDefault();
    
    // Clear styling
    event.currentTarget.classList.remove('drag-over');
    
    // If dropped on itself, do nothing
    if (draggedItemId === targetItemId) return;
    
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
      onReorderItems(reorderedItems);
    }
  }
  
  // Handle edit mode for list name
  function startEditingName() {
    editedName = list.name;
    isEditingName = true;
    // Focus the input after render
    setTimeout(() => {
      const editInput = document.getElementById(`edit-list-${list.id}`);
      if (editInput) editInput.focus();
    }, 50);
  }
  
  function saveListName() {
    if (editedName.trim()) {
      onRenameList(editedName);
    }
    isEditingName = false;
  }
  
  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      saveListName();
    } else if (event.key === 'Escape') {
      isEditingName = false;
    }
  }
  
  // Handle item toggle
  function toggleItem(itemId) {
    onToggleItem(itemId);
  }
  
  // Delete list confirmation
  function confirmDelete() {
    if (confirm(`Are you sure you want to delete the list "${list.name}"?`)) {
      onDeleteList();
    }
  }
  
  // Clear list confirmation
  function confirmClear() {
    if (confirm(`Are you sure you want to clear all items from "${list.name}"?`)) {
      onClearList();
    }
  }

  // Add new item functions
  function toggleAddItemForm() {
    isAddingItem = !isAddingItem;
    if (isAddingItem) {
      // Focus the input field after the component renders
      setTimeout(() => {
        const addItemInput = document.getElementById(`add-item-${list.id}`);
        if (addItemInput) addItemInput.focus();
      }, 50);
    } else {
      newItemText = '';
    }
  }

  function handleAddItem() {
    if (newItemText.trim()) {
      onAddItem(newItemText.trim());
      newItemText = '';
      // Keep the form open for adding multiple items
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

    // Focus the input field after the component renders
    setTimeout(() => {
      const editItemInput = document.getElementById(`edit-item-${list.id}-${item.id}`);
      if (editItemInput) editItemInput.focus();
    }, 50);
  }

  function saveItemEdit() {
    if (editedItemText.trim() && editingItemId !== null) {
      onEditItem(editingItemId, editedItemText.trim());
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

<div
  class="card card-bordered w-full max-w-[640px] h-auto flex flex-col bg-white {showCompleted ? 'showing-completed' : ''} list-card"
  style="transition: all 0.3s ease; backface-visibility: hidden; will-change: transform, box-shadow; -webkit-backface-visibility: hidden;"
  on:click={() => onSelect(list.id)}
  class:active={isActive}
>
  <div class="card-body p-8 flex flex-col">
    <div class="card-title flex justify-between mb-4 items-center">
      {#if isEditingName}
        <input
          id="edit-list-{list.id}"
          class="input input-bordered input-md flex-grow"
          bind:value={editedName}
          on:blur={saveListName}
          on:keydown={handleKeyDown}
        />
      {:else}
        <h3 class="text-xl font-bold truncate flex-grow text-{themeService.getCurrentTheme()}-600" on:dblclick={startEditingName}>
          {list.name}
        </h3>
        <button
          class="btn btn-square btn-ghost btn-sm"
          on:click|stopPropagation={startEditingName}
          title="Rename list"
        >
          ✏️
        </button>
      {/if}
    </div>
    
    <div class="flex-grow mb-3 h-full items-content">
      {#if list.items.length > 0 || isAddingItem}
        <ul class="list">
          {#each filteredItems as item (item.id)}
            <li
              class="list-item {item.checked ? 'opacity-75' : ''} rounded hover:bg-gray-50 {draggedItemId === item.id ? 'dragging' : ''} {dragOverItemId === item.id ? 'drag-over' : ''}"
              draggable={!item.checked}
              on:dragstart={(e) => handleDragStart(e, item.id)}
              on:dragend={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
            >
              <div class="drag-handle mr-1" on:mousedown|stopPropagation>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                </svg>
              </div>

              <input
                type="checkbox"
                id="item-{list.id}-{item.id}"
                checked={item.checked}
                on:change={() => toggleItem(item.id)}
                class="checkbox checkbox-{themeService.getCurrentTheme()} checkbox-lg mr-3 mt-1"
              />
              {#if editingItemId === item.id}
                <div class="flex-grow flex">
                  <input
                    id="edit-item-{list.id}-{item.id}"
                    class="input input-bordered input-sm flex-grow bg-white text-gray-800"
                    bind:value={editedItemText}
                    on:blur={saveItemEdit}
                    on:keydown={handleEditItemKeyDown}
                  />
                </div>
              {:else}
                <label
                  for="item-{list.id}-{item.id}"
                  class="{item.checked ? 'line-through text-gray-500' : 'text-gray-900 cursor-pointer'} break-words flex-grow item-label"
                  on:click|stopPropagation={item.checked ? null : () => startEditingItem(item)}
                >
                  {item.text}
                </label>
              {/if}
            </li>
          {/each}

          {#if isAddingItem}
            <li class="list-item add-item-form rounded hover:bg-gray-50">
              <div class="w-full flex gap-2">
                <input
                  id="add-item-{list.id}"
                  class="input input-bordered input-sm flex-grow bg-white text-gray-800"
                  placeholder="Enter new item..."
                  bind:value={newItemText}
                  on:keydown={handleAddItemKeyDown}
                />
                <button
                  class="btn btn-sm btn-{themeService.getCurrentTheme()}"
                  on:click|stopPropagation={handleAddItem}
                  disabled={!newItemText.trim()}
                >
                  Add
                </button>
                <button
                  class="btn btn-sm btn-ghost"
                  on:click|stopPropagation={toggleAddItemForm}
                >
                  Cancel
                </button>
              </div>
            </li>
          {/if}

          {#if hiddenCount > 0}
            <li class="flex justify-center my-3">
              <button
                class="btn btn-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full px-3"
                on:click|stopPropagation={() => showCompleted = !showCompleted}
              >
                {showCompleted ? '↑ Hide Done' : `↓ Show Done (${hiddenCount})`}
              </button>
            </li>
          {/if}

          {#if !isAddingItem}
            <li class="flex justify-center my-3">
              <button
                class="btn btn-xs bg-{themeService.getCurrentTheme()}/20 hover:bg-{themeService.getCurrentTheme()}/30 text-{themeService.getCurrentTheme()}-600 rounded-full px-3"
                on:click|stopPropagation={toggleAddItemForm}
              >
                + Add Item
              </button>
            </li>
          {/if}
        </ul>
      {:else}
        <div class="flex flex-col items-center justify-center h-full text-gray-500 italic gap-4">
          <p>This list is empty</p>
          <button
            class="btn btn-sm btn-{themeService.getCurrentTheme()}"
            on:click|stopPropagation={toggleAddItemForm}
          >
            + Add Item
          </button>
        </div>
      {/if}
    </div>
    
    <div class="card-actions justify-end mt-auto">
      <button 
        class="btn btn-sm btn-ghost" 
        on:click|stopPropagation={confirmClear}
        disabled={list.items.length === 0}
        title="Clear all items"
      >
        Clear
      </button>
      <button 
        class="btn btn-sm btn-outline btn-error" 
        on:click|stopPropagation={confirmDelete}
        title="Delete list"
      >
        Delete
      </button>
    </div>
  </div>
</div>

<style>
  /* Card styles */
  .list-card {
    border-width: 3px;
    border-radius: 12px;
    transition: all 0.3s ease;
  }

  .list-card.active {
    border-color: var(--p);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    transform: translateY(-4px);
  }

  /* List styles */
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    padding-right: 14px; /* Add some padding for the scrollbar */
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .list-item {
    padding: 1rem 1.25rem;
    display: flex;
    align-items: flex-start;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    flex-wrap: nowrap;
    min-height: 52px;
    background-color: #fafafa;
    width: 100%;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  /* CHONKY list items with their own borders */
  
  .list-item label {
    cursor: pointer;
    flex-grow: 1;
    font-size: 1.1rem;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    min-width: 0;
    padding-top: 2px;
    line-height: 1.5;
    max-width: calc(100% - 40px); /* Account for larger checkbox width */
    display: block;
    transition: all 0.2s ease;
  }

  .list-item:hover {
    border-color: rgba(var(--p-rgb), 0.4);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  /* Card content styles */
  .items-content {
    display: flex;
    flex-direction: column;
  }
  
  /* Style for when showing completed items */
  .showing-completed {
    background-color: #fafafa;
  }

  /* Checked item animation */
  .list-item input[type="checkbox"]:checked + label {
    transition: all 0.3s ease;
    transform: translateX(4px);
  }
  
  /* Drag and drop styles */
  .drag-handle {
    cursor: grab;
    display: flex;
    align-items: center;
    opacity: 0.5;
    transition: opacity 0.2s ease;
  }
  
  .list-item:hover .drag-handle {
    opacity: 0.8;
  }
  
  .dragging {
    opacity: 0.6;
    background-color: #f0f9ff;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  
  .drag-over {
    border-color: #60a5fa;
    background-color: #e0f2fe;
  }
</style>