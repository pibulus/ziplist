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
  class="card w-[864px] min-h-[420px] h-auto overflow-hidden flex flex-col bg-white {isActive ? `border-2 border-${themeService.getCurrentTheme()}` : 'border border-gray-200'}"
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
      {#if list.items.length > 0}
        <ul class="list">
          {#each list.items as item (item.id)}
            <li class="list-item {item.checked ? 'opacity-75' : ''} px-2 py-1 rounded hover:bg-gray-50 mb-1">
              <input
                type="checkbox"
                id="item-{list.id}-{item.id}"
                checked={item.checked}
                on:change={() => toggleItem(item.id)}
                class="form-checkbox h-5 w-5 text-{themeService.getCurrentTheme()}-600 rounded mr-3 mt-1"
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
    padding-right: 12px; /* Add some padding for the scrollbar */
    display: grid;
    grid-template-columns: repeat(3, minmax(250px, 1fr)); /* Ensure each column can fit ~9 words (min 250px width) */
    grid-gap: 12px;
  }
  
  .list-item {
    padding: 0.625rem 0.75rem;
    display: flex;
    align-items: flex-start;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 6px;
    flex-wrap: nowrap;
    min-height: 42px;
    background-color: #fafafa;
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
    line-height: 1.3;
    max-width: 100%;
    /* Ensure we can fit at least 9 average words per line (avg word ~5.5 chars + space) */
    min-width: calc(9 * 5.5ch + 9ch);
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
</style>