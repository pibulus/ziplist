<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { themeService } from '$lib/services/theme';
  import { slide, fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import './list-components.css';
  
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

  // Count of completed items and total items
  $: completedCount = completedItems.length;
  $: totalCount = list.items.length;
  
  // Drag and drop functions
  function handleDragStart(event, itemId) {
    // Set data and styling
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    draggedItemId = itemId;

    // Add styling to the dragged element
    setTimeout(() => {
      event.target.classList.add('dragging');

      // Add haptic feedback on mobile devices if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 0);
  }

  function handleDragEnd(event) {
    // Remove styling with transition
    draggedItemId = null;
    dragOverItemId = null;

    // Add haptic feedback on mobile devices if supported
    if (navigator.vibrate) {
      navigator.vibrate([20, 30, 20]);
    }
    
    event.target.classList.remove('dragging');
  }

  function handleDragOver(event, itemId) {
    // Prevent default to allow drop
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    // Only update if we're moving to a new item
    if (dragOverItemId === itemId) return;

    dragOverItemId = itemId;

    // Add visual cue for drop target
    const items = document.querySelectorAll('.list-item-mono');
    items.forEach(item => {
      item.classList.remove('drag-over');
    });

    // Apply the drag-over class
    setTimeout(() => {
      event.currentTarget.classList.add('drag-over');
    }, 0);
  }

  function handleDrop(event, targetItemId) {
    // Prevent default action
    event.preventDefault();

    // Clear styling
    event.currentTarget.classList.remove('drag-over');

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
  
  // Handle item toggle
  function toggleItem(itemId) {
    const itemToToggle = list.items.find(item => item.id === itemId);
    if (itemToToggle && navigator.vibrate) {
      navigator.vibrate(itemToToggle.checked ? 20 : [20, 30, 20]);
    }
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
  class="card-mono w-full max-w-[640px] h-auto flex flex-col list-mono"
  on:click={() => onSelect(list.id)}
  class:active={isActive}
>
  <div class="card-content">
    <!-- Title -->
    {#if isEditingName}
      <input
        id="edit-list-{list.id}"
        class="mono-input title"
        bind:value={editedName}
        on:blur={saveListName}
        on:keydown={handleKeyDown}
      />
    {:else}
      <h3 class="list-title" on:dblclick={startEditingName}>
        {list.name || 'Untitled List'}
      </h3>
    {/if}
    
    <!-- List Items -->
    <div class="flex-grow mb-3">
      {#if list.items.length > 0 || isAddingItem}
        <ul class="list-mono-container">
          {#each sortedItems as item (item.id)}
            <li
              class="list-item-mono {item.checked ? 'checked' : ''}"
              draggable={!item.checked}
              on:dragstart={(e) => handleDragStart(e, item.id)}
              on:dragend={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
              animate:flip={{ duration: flipDuration }}
              in:fly={{ y: 20, duration: 300 }}
            >
              <input
                type="checkbox"
                id="item-{list.id}-{item.id}"
                checked={item.checked}
                on:change={() => toggleItem(item.id)}
                class="checkbox-mono"
              />
              
              {#if editingItemId === item.id}
                <input
                  id="edit-item-{list.id}-{item.id}"
                  class="mono-input"
                  placeholder="Enter item text..."
                  bind:value={editedItemText}
                  on:blur={saveItemEdit}
                  on:keydown={handleEditItemKeyDown}
                />
              {:else}
                <span 
                  class="item-text {item.checked ? 'checked' : ''}"
                  on:click|stopPropagation={() => {
                    if (!item.checked) startEditingItem(item);
                  }}
                >
                  {item.text}
                </span>
              {/if}
            </li>
          {/each}
          
          {#if completedItems.length > 0 && activeItems.length > 0}
            <div class="my-2" in:fade={{ duration: 200 }}>
              <div class="mono-divider"></div>
            </div>
          {/if}

          {#if isAddingItem}
            <li class="add-item-form fade-in">
              <input
                id="add-item-{list.id}"
                class="mono-input flex-grow"
                placeholder="Enter new item..."
                bind:value={newItemText}
                on:keydown={handleAddItemKeyDown}
              />
              <button
                class="add-btn"
                on:click|stopPropagation={handleAddItem}
                disabled={!newItemText.trim()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Add
              </button>
              <button
                class="add-btn cancel"
                on:click|stopPropagation={toggleAddItemForm}
              >
                Cancel
              </button>
            </li>
          {/if}
        </ul>
      {:else}
        <!-- Empty state -->
        <div class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p class="empty-title">This list is empty</p>
          <p class="empty-description">Add items to get started</p>
          <button
            class="add-btn"
            on:click|stopPropagation={toggleAddItemForm}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add First Item
          </button>
        </div>
      {/if}
    </div>
    
    <!-- Action Toolbar - Improved footer from latest version -->
    <div class="actions-toolbar">
      <button 
        class="action-btn" 
        on:click|stopPropagation={() => {
          handleCreateList();
        }}
        title="New List"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          <line x1="12" y1="11" x2="12" y2="17"></line>
          <line x1="9" y1="14" x2="15" y2="14"></line>
        </svg>
        <span>New List</span>
      </button>
      
      <button 
        class="action-btn add primary" 
        on:click|stopPropagation={() => {
          toggleAddItemForm();
        }}
        title="Add Item"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add Item
      </button>
      
      <button 
        class="action-btn" 
        on:click|stopPropagation={() => {
          confirmClear();
        }}
        disabled={list.items.length === 0}
        title="Clear List"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span>Clear</span>
      </button>
      
      <button 
        class="action-btn danger" 
        on:click|stopPropagation={() => {
          confirmDelete();
        }}
        title="Delete List"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span>Delete</span>
      </button>
    </div>
  </div>
</div>