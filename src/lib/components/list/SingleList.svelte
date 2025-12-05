<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { listsStore, activeList } from '$lib/services/lists/listsStore';
  import { listsService } from '$lib/services/lists/listsService';
  import { shareList } from '$lib/services/share';
  import { hapticService } from '$lib/services/infrastructure/hapticService';
  // Dynamic import for confetti to avoid SSR issues

  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  
  // Props
  export let listId = null;

  // State variables
  let list = { name: '', items: [] };
  let draggedItemId = null;
  let dragOverItemId = null;
  let editingItemId = null;
  let editedItemText = '';
  let isCreatingNewItem = false;
  let newItemText = '';
  let shareStatus = null;
  
  // Subscribe to the appropriate list
  let unsubscribe;

  $: {
    if (unsubscribe) unsubscribe();
    if (listId) {
      unsubscribe = listsStore.subscribe(state => {
        const foundList = state.lists.find(l => l.id === listId);
        if (foundList) list = foundList;
      });
    } else {
      unsubscribe = activeList.subscribe(activeListData => {
        if (activeListData) list = activeListData;
      });
    }
  }

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });
  
  async function handleShareList() {
    if (!list || !list.items || list.items.length === 0) {
      shareStatus = { success: false, message: 'Cannot share an empty list' };
      setTimeout(() => shareStatus = null, 3000);
      return;
    }
    try {
      const result = await shareList(list);
      if (result.success) {
        shareStatus = { success: true, message: result.urlTooLong ? 'Share link copied! Note: Very long URL.' : 'Share link copied!' };
      } else {
        shareStatus = { success: false, message: 'Failed to share list' };
      }
      setTimeout(() => shareStatus = null, result.urlTooLong ? 5000 : 3000);
    } catch (error) {
      console.error('Failed to share list:', error);
      shareStatus = { success: false, message: 'Failed to share list' };
      setTimeout(() => shareStatus = null, 3000);
    }
  }
  
  $: activeItems = list.items.filter(item => !item.checked);
  $: completedItems = list.items.filter(item => item.checked);
  $: sortedItems = [...activeItems, ...completedItems];

  const textCache = new Map();
  function formatItemText(text) {
    if (textCache.has(text)) return textCache.get(text);
    const formattedText = text.split(' ').map(word =>
      word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    ).join(' ');
    if (textCache.size > 100) textCache.delete(textCache.keys().next().value);
    textCache.set(text, formattedText);
    return formattedText;
  }

  async function handleEmptyStateClick() {
    listsService.addItem('Type here...', list.id);
    await tick();
    if (list.items.length > 0) {
      const newItem = list.items[list.items.length - 1];
      startEditingItem(newItem);
      editedItemText = ''; 
    }
  }
  function getStaggerDelay(index) { return index * 50; }

  function autoFocus(node) { node.focus(); return {}; }

  function clickOutside(node, { enabled, callback }) {
    const handleClick = (event) => {
      if (enabled && !node.contains(event.target)) callback();
    };
    document.addEventListener('click', handleClick, true);
    return {
      update(params) { enabled = params.enabled; callback = params.callback; },
      destroy() { document.removeEventListener('click', handleClick, true); }
    };
  }
  
  function handleDragStart(event, itemId) {
    if (editingItemId === itemId) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    draggedItemId = itemId;
    hapticService.impact('light');
  }

  function handleDragEnd(event) {
    draggedItemId = null;
    dragOverItemId = null;
    hapticService.impact('medium');
  }

  function handleDragOver(event, itemId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggedItemId === itemId) return;
    const targetItem = list.items.find(item => item.id === itemId);
    if (targetItem?.checked) return;
    if (dragOverItemId === itemId) return;
    dragOverItemId = itemId;
    hapticService.impact('light');
  }

  function handleDrop(event, targetItemId) {
    event.preventDefault();
    dragOverItemId = null;
    if (draggedItemId === targetItemId) return;
    const targetItem = list.items.find(item => item.id === targetItemId);
    if (targetItem?.checked) return;
    hapticService.impact('heavy');
    const reorderedItems = [...list.items];
    const sourceIndex = reorderedItems.findIndex(item => item.id === draggedItemId);
    const targetIndex = reorderedItems.findIndex(item => item.id === targetItemId);
    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [movedItem] = reorderedItems.splice(sourceIndex, 1);
      reorderedItems.splice(targetIndex, 0, movedItem);
      listsService.reorderItems(reorderedItems);
    }
  }
  
  async function toggleItem(itemId, event) {
    const itemToToggle = list.items.find(item => item.id === itemId);
    if (itemToToggle) hapticService.impact(itemToToggle.checked ? 'light' : 'medium');
    listsService.toggleItem(itemId, list.id);
    if (!itemToToggle?.checked) {
      let origin = { y: 0.6 };
      if (event && event.clientX && event.clientY) {
        origin = { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight };
      }
      
      const confetti = (await import('canvas-confetti')).default;
      confetti({ particleCount: 60, spread: 60, origin: origin, colors: ['#FFB000', '#FF6AC2', '#00D4FF'], disableForReducedMotion: true });
      setTimeout(() => {
        const checkbox = document.getElementById(`item-${list.id}-${itemId}`);
        if (checkbox) {
          void checkbox.offsetWidth;
          const allCompleted = list.items.length > 1 && list.items.filter(i => i.id !== itemId).every(i => i.checked);
          if (allCompleted) {
            hapticService.notification('success');
            setTimeout(() => {
              confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#FFB000', '#FF6AC2', '#00D4FF'] });
            }, 300);
          }
        }
      }, 50);
    }
  }

  function startEditingItem(item) {
    if (item.checked) return;
    editingItemId = item.id;
    editedItemText = item.text;
  }

  function saveItemEdit() {
    if (editingItemId !== null && editedItemText.trim() !== '') {
      listsService.editItem(editingItemId, editedItemText, list.id);
      editingItemId = null;
      editedItemText = '';
    } else if (editedItemText.trim() === '') {
      listsService.removeItem(editingItemId, list.id);
      editingItemId = null;
    }
  }

  function cancelItemEdit() {
    editingItemId = null;
    editedItemText = '';
  }

  function handleEditItemKeyDown(event) {
    if (event.key === 'Enter') saveItemEdit();
    else if (event.key === 'Escape') cancelItemEdit();
  }
</script>

<div class="zl-card">
  <div class="card-content">
    <div class="zl-list-container" style="position: relative; min-height: {list.items.length > 0 ? 100 + (list.items.length * 90) : 320}px;">
      {#if list.items.length > 0}
        <ul class="zl-list" role="list" in:fade={{ duration: 200 }}>
          {#each sortedItems as item, index (item.id)}
            <li
              class="zl-item {item.checked ? 'checked' : ''} {editingItemId === item.id ? 'editing' : ''}"
              class:dragging={draggedItemId === item.id}
              class:drag-over={dragOverItemId === item.id}
              class:first-completed={item.checked && index === activeItems.length}
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
              {#if dragOverItemId === item.id}
                <div class="drop-indicator"><div class="drop-arrow"></div></div>
              {/if}

              <label class="zl-checkbox-wrapper">
                <input
                  type="checkbox"
                  id="item-{list.id}-{item.id}"
                  checked={item.checked}
                  on:change={(e) => toggleItem(item.id, e)}
                  class="zl-checkbox"
                />
                <span class="zl-checkbox-custom {item.checked ? 'animate-pop' : ''}"></span>
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
                    on:click|stopPropagation={() => { if (!item.checked) startEditingItem(item); }}
                    on:keydown={(e) => e.key === 'Enter' && !item.checked && startEditingItem(item)}
                    disabled={item.checked}
                    aria-label="Edit item: {item.text}"
                  >
                    <span class="zl-item-text {item.checked ? 'checked' : ''}">{formatItemText(item.text)}</span>
                  </button>
                {/if}
              </div>

              {#if !item.checked && editingItemId !== item.id}
                <div class="grab-indicator" aria-hidden="true" title="Drag to reorder">
                  <span></span><span></span><span></span>
                </div>
              {/if}

              <button 
                type="button" 
                class="zl-delete-button"
                on:click|stopPropagation={() => listsService.removeItem(item.id, list.id)}
                aria-label="Delete item"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="empty-state" on:click={handleEmptyStateClick} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && handleEmptyStateClick()}>
          <p>Tap to add items...</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Completed Items Divider */
  .zl-item.first-completed {
    margin-top: 3rem;
    position: relative;
  }
  .zl-item.first-completed::before {
    content: "Completed";
    position: absolute;
    top: -2rem;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--zl-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: rgba(255, 255, 255, 0.5);
    padding: 0.2rem 0.8rem;
    border-radius: 12px;
  }
  .zl-item.first-completed::after {
    content: "";
    position: absolute;
    top: -1rem;
    left: 10%;
    right: 10%;
    height: 1px;
    background: rgba(0, 0, 0, 0.1);
    z-index: -1;
  }

  /* Animation Keyframes */
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
    50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  @keyframes check-pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }
  .animate-pop { animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  
  @keyframes gradient-shift {
    0% { background-position: 0% 0%; }
    25% { background-position: 50% 50%; }
    50% { background-position: 100% 100%; }
    75% { background-position: 50% 50%; }
    100% { background-position: 0% 0%; }
  }

  .zl-card {
    border-radius: var(--zl-card-border-radius);
    border: var(--zl-card-border-width) solid var(--zl-card-border-color);
    padding: 2.5rem;
    position: relative;
    overflow: hidden;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    margin-top: 2rem;
    margin-bottom: 2.5rem;
    height: auto;
    font-family: 'Space Mono', monospace;
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
    box-shadow: var(--zl-card-box-shadow);
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    border-color: var(--list-primary, var(--zl-card-border-color));
    box-shadow: 
      var(--zl-card-box-shadow),
      0 0 20px var(--list-glow, transparent),
      0 0 40px var(--list-glow, transparent);
  }
  
  .zl-card:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 16px 40px rgba(0, 0, 0, 0.15),
      0 0 25px var(--list-glow, transparent),
      0 0 50px var(--list-glow, transparent);
    border-color: var(--list-accent, var(--zl-card-border-color));
  }

  .zl-list-container {
    position: relative;
    z-index: 1;
  }
  .zl-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .zl-item {
    display: flex;
    align-items: center;
    padding: 1rem;
    background: white;
    border-radius: 16px;
    margin-bottom: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
    transition: all 0.2s ease;
    position: relative;
    border: 1px solid transparent;
  }
  .zl-item:hover {
    transform: scale(1.01);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.04);
    z-index: 1;
  }
  .zl-item:active {
    transform: scale(0.98);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  }
  .zl-item.checked {
    background: rgba(255, 255, 255, 0.6);
    box-shadow: none;
    border: 1px solid transparent;
  }
  .zl-item.dragging {
    opacity: 0.5;
    transform: scale(1.02);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }
  .zl-item.drag-over {
    transform: translateY(10px);
  }
  
  .zl-checkbox-wrapper {
    position: relative;
    width: 24px;
    height: 24px;
    margin-right: 1rem;
    flex-shrink: 0;
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
    position: absolute;
    top: 0;
    left: 0;
    height: 24px;
    width: 24px;
    background-color: transparent;
    border: 2px solid var(--zl-text-secondary);
    border-radius: 50%;
    transition: all 0.2s ease;
  }
  .zl-checkbox:checked ~ .zl-checkbox-custom {
    background-color: var(--zl-primary-color);
    border-color: var(--zl-primary-color);
  }
  .zl-checkbox-custom:after {
    content: "";
    position: absolute;
    display: none;
    left: 7px;
    top: 3px;
    width: 6px;
    height: 12px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
  .zl-checkbox:checked ~ .zl-checkbox-custom:after {
    display: block;
  }
  
  .edit-wrapper {
    flex-grow: 1;
    margin-right: 1rem;
    min-width: 0;
  }
  .zl-item-text-button {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    text-align: left;
    width: 100%;
    color: inherit;
  }
  .zl-item-text {
    font-size: 1.1rem;
    color: var(--zl-text-primary);
    word-break: break-word;
    line-height: 1.4;
    display: block;
  }
  .zl-item-text.checked {
    text-decoration: line-through;
    color: var(--zl-text-secondary);
    opacity: 0.7;
  }
  .zl-edit-input {
    width: 100%;
    font-size: 1.1rem;
    font-family: inherit;
    border: none;
    background: transparent;
    padding: 0;
    margin: 0;
    color: var(--zl-text-primary);
    outline: none;
    border-bottom: 2px solid var(--zl-primary-color);
  }
  
  .grab-indicator {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 0.5rem;
    cursor: grab;
    opacity: 0.3;
    transition: opacity 0.2s;
  }
  .grab-indicator:hover { opacity: 0.7; }
  .grab-indicator span {
    width: 4px;
    height: 4px;
    background-color: var(--zl-text-secondary);
    border-radius: 50%;
  }
  
  .zl-delete-button {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--zl-text-secondary);
    opacity: 0;
    transition: all 0.2s;
    padding: 0.5rem;
    margin-left: 0.5rem;
    border-radius: 50%;
  }
  .zl-item:hover .zl-delete-button { opacity: 0.5; }
  .zl-delete-button:hover {
    opacity: 1 !important;
    background-color: rgba(255, 0, 0, 0.1);
    color: #ff4444;
  }

  .drop-indicator {
    position: absolute;
    top: -10px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--zl-primary-color);
    z-index: 20;
    pointer-events: none;
  }
  .drop-arrow {
    position: absolute;
    top: -6px;
    left: 50%;
    width: 14px;
    height: 14px;
    background-color: var(--zl-primary-color);
    border-radius: 50%;
    transform: translateX(-50%);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--zl-text-secondary);
    cursor: pointer;
    border: 2px dashed rgba(0,0,0,0.1);
    border-radius: 16px;
    transition: all 0.2s;
  }
  .empty-state:hover {
    background: rgba(255,255,255,0.5);
    border-color: var(--zl-primary-color);
    color: var(--zl-primary-color);
  }

  @media (max-width: 480px) {
    .zl-card {
      padding: 1.5rem;
      margin-top: 1rem;
      margin-bottom: 1.5rem;
    }
    .zl-item {
      padding: 0.8rem;
    }
  }
</style>