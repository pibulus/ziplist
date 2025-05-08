<script>
  import { createEventDispatcher } from 'svelte';
  import { themeService } from '$lib/services/theme';
  
  // List data and event handlers
  export let list = { name: '', items: [] };
  export let isActive = false;
  export let onSelect = () => {};
  export let onToggleItem = () => {};
  export let onDeleteList = () => {};
  export let onRenameList = () => {};
  export let onClearList = () => {};
  
  const dispatch = createEventDispatcher();
  
  // State variables
  let isEditingName = false;
  let editedName = '';
  
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
</script>

<div 
  class="card w-72 shadow-md h-96 overflow-hidden flex flex-col bg-white {isActive ? `border-2 border-${themeService.getCurrentTheme()}` : ''}"
  on:click={() => onSelect(list.id)}
>
  <div class="card-body p-4 flex flex-col">
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
    
    <div class="flex-grow overflow-y-auto mb-3">
      {#if list.items.length > 0}
        <ul class="list">
          {#each list.items as item (item.id)}
            <li class="list-item {item.checked ? 'opacity-75' : ''} px-2 py-1 rounded hover:bg-gray-50 mb-1">
              <input
                type="checkbox"
                id="item-{list.id}-{item.id}"
                checked={item.checked}
                on:change={() => toggleItem(item.id)}
                class="form-checkbox h-4 w-4 text-{themeService.getCurrentTheme()}-600 rounded mr-2"
              />
              <label 
                for="item-{list.id}-{item.id}" 
                class="{item.checked ? 'line-through text-gray-500' : 'text-gray-900'} break-words"
              >
                {item.text}
              </label>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="flex items-center justify-center h-full text-gray-500 italic">
          <p>This list is empty</p>
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
  }
  
  .list-item {
    padding: 0.5rem 0;
    display: flex;
    align-items: flex-start;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    flex-wrap: nowrap;
  }
  
  .list-item:last-child {
    border-bottom: none;
  }
  
  .list-item label {
    cursor: pointer;
    flex-grow: 1;
    font-size: 0.9rem;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    min-width: 0;
    padding-top: 1px;
  }
</style>