<script>
  import { onMount, onDestroy } from 'svelte';
  import { listsStore, activeList } from '$lib/services/lists/listsStore';
  import { listsService } from '$lib/services/lists/listsService';
  import { shareList } from '$lib/services/share';
  import { postHogService } from '$lib/services/analytics/postHogService';
  import { fade } from 'svelte/transition';
  import ListItem from './ListItem.svelte';
  import './list.css';

  // State
  let list = { name: '', items: [] };
  let draggedItemId = null;
  let dragOverItemId = null;
  let editingItemId = null;
  let shareStatus = null;

  // Subscribe to active list
  const unsubscribe = activeList.subscribe(activeListData => {
    if (activeListData) {
      list = activeListData;
    }
  });

  onMount(() => {
    listsStore.initialize();
    listsService.getAllLists();
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  // Computed values
  $: activeItems = list.items.filter(item => !item.checked);
  $: completedItems = list.items.filter(item => item.checked);
  $: sortedItems = [...activeItems, ...completedItems];

  // Share list
  async function handleShare() {
    if (!list || !list.items || list.items.length === 0) {
      shareStatus = { success: false, message: 'Cannot share an empty list' };
      setTimeout(() => shareStatus = null, 3000);
      return;
    }

    try {
      const result = await shareList(list);
      if (result.success) {
        shareStatus = { 
          success: true, 
          message: result.urlTooLong ? 'Share link copied! (Very long URL)' : 'Share link copied!' 
        };
        postHogService.trackListShared(list.items.length, true);
      } else {
        shareStatus = { success: false, message: 'Failed to share list' };
        postHogService.trackListShared(list.items.length, false);
      }
      setTimeout(() => shareStatus = null, 3000);
    } catch (error) {
      console.error('Share error:', error);
      shareStatus = { success: false, message: 'Failed to share list' };
      postHogService.trackListShared(list.items.length, false);
      setTimeout(() => shareStatus = null, 3000);
    }
  }

  // Item actions
  function handleToggle(itemId) {
    listsService.toggleItem(itemId);
  }

  function handleEdit(itemId, newText) {
    listsService.editItem(itemId, newText);
    editingItemId = null;
  }

  function handleDelete(itemId) {
    listsService.removeItem(itemId);
  }

  // Drag and drop
  function handleDragStart(event, itemId) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    draggedItemId = itemId;
  }

  function handleDragEnd() {
    draggedItemId = null;
    dragOverItemId = null;
  }

  function handleDragOver(event, itemId) {
    // Don't allow drag over checked items or self
    if (draggedItemId === itemId) return;
    const targetItem = list.items.find(item => item.id === itemId);
    if (targetItem?.checked) return;

    dragOverItemId = itemId;
  }

  function handleDrop(event, targetItemId) {
    event.preventDefault();
    dragOverItemId = null;

    if (draggedItemId === targetItemId) return;

    // Check if target is checked
    const targetItem = list.items.find(item => item.id === targetItemId);
    if (targetItem?.checked) return;

    // Reorder items
    const reorderedItems = [...list.items];
    const sourceIndex = reorderedItems.findIndex(item => item.id === draggedItemId);
    const targetIndex = reorderedItems.findIndex(item => item.id === targetItemId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [movedItem] = reorderedItems.splice(sourceIndex, 1);
      reorderedItems.splice(targetIndex, 0, movedItem);
      listsService.reorderItems(reorderedItems);
    }
  }
</script>

<div class="zl-card">
  <!-- List Header -->
  {#if list.name}
    <div class="zl-list-header">
      <h2 class="zl-list-title">{list.name}</h2>
      <button
        class="zl-share-button"
        on:click={handleShare}
        aria-label="Share list"
      >
        <span>↑</span>
        <span>Share</span>
      </button>
    </div>

    <!-- Share Status -->
    {#if shareStatus}
      <div 
        class="zl-share-notification {shareStatus.success ? 'success' : 'error'}"
        transition:fade={{ duration: 200 }}
      >
        {shareStatus.message}
      </div>
    {/if}
  {/if}

  <!-- List Items -->
  {#if list.items.length > 0}
    <ul class="zl-list">
      {#each sortedItems as item (item.id)}
        <ListItem
          {item}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          {handleDragStart}
          {handleDragEnd}
          {handleDragOver}
          {handleDrop}
          isDragging={draggedItemId === item.id}
          isDragOver={dragOverItemId === item.id}
          isEditing={editingItemId === item.id}
        />
      {/each}
    </ul>
  {:else}
    <!-- Empty State -->
    <div class="zl-empty-state" transition:fade={{ duration: 300 }}>
      <p class="zl-empty-title">Your list awaits</p>
      <p class="zl-empty-description">Hit that yellow button</p>
      <p class="zl-empty-hint">to start adding items</p>
    </div>
  {/if}
</div>
