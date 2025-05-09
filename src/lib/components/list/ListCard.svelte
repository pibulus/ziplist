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
  
  const dispatch = createEventDispatcher();
  
  // State variables
  let isEditingName = false;
  let editedName = '';
  let showCompleted = false;
  let draggedItemId = null;
  let dragOverItemId = null;
  let newItemText = '';
  let isAddingItem = false;
  
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
</script>

<div 
  class="card w-full max-w-[640px] min-h-[420px] h-auto overflow-hidden flex flex-col bg-white {isActive ? `border-2 border-${themeService.getCurrentTheme()}` : 'border border-gray-200'} {showCompleted ? 'showing-completed' : ''}"
  style="transition: all 0.3s ease; backface-visibility: hidden; will-change: transform, box-shadow; -webkit-backface-visibility: hidden;"
  on:click={() => onSelect(list.id)}
>
  <div class="card-body p-6 flex flex-col">
    <div class="card-title flex justify-between mb-3">
      {#if isEditingName}
        <input 
          id="edit-list-{list.id}"
          class="input input-bordered input-sm flex-grow"
          bind:value={editedName}
          on:blur={saveListName}
          on:keydown={handleKeyDown}
        />
      {:else}
        <h3 class="text-lg font-bold truncate flex-grow" on:dblclick={startEditingName}>
          {list.name}
        </h3>
        <button 
          class="btn btn-square btn-ghost btn-xs" 
          on:click|stopPropagation={startEditingName}
          title="Rename list"
        >
          ✏️
        </button>
      {/if}
    </div>
    
    <div class="flex-grow overflow-y-auto mb-3 max-h-[350px] h-full scrollbar-thin">
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
                class="form-checkbox h-5 w-5 text-{themeService.getCurrentTheme()}-600 rounded mr-3 mt-1"
              />
              <label
                for="item-{list.id}-{item.id}"
                class="{item.checked ? 'line-through text-gray-500' : 'text-gray-900'} break-words flex-grow"
              >
                {item.text}
              </label>
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
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    padding-right: 12px; /* Add some padding for the scrollbar */
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .list-item {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: flex-start;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 6px;
    flex-wrap: nowrap;
    min-height: 42px;
    background-color: #fafafa;
    width: 100%;
  }
  
  /* Each list item has its own border now */
  
  .list-item label {
    cursor: pointer;
    flex-grow: 1;
    font-size: 1rem;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    min-width: 0;
    padding-top: 1px;
    line-height: 1.4;
    max-width: calc(100% - 30px); /* Account for checkbox width */
    display: block;
  }

  /* Custom scrollbar styles */
  :global(.scrollbar-thin::-webkit-scrollbar) {
    width: 6px;
  }
  
  :global(.scrollbar-thin::-webkit-scrollbar-track) {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
  }
  
  :global(.scrollbar-thin::-webkit-scrollbar-thumb) {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }
  
  :global(.scrollbar-thin::-webkit-scrollbar-thumb:hover) {
    background: rgba(0, 0, 0, 0.2);
  }
  
  /* Style for when showing completed items */
  .showing-completed {
    background-color: #fafafa;
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