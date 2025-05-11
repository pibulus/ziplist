<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { themeService } from '$lib/services/theme';
  import { slide, fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  
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

  // Create new list function
  function handleCreateList() {
    // Note: We're assuming this should call a parent component function
    // Later we'll connect this to listsService
    dispatch('createList');
  }
  
  const dispatch = createEventDispatcher();
  
  // State variables
  let isEditingName = false;
  let editedName = '';
  let draggedItemId = null;
  let dragOverItemId = null;
  let newItemText = '';
  let isAddingItem = false;
  let editingItemId = null;
  let editedItemText = '';
  let flipDuration = 300; // Duration for the flip animation
  
  // Separated active and completed items
  $: activeItems = list.items.filter(item => !item.checked);
  $: completedItems = list.items.filter(item => item.checked);

  // Sort items - active items first, completed items last (always visible)
  $: sortedItems = [...activeItems, ...completedItems];

  // Count of completed items
  $: completedCount = completedItems.length;
  
  // Drag and drop functions
  function handleDragStart(event, itemId) {
    // Set data and styling
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    draggedItemId = itemId;

    // Add styling to the dragged element - small delay for better visual effect
    setTimeout(() => {
      event.target.classList.add('dragging');

      // Add haptic feedback on mobile devices if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      // Create a subtle "lift" animation by adding a transform
      event.target.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
    }, 0);
  }

  function handleDragEnd(event) {
    // Remove styling with transition
    draggedItemId = null;
    dragOverItemId = null;

    // Add a "settle" animation when dropping
    event.target.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    event.target.classList.remove('dragging');

    // Add haptic feedback on mobile devices if supported
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

    dragOverItemId = itemId;

    // Add visual cue for drop target with subtle animation
    const items = document.querySelectorAll('.list-item');
    items.forEach(item => {
      item.classList.remove('drag-over');
      item.style.transition = 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
    });

    // Apply the drag-over class with a slight delay for a smoother effect
    setTimeout(() => {
      event.currentTarget.classList.add('drag-over');
    }, 0);
  }

  function handleDrop(event, targetItemId) {
    // Prevent default action
    event.preventDefault();

    // Clear styling with a nice transition
    const currentItem = event.currentTarget;
    currentItem.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    currentItem.classList.remove('drag-over');

    // If dropped on itself, do nothing
    if (draggedItemId === targetItemId) return;

    // Add haptic feedback on mobile devices if supported
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
  
  // Handle item toggle with transition effect
  function toggleItem(itemId) {
    // Find the item to determine current state
    const itemToToggle = list.items.find(item => item.id === itemId);
    if (itemToToggle) {
      // Add haptic feedback on toggle
      if (navigator.vibrate) {
        navigator.vibrate(itemToToggle.checked ? 20 : [20, 30, 20]);
      }
    }

    // Call the handler function
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
  class="card w-full max-w-[640px] h-auto flex flex-col rounded-xl border-[3px] border-[#e2d5f8] bg-white"
  style="box-shadow: 0 8px 20px rgba(186, 165, 240, 0.1);"
  on:click={() => onSelect(list.id)}
  class:border-[#c4a9ff]={isActive}
  class:scale-[1.02]={isActive}
  class:shadow-xl={isActive}
>
  <div class="card-body p-8 flex flex-col">
    <div class="card-title flex justify-between mb-4 items-center">
      {#if isEditingName}
        <input
          id="edit-list-{list.id}"
          class="input input-bordered input-md flex-grow"
          style="background-color: white; border-color: #c4a9ff;"
          bind:value={editedName}
          on:blur={saveListName}
          on:keydown={handleKeyDown}
        />
      {:else}
        <h3 class="text-xl font-bold truncate flex-grow" style="color: #9d86e6;" on:dblclick={startEditingName}>
          {list.name}
        </h3>
        <button
          class="btn btn-circle btn-ghost btn-sm"
          on:click|stopPropagation={startEditingName}
          title="Rename list"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      {/if}
    </div>
    
    <div class="flex-grow mb-3 h-full items-content">
      {#if list.items.length > 0 || isAddingItem}
        <ul class="list">
          {#each sortedItems as item (item.id)}
            <li
              class="rounded-lg border border-[#e2d5f8] p-4 bg-white hover:bg-[#f9f6ff] {item.checked ? 'opacity-70' : ''} {draggedItemId === item.id ? 'border-dashed border-[#c4a9ff] opacity-80 rotate-1 scale-[1.02]' : ''} {dragOverItemId === item.id ? 'border-[#b598ff] bg-[#f5eeff]' : ''}"
              style="box-shadow: 0 2px 8px rgba(186, 165, 240, 0.05); transition: all 0.2s ease;"
              draggable={!item.checked}
              on:dragstart={(e) => handleDragStart(e, item.id)}
              on:dragend={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
              animate:flip={{ duration: flipDuration }}
              in:fly={{ y: 20, duration: 300 }}
            >
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="item-{list.id}-{item.id}"
                  checked={item.checked}
                  on:change={() => toggleItem(item.id)}
                  class="checkbox checkbox-lg"
                  style="border: 2px solid #c4a9ff; background-color: white;"
                />
                {#if editingItemId === item.id}
                  <div class="flex-grow">
                    <input
                      id="edit-item-{list.id}-{item.id}"
                      class="input input-bordered w-full"
                      style="background-color: white; border-color: #c4a9ff;"
                      placeholder="Enter new item..."
                      bind:value={editedItemText}
                      on:blur={saveItemEdit}
                      on:keydown={handleEditItemKeyDown}
                    />
                  </div>
                {:else}
                  <div class="flex flex-grow items-center justify-between">
                    <label
                      for="item-{list.id}-{item.id}"
                      class="{item.checked ? 'line-through text-gray-400' : 'text-gray-700 cursor-pointer'} break-words flex-grow item-label"
                      on:click|stopPropagation={item.checked ? null : () => startEditingItem(item)}
                    >
                      {item.text}
                    </label>

                    {#if !item.checked}
                      <div class="drag-handle ml-2" on:mousedown|stopPropagation>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" style="color: #b598ff;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h10M7 16h10" />
                        </svg>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </li>
          {/each}

          {#if completedItems.length > 0}
            <div class="my-3" in:fade={{ duration: 200 }}>
              <div class="border-t-2 border-dashed border-[#d4c2ff] w-full"></div>
            </div>
          {/if}

          {#if isAddingItem}
            <li class="rounded-lg border border-[#e2d5f8] p-4 bg-white hover:bg-[#f9f6ff]"
              style="box-shadow: 0 2px 8px rgba(186, 165, 240, 0.05);">
              <div class="w-full flex gap-2">
                <input
                  id="add-item-{list.id}"
                  class="input input-bordered input-md flex-grow"
                  style="background-color: white; border-color: #c4a9ff;"
                  placeholder="Enter new item..."
                  bind:value={newItemText}
                  on:keydown={handleAddItemKeyDown}
                />
                <button
                  class="btn btn-sm"
                  style="background-color: #b598ff; border: none; color: white; box-shadow: 0 2px 4px rgba(181, 152, 255, 0.3);"
                  on:click|stopPropagation={() => {
                    if (navigator.vibrate) navigator.vibrate(30);
                    handleAddItem();
                  }}
                  disabled={!newItemText.trim()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Add
                </button>
                <button
                  class="btn btn-sm"
                  style="background-color: white; border: 1px solid #e2d5f8; color: #9d86e6;"
                  on:click|stopPropagation={() => {
                    toggleAddItemForm();
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              </div>
            </li>
          {/if}


          {#if !isAddingItem}
            <li class="flex justify-center my-3">
              <button
                class="btn btn-sm gap-1"
                style="background-color: white; border: 2px solid #c4a9ff; color: #9d86e6;"
                on:click|stopPropagation={() => {
                  if (navigator.vibrate) navigator.vibrate(20);
                  toggleAddItemForm();
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </button>
            </li>
          {/if}
        </ul>
      {:else}
        <div class="flex flex-col items-center justify-center h-full gap-6">
          <div class="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="#c4a9ff">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p class="mb-2 text-gray-700 font-medium">This list is empty</p>
            <p class="text-sm text-gray-500 mb-4">Add items to get started</p>
          </div>
          <button
            class="btn btn-md gap-1"
            style="background-color: #b598ff; border: none; color: white; box-shadow: 0 2px 4px rgba(181, 152, 255, 0.3);"
            on:click|stopPropagation={() => {
              if (navigator.vibrate) navigator.vibrate(20);
              toggleAddItemForm();
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add First Item
          </button>
        </div>
      {/if}
    </div>
    
    <div class="card-actions justify-between items-center mt-auto border-t pt-3 border-[#e2d5f8]">
      <div class="dropdown dropdown-top">
        <div tabindex="0" role="button" class="btn btn-sm btn-ghost btn-circle">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="#9d86e6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        </div>
        <ul tabindex="0" class="dropdown-content z-30 menu p-2 shadow bg-white rounded-box w-52 border border-[#e2d5f8]">
          <li>
            <button
              on:click|stopPropagation={() => {
                if (navigator.vibrate) navigator.vibrate(30);
                handleCreateList();
              }}
              class="text-gray-700 hover:bg-[#f5eeff]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#9d86e6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              New List
            </button>
          </li>
          <li>
            <button
              on:click|stopPropagation={() => {
                if (navigator.vibrate) navigator.vibrate(30);
                confirmClear();
              }}
              disabled={list.items.length === 0}
              class="text-gray-700 hover:bg-[#f5eeff] {list.items.length === 0 ? 'opacity-50' : ''}"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#9d86e6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m4-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear List
            </button>
          </li>
          <li>
            <button
              on:click|stopPropagation={() => {
                if (navigator.vibrate) navigator.vibrate(30);
                confirmDelete();
              }}
              class="text-red-500 hover:bg-red-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Delete List
            </button>
          </li>
        </ul>
      </div>

      <div class="badge"
        style="background-color: #b598ff30; color: #9d86e6; border: 1px solid #c4a9ff; padding: 0.75rem; font-weight: 500;">
        {list.items.length} {list.items.length === 1 ? 'item' : 'items'}
      </div>
    </div>
  </div>
</div>

<style>
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .item-label {
    cursor: pointer;
    flex-grow: 1;
    font-size: 1.1rem;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    min-width: 0;
    line-height: 1.5;
    max-width: calc(100% - 40px);
  }

  .completed-items-divider {
    margin: 1rem 0;
  }

  .drag-handle {
    cursor: grab;
    display: flex;
    align-items: center;
    opacity: 0.3;
    transition: all 0.2s ease;
    padding: 4px;
    border-radius: 4px;
  }

  .drag-handle:hover {
    opacity: 1;
    background-color: rgba(147, 51, 234, 0.1);
    transform: scale(1.1);
  }
</style>