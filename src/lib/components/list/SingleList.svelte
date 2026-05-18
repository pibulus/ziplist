<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { listsStore, activeList } from '$lib/services/lists/listsStore';
  import { listsService } from '$lib/services/lists/listsService';
  import { shareList } from '$lib/services/share';
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { hapticService } from '$lib/services/infrastructure/hapticService';
  import * as liveListsService from '$lib/services/realtime/liveListsService';
  import { getPresenceStore } from '$lib/services/realtime/presenceStore';
  import { getTypingStore } from '$lib/services/realtime/typingStore';

  // State variables
  let list = { name: '', items: [] };
  let draggedItemId = null;
  let dragOverItemId = null;
  let dragOverPosition = 'before';
  let editingItemId = null;
  let editedItemText = '';
  let draftItemActive = false;
  let draftItemText = '';
  let draftInputNode = null;
  let editingListName = false;
  let editedListName = '';
  let shareStatus = null; // To track share operation status
  let undoDelete = null;
  let undoDeleteTimer = null;
  let previousListIdentity = null;
  let isLive = false; // Track if this list is live
  let liveFeatureAvailable = false;
  let presence = []; // Who's online
  let typingUsers = []; // Who's typing
  let recentlyEditedItems = new Set(); // Track items just edited by others
  let settlingItemIds = new Set(); // Brief bounce after check, uncheck, or reorder
  let typingTimeout = null; // Debounce typing broadcasts
  let listContainerNode = null;
  const itemNodes = new Map();
  const settlingTimers = new Map();
  const MOBILE_REORDER_LONG_PRESS_MS = 320;
  const MOBILE_REORDER_CANCEL_DISTANCE_PX = 16;
  const MOBILE_REORDER_AUTO_SCROLL_EDGE_PX = 88;
  let touchDragPreviewItems = null;
  let touchDragItemId = null;
  let touchDragPendingItemId = null;
  let touchDragPendingTouchId = null;
  let touchDragStartX = 0;
  let touchDragStartY = 0;
  let touchDragCurrentY = 0;
  let touchDragGhostRect = null;
  let touchDragPointerOffsetY = 0;
  let touchDragTargetIndex = -1;
  let touchDragLongPressTimer = null;
  let touchDragAutoScrollDelta = 0;
  let touchDragAutoScrollFrame = null;
  let touchDragListenersAttached = false;

  // Props
  export let listId = null;
  export let showListManagement = true;

  // Subscribe to the appropriate list
  let unsubscribe;
  let subscribedListId;

  $: if (subscribedListId !== listId) {
    subscribeToList(listId);
    subscribedListId = listId;
  }

  function subscribeToList(nextListId) {
    if (unsubscribe) unsubscribe();
    if (nextListId) {
      unsubscribe = listsStore.subscribe(state => {
        const foundList = state.lists.find(l => l.id === nextListId);
        if (foundList) list = foundList;
      });
    } else {
      unsubscribe = activeList.subscribe(activeListData => {
        if (activeListData) list = activeListData;
      });
    }
  }

  $: liveFeatureAvailable = liveListsService.isLiveCollaborationAvailable();
  $: if (!editingListName) {
    editedListName = list.name || '';
  }
  $: if (list.id && previousListIdentity !== list.id) {
    if (previousListIdentity !== null) {
      draftItemActive = false;
      draftItemText = '';
      editingItemId = null;
      editedItemText = '';
    }
    previousListIdentity = list.id;
  }

  // Subscribe to presence and typing for this list
  let presenceUnsubscribe = null;
  let typingUnsubscribe = null;

  onMount(() => {
    // Initialize the lists store
    listsStore.initialize();
    listsService.getAllLists();

    // Check if this list is already live
    if (list && list.id) {
      isLive = liveListsService.isLive(list.id);
      if (isLive) {
        // Subscribe to presence
        const presenceStore = getPresenceStore(list.id);
        presenceUnsubscribe = presenceStore.subscribe(users => {
          presence = users;
        });

        // Subscribe to typing indicators
        const typingStore = getTypingStore(list.id);
        typingUnsubscribe = typingStore.subscribe(users => {
          typingUsers = users;
        });
      }
    }
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
    if (presenceUnsubscribe) presenceUnsubscribe();
    if (typingUnsubscribe) typingUnsubscribe();
    if (typingTimeout) clearTimeout(typingTimeout);
    if (undoDeleteTimer) clearTimeout(undoDeleteTimer);
    clearTouchDragLongPressTimer();
    stopTouchDragAutoScroll();
    removeTouchDragListeners();
    settlingTimers.forEach(timer => clearTimeout(timer));
    settlingTimers.clear();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('zl-touch-dragging');
    }
  });

  // Share list function
  async function handleShareList() {
    if (!list || !list.items || list.items.length === 0) {
      shareStatus = { success: false, message: 'Cannot share an empty list' };
      setTimeout(() => shareStatus = null, 3000); // Clear message after 3 seconds
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

  // Make list live (real-time collaboration)
  async function handleMakeLive() {
    if (!liveFeatureAvailable) {
      shareStatus = {
        success: false,
        message: 'Live collaboration is not configured on this deployment yet'
      };
      setTimeout(() => shareStatus = null, 4000);
      return;
    }

    if (!list || !list.id) {
      shareStatus = { success: false, message: 'Cannot make list live' };
      setTimeout(() => shareStatus = null, 3000);
      return;
    }

    try {
      const { shareUrl } = await liveListsService.makeLive(list.id);
      isLive = true;

      // Copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }

      shareStatus = { success: true, message: '🔴 List is now LIVE! Link copied!' };
      setTimeout(() => shareStatus = null, 3000);

      // Subscribe to presence
      const presenceStore = getPresenceStore(list.id);
      presenceUnsubscribe = presenceStore.subscribe(users => {
        presence = users;
      });

      // Subscribe to typing indicators
      const typingStore = getTypingStore(list.id);
      typingUnsubscribe = typingStore.subscribe(users => {
        typingUsers = users;
      });
    } catch (error) {
      console.error('Failed to make list live:', error);
      shareStatus = { success: false, message: 'Failed to make list live: ' + error.message };
      setTimeout(() => shareStatus = null, 5000);
    }
  }

  function handleCreateList() {
    listsService.createList();
    hapticService.notification('success');
  }

  function startEditingListName() {
    if (!showListManagement || !list?.id) return;
    editingListName = true;
    editedListName = list.name || '';
    hapticService.selection();
  }

  function saveListName() {
    if (!editingListName) return;

    const nextName = editedListName.trim();
    editingListName = false;

    if (!nextName || nextName === list.name) {
      editedListName = list.name || '';
      return;
    }

    listsStore.renameList(nextName, list.id);
    hapticService.impact('light');
  }

  function cancelListNameEdit() {
    editingListName = false;
    editedListName = list.name || '';
  }

  function handleListNameKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveListName();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelListNameEdit();
    }
  }

  // Separated active and completed items
  $: activeItems = list.items.filter(item => !item.checked);
  $: completedItems = list.items.filter(item => item.checked);

  // Sort items - active items first, completed items last
  $: sortedItems = touchDragPreviewItems || [...activeItems, ...completedItems];
  $: renderedActiveItems = sortedItems.filter(item => !item.checked);
  $: renderedCompletedItems = sortedItems.filter(item => item.checked);
  $: touchDraggedItem = touchDragItemId
    ? list.items.find(item => item.id === touchDragItemId) || null
    : null;
  $: touchGhostStyle = touchDraggedItem && touchDragGhostRect
    ? `top: ${touchDragCurrentY - touchDragPointerOffsetY}px; left: ${touchDragGhostRect.left}px; width: ${touchDragGhostRect.width}px;`
    : '';

  // Track previous item IDs to detect new items (from remote users)
  let previousItemIds = new Set();
  $: {
    // Detect newly added items
    const currentItemIds = new Set(list.items.map(item => item.id));
    const newItemIds = [...currentItemIds].filter(id => !previousItemIds.has(id));

    // Add glow effect to new items (only if we're in a live session)
    if (isLive && newItemIds.length > 0 && previousItemIds.size > 0) {
      newItemIds.forEach(id => {
        recentlyEditedItems.add(id);
        // Remove glow after 2 seconds
        setTimeout(() => {
          recentlyEditedItems.delete(id);
          recentlyEditedItems = recentlyEditedItems; // Trigger reactivity
        }, 2000);
      });
      recentlyEditedItems = recentlyEditedItems; // Trigger reactivity
    }

    previousItemIds = currentItemIds;
  }

  // Handle typing broadcast
  function handleTyping() {
    if (!isLive) return;

    // Broadcast typing start
    liveListsService.broadcastTypingStart(list.id);

    // Debounce typing stop
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      liveListsService.broadcastTypingStop(list.id);
      typingTimeout = null;
    }, 2000);
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

  function registerItemNode(node, itemId) {
    itemNodes.set(itemId, node);

    return {
      update(nextItemId) {
        if (nextItemId === itemId) return;
        itemNodes.delete(itemId);
        itemId = nextItemId;
        itemNodes.set(itemId, node);
      },
      destroy() {
        itemNodes.delete(itemId);
      }
    };
  }

  function clearTouchDragLongPressTimer() {
    if (touchDragLongPressTimer) {
      clearTimeout(touchDragLongPressTimer);
      touchDragLongPressTimer = null;
    }
  }

  function stopTouchDragAutoScroll() {
    if (touchDragAutoScrollFrame) {
      cancelAnimationFrame(touchDragAutoScrollFrame);
      touchDragAutoScrollFrame = null;
    }
    touchDragAutoScrollDelta = 0;
  }

  function addTouchDragListeners() {
    if (touchDragListenersAttached || typeof window === 'undefined') {
      return;
    }

    window.addEventListener('touchmove', handleTouchGrabMove, { passive: false });
    window.addEventListener('touchend', handleTouchGrabEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchGrabCancel, { passive: false });
    touchDragListenersAttached = true;
  }

  function removeTouchDragListeners() {
    if (!touchDragListenersAttached || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('touchmove', handleTouchGrabMove);
    window.removeEventListener('touchend', handleTouchGrabEnd);
    window.removeEventListener('touchcancel', handleTouchGrabCancel);
    touchDragListenersAttached = false;
  }

  function getTrackedTouch(event) {
    if (touchDragPendingTouchId === null) return null;

    return [...event.changedTouches, ...event.touches].find(
      (touch) => touch.identifier === touchDragPendingTouchId
    ) || null;
  }

  function getTouchDragScrollContainer() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return null;
    }

    let currentNode = listContainerNode;

    while (currentNode && currentNode !== document.body) {
      if (currentNode instanceof HTMLElement) {
        const styles = window.getComputedStyle(currentNode);
        const overflowY = styles.overflowY;
        const isScrollable =
          /(auto|scroll|overlay)/.test(overflowY) &&
          currentNode.scrollHeight > currentNode.clientHeight;

        if (isScrollable) {
          return currentNode;
        }
      }

      currentNode = currentNode.parentElement;
    }

    return window;
  }

  function resetTouchDragState() {
    clearTouchDragLongPressTimer();
    stopTouchDragAutoScroll();
    removeTouchDragListeners();

    touchDragPreviewItems = null;
    touchDragItemId = null;
    touchDragPendingItemId = null;
    touchDragPendingTouchId = null;
    touchDragGhostRect = null;
    touchDragPointerOffsetY = 0;
    touchDragTargetIndex = -1;

    if (typeof document !== 'undefined') {
      document.body.classList.remove('zl-touch-dragging');
    }
  }

  function buildTouchPreviewItems(targetIndex) {
    const draggedItem = activeItems.find(item => item.id === touchDragItemId);
    if (!draggedItem) return null;

    const movableItems = activeItems.filter(item => item.id !== touchDragItemId);
    const clampedIndex = Math.max(0, Math.min(targetIndex, movableItems.length));
    const reorderedActiveItems = [...movableItems];

    reorderedActiveItems.splice(clampedIndex, 0, draggedItem);

    return [...reorderedActiveItems, ...completedItems];
  }

  function updateTouchDragPreview(clientY) {
    if (!touchDragItemId) return;

    const movableItems = activeItems.filter(item => item.id !== touchDragItemId);
    let nextTargetIndex = movableItems.length;

    for (let i = 0; i < movableItems.length; i += 1) {
      const node = itemNodes.get(movableItems[i].id);
      if (!node) continue;

      const rect = node.getBoundingClientRect();
      const midpointY = rect.top + rect.height / 2;

      if (clientY < midpointY) {
        nextTargetIndex = i;
        break;
      }
    }

    if (nextTargetIndex === touchDragTargetIndex) return;

    touchDragTargetIndex = nextTargetIndex;
    touchDragPreviewItems = buildTouchPreviewItems(nextTargetIndex);
    hapticService.dragMove();
  }

  function runTouchDragAutoScroll() {
    const scrollContainer = getTouchDragScrollContainer();

    if (!touchDragItemId || !touchDragAutoScrollDelta || !scrollContainer) {
      touchDragAutoScrollFrame = null;
      return;
    }

    if (scrollContainer === window) {
      window.scrollBy({
        top: touchDragAutoScrollDelta,
        behavior: 'auto'
      });
    } else {
      scrollContainer.scrollTop += touchDragAutoScrollDelta;
    }

    updateTouchDragPreview(touchDragCurrentY);
    touchDragAutoScrollFrame = requestAnimationFrame(runTouchDragAutoScroll);
  }

  function updateTouchDragAutoScroll(clientY) {
    const scrollContainer = getTouchDragScrollContainer();
    if (!scrollContainer || typeof window === 'undefined') return;

    const scrollBounds = scrollContainer === window
      ? { top: 0, bottom: window.innerHeight }
      : scrollContainer.getBoundingClientRect();
    const topEdgeDistance = clientY - scrollBounds.top;
    const bottomEdgeDistance = scrollBounds.bottom - clientY;
    let nextDelta = 0;

    if (topEdgeDistance < MOBILE_REORDER_AUTO_SCROLL_EDGE_PX) {
      nextDelta = -Math.max(4, Math.round((MOBILE_REORDER_AUTO_SCROLL_EDGE_PX - topEdgeDistance) / 10));
    } else if (bottomEdgeDistance < MOBILE_REORDER_AUTO_SCROLL_EDGE_PX) {
      nextDelta = Math.max(4, Math.round((MOBILE_REORDER_AUTO_SCROLL_EDGE_PX - bottomEdgeDistance) / 10));
    }

    touchDragAutoScrollDelta = nextDelta;

    if (nextDelta !== 0 && !touchDragAutoScrollFrame) {
      touchDragAutoScrollFrame = requestAnimationFrame(runTouchDragAutoScroll);
      return;
    }

    if (nextDelta === 0) {
      stopTouchDragAutoScroll();
    }
  }

  function startTouchDrag() {
    clearTouchDragLongPressTimer();

    const draggedNode = itemNodes.get(touchDragPendingItemId);
    if (!draggedNode) {
      resetTouchDragState();
      return;
    }

    const activeIndex = activeItems.findIndex(item => item.id === touchDragPendingItemId);
    if (activeIndex === -1) {
      resetTouchDragState();
      return;
    }

    const rect = draggedNode.getBoundingClientRect();
    touchDragItemId = touchDragPendingItemId;
    touchDragPointerOffsetY = touchDragStartY - rect.top;
    touchDragGhostRect = {
      left: rect.left,
      width: rect.width,
      height: rect.height
    };
    touchDragTargetIndex = activeIndex;
    touchDragPreviewItems = [...activeItems, ...completedItems];

    if (typeof document !== 'undefined') {
      document.body.classList.add('zl-touch-dragging');
    }

    hapticService.dragStart();
  }

  function handleTouchGrabStart(event, itemId) {
    if (
      event.touches.length !== 1 ||
      editingItemId === itemId ||
      activeItems.length < 2
    ) {
      return;
    }

    clearTouchDragLongPressTimer();
    stopTouchDragAutoScroll();
    addTouchDragListeners();

    const touch = event.changedTouches[0];
    touchDragPendingItemId = itemId;
    touchDragPendingTouchId = touch.identifier;
    touchDragStartX = touch.clientX;
    touchDragStartY = touch.clientY;
    touchDragCurrentY = touch.clientY;
    touchDragLongPressTimer = setTimeout(startTouchDrag, MOBILE_REORDER_LONG_PRESS_MS);
  }

  function handleTouchGrabMove(event) {
    const touch = getTrackedTouch(event);
    if (!touch) return;

    const diffX = touch.clientX - touchDragStartX;
    const diffY = touch.clientY - touchDragStartY;

    if (!touchDragItemId) {
      if (
        Math.abs(diffX) > MOBILE_REORDER_CANCEL_DISTANCE_PX ||
        Math.abs(diffY) > MOBILE_REORDER_CANCEL_DISTANCE_PX
      ) {
        resetTouchDragState();
      }
      return;
    }

    event.preventDefault();
    touchDragCurrentY = touch.clientY;
    updateTouchDragPreview(touch.clientY);
    updateTouchDragAutoScroll(touch.clientY);
  }

  function finishTouchDrag(commitChange) {
    if (!touchDragItemId) {
      resetTouchDragState();
      return;
    }

    const currentOrder = [...activeItems, ...completedItems].map(item => item.id);
    const nextOrder = (touchDragPreviewItems || [...activeItems, ...completedItems]).map(item => item.id);
    const didMove = currentOrder.join('|') !== nextOrder.join('|');

    if (commitChange && didMove && touchDragPreviewItems) {
      listsService.reorderItems(touchDragPreviewItems, list.id);
      hapticService.dragEnd();
      markItemSettling(touchDragItemId);
    } else {
      hapticService.selection();
    }

    resetTouchDragState();
  }

  function handleTouchGrabEnd(event) {
    const touch = getTrackedTouch(event);
    if (!touch) return;

    if (touchDragItemId) {
      event.preventDefault();
    }

    finishTouchDrag(true);
  }

  function handleTouchGrabCancel(event) {
    const touch = getTrackedTouch(event);
    if (!touch) return;

    if (touchDragItemId) {
      event.preventDefault();
    }

    resetTouchDragState();
  }

  // Drag and drop functions
  function handleDragStart(event, itemId) {
    // Prevent dragging if item is being edited
    if (editingItemId === itemId) {
      event.preventDefault();
      return;
    }

    // Set data and styling
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    draggedItemId = itemId;

    // Haptic feedback
    hapticService.impact('light');
  }

  function handleDragEnd() {
    // Remove styling
    draggedItemId = null;
    dragOverItemId = null;
    dragOverPosition = 'before';

    // Haptic feedback
    hapticService.impact('medium');
  }

  function handleDragOver(event, itemId) {
    // Prevent default to allow drop
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (!draggedItemId) {
      dragOverItemId = null;
      dragOverPosition = 'before';
      return;
    }

    // Don't allow drag over on checked items or the dragged item itself
    if (draggedItemId === itemId) {
      dragOverItemId = null;
      dragOverPosition = 'before';
      return;
    }

    // Get the target item to check if it's checked
    const targetItem = list.items.find(item => item.id === itemId);
    if (targetItem?.checked) {
      dragOverItemId = null;
      dragOverPosition = 'before';
      return;
    }

    const targetBounds = event.currentTarget.getBoundingClientRect();
    const nextPosition = event.clientY > targetBounds.top + targetBounds.height / 2
      ? 'after'
      : 'before';

    // Only update if we're moving to a new item
    if (dragOverItemId === itemId && dragOverPosition === nextPosition) return;

    // Update dragover state
    dragOverItemId = itemId;
    dragOverPosition = nextPosition;

    // Haptic feedback
    hapticService.impact('light');
  }

  function handleDrop(event, targetItemId) {
    // Prevent default action
    event.preventDefault();

    dragOverItemId = null;

    if (!draggedItemId) {
      dragOverPosition = 'before';
      return;
    }

    // If dropped on itself, do nothing
    if (draggedItemId === targetItemId) {
      dragOverPosition = 'before';
      return;
    }

    // Check if target is a completed item (don't allow dropping on completed items)
    const targetItem = list.items.find(item => item.id === targetItemId);
    if (targetItem?.checked) {
      dragOverPosition = 'before';
      return;
    }

    // Haptic feedback - stronger for successful drop
    hapticService.impact('heavy');

    // Reorder only active items, then keep completed items anchored at the bottom.
    const reorderedActiveItems = [...activeItems];
    const sourceIndex = reorderedActiveItems.findIndex(item => item.id === draggedItemId);
    const targetIndex = reorderedActiveItems.findIndex(item => item.id === targetItemId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const targetBounds = event.currentTarget.getBoundingClientRect();
      const insertAfter =
        dragOverPosition === 'after' ||
        event.clientY > targetBounds.top + targetBounds.height / 2;
      let destinationIndex = targetIndex + (insertAfter ? 1 : 0);
      const [movedItem] = reorderedActiveItems.splice(sourceIndex, 1);

      if (sourceIndex < destinationIndex) {
        destinationIndex -= 1;
      }

      reorderedActiveItems.splice(destinationIndex, 0, movedItem);

      // Update the list with the new order
      listsService.reorderItems([...reorderedActiveItems, ...completedItems], list.id);
      markItemSettling(draggedItemId);
    }

    dragOverPosition = 'before';
  }

  function moveActiveItem(itemId, direction) {
    const sourceIndex = activeItems.findIndex(item => item.id === itemId);
    const destinationIndex = sourceIndex + direction;

    if (
      sourceIndex === -1 ||
      destinationIndex < 0 ||
      destinationIndex >= activeItems.length
    ) {
      hapticService.selection();
      return;
    }

    const reorderedActiveItems = [...activeItems];
    const [movedItem] = reorderedActiveItems.splice(sourceIndex, 1);
    reorderedActiveItems.splice(destinationIndex, 0, movedItem);

    listsService.reorderItems([...reorderedActiveItems, ...completedItems], list.id);
    markItemSettling(itemId);
    hapticService.selection();
  }

  function handleReorderKeyDown(event, itemId) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveItem(itemId, -1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveItem(itemId, 1);
    }
  }

  function markItemSettling(itemId) {
    if (!itemId) return;

    const existingTimer = settlingTimers.get(itemId);
    if (existingTimer) clearTimeout(existingTimer);

    settlingItemIds = new Set([...settlingItemIds, itemId]);

    const timer = setTimeout(() => {
      settlingItemIds.delete(itemId);
      settlingItemIds = new Set(settlingItemIds);
      settlingTimers.delete(itemId);
    }, 280);

    settlingTimers.set(itemId, timer);
  }

  // Handle item toggle with sparkle animation
  async function toggleItem(itemId, event) {
    const itemToToggle = list.items.find(item => item.id === itemId);

    // Apply haptic feedback
    if (itemToToggle) {
      hapticService.impact(itemToToggle.checked ? 'light' : 'medium');
    }

    // Toggle the item state
    listsService.toggleItem(itemId, list.id);
    markItemSettling(itemId);

    // If checking the item (not unchecking), add sparkle animation
    if (!itemToToggle?.checked) {
      // Get click coordinates if available for origin
      let origin = { y: 0.6 };
      if (event && event.clientX && event.clientY) {
        origin = {
          x: event.clientX / window.innerWidth,
          y: event.clientY / window.innerHeight
        };
      }

      const confetti = (await import('canvas-confetti')).default;
      confetti({
        particleCount: 60,
        spread: 60,
        origin: origin,
        colors: ['#FFB000', '#FF6AC2', '#00D4FF'], // Use app colors
        disableForReducedMotion: true
      });

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
          if (allCompleted) {
            hapticService.notification('success');

            // Extra confetti for finishing the list!
            setTimeout(() => {
              confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 },
                colors: ['#FFB000', '#FF6AC2', '#00D4FF']
              });
            }, 300);
          }
        }
      }, 50);
    }
  }

  function startEditingItem(item) {
    if (item.checked) return;
    draftItemActive = false;
    draftItemText = '';
    editingItemId = item.id;
    editedItemText = item.text;
  }

  function saveItemEdit() {
    if (editingItemId === null) return;

    const itemId = editingItemId;
    const nextText = editedItemText.trim();

    if (nextText) {
      listsService.editItem(itemId, nextText, list.id);
      hapticService.selection();
      editingItemId = null;
      editedItemText = '';
    } else {
      deleteItem(itemId);
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

  function deleteItem(itemId) {
    if (editingItemId === itemId) {
      cancelItemEdit();
    }

    const deletedItem = list.items.find(item => item.id === itemId);
    const originalIndex = list.items.findIndex(item => item.id === itemId);

    hapticService.impact('light');
    listsService.removeItem(itemId, list.id);

    if (deletedItem) {
      if (undoDeleteTimer) clearTimeout(undoDeleteTimer);

      undoDelete = {
        item: deletedItem,
        listId: list.id,
        originalIndex,
      };

      undoDeleteTimer = setTimeout(() => {
        undoDelete = null;
        undoDeleteTimer = null;
      }, 4500);
    }
  }

  function restoreDeletedItem() {
    if (!undoDelete || undoDelete.listId !== list.id) return;

    const currentItems = list.items.filter(item => item.id !== undoDelete.item.id);
    const insertIndex = Math.min(undoDelete.originalIndex, currentItems.length);
    const restoredItems = [
      ...currentItems.slice(0, insertIndex),
      undoDelete.item,
      ...currentItems.slice(insertIndex),
    ];

    listsStore.upsertList(
      {
        ...list,
        items: restoredItems,
        updatedAt: new Date().toISOString(),
      },
      list.id,
    );

    hapticService.selection();
    undoDelete = null;

    if (undoDeleteTimer) {
      clearTimeout(undoDeleteTimer);
      undoDeleteTimer = null;
    }
  }

  async function startDraftItem() {
    hapticService.selection();
    editingItemId = null;
    editedItemText = '';
    draftItemActive = true;
    draftItemText = '';

    await tick();
    draftInputNode?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    draftInputNode?.focus();
  }

  function saveDraftItem() {
    const newText = draftItemText.trim();

    if (newText) {
      const added = listsService.addItem(newText, list.id);
      if (!added) {
        hapticService.notification('warning');
        return;
      }
    }

    hapticService.selection();
    draftItemActive = false;
    draftItemText = '';
  }

  function cancelDraftItem() {
    draftItemActive = false;
    draftItemText = '';
    hapticService.selection();
  }

  function handleDraftItemKeyDown(event) {
    if (event.key === 'Enter') {
      saveDraftItem();
    } else if (event.key === 'Escape') {
      cancelDraftItem();
    }
  }

  async function handleAddItemClick() {
    await startDraftItem();
  }

  async function handleEmptyStateClick() {
    await handleAddItemClick();
  }
</script>

<div class="zl-card">
  <div class="card-content">

    <!-- List Header with Live Collaboration Toggle -->
    <div class="zl-list-header">
      <div class="zl-list-header-main">
        {#if showListManagement && editingListName}
          <input
            class="zl-list-title-input"
            bind:value={editedListName}
            on:blur={saveListName}
            on:keydown={handleListNameKeyDown}
            on:focus={(event) => event.currentTarget.select()}
            aria-label="List name"
            maxlength="40"
            use:autoFocus
          />
        {:else}
          <div class="zl-list-title-row">
            {#if showListManagement}
              <button
                type="button"
                class="zl-list-title-trigger"
                on:click={startEditingListName}
                aria-label="Rename list"
              >
                <span class="zl-list-title">{list.name || 'Your List'}</span>
              </button>
              <button
                type="button"
                class="zl-title-edit-button"
                on:click={startEditingListName}
              >
                Rename
              </button>
            {:else}
              <h2 class="zl-list-title">{list.name || 'Your List'}</h2>
            {/if}
          </div>
        {/if}
        {#if isLive}
          <div class="flex items-center gap-2 mt-1">
            <div class="zl-presence-dots">
              {#each presence as user (user.id)}
                <div
                  class="zl-presence-dot"
                  title={user.avatar}
                  style="background-color: {user.avatar.includes('Fox') ? '#ff6b6b' : user.avatar.includes('Frog') ? '#51cf66' : '#4dabf7'}"
                ></div>
              {/each}
            </div>
            <span class="text-xs font-bold text-red-500 animate-pulse">LIVE</span>
          </div>
        {/if}
      </div>

      <div class="zl-list-actions">
        {#if showListManagement}
          <button
            class="zl-add-list-button"
            on:click={handleCreateList}
            title="Create a new list"
          >
            <span class="add-icon">+</span>
            <span class="add-text">New List</span>
          </button>
        {/if}
        {#if liveFeatureAvailable}
          {#if !isLive}
            <button
              class="zl-live-button"
              on:click={handleMakeLive}
              title="Enable real-time collaboration"
            >
              <span class="live-icon">🔴</span>
              <span class="live-text">Make Live</span>
            </button>
          {:else}
            <div class="zl-live-indicator">
              <span class="live-pulse">🔴</span>
              <span class="live-count">{presence.length}</span>
            </div>
          {/if}
        {/if}

        <button
          class="zl-share-button"
          on:click={handleShareList}
          title="Share list link"
        >
          <span class="share-icon">🔗</span>
          <span class="share-text">Share</span>
        </button>
      </div>
    </div>

    <!-- Share status notification -->
    {#if shareStatus}
      <div
        class="zl-share-notification {shareStatus.success ? 'success' : 'error'}"
        transition:fade={{duration: 200}}
      >
        {shareStatus.message}
      </div>
    {/if}

    {#if undoDelete && undoDelete.listId === list.id}
      <div class="zl-undo-toast" transition:fade={{ duration: 180 }}>
        <span class="zl-undo-text">Deleted {undoDelete.item.text}</span>
        <button
          type="button"
          class="zl-undo-button"
          data-swipe-ignore="true"
          on:click={restoreDeletedItem}
        >
          Undo
        </button>
      </div>
    {/if}

    <!-- Typing indicator -->
    {#if isLive && typingUsers.length > 0}
      <div class="typing-indicator" in:fade={{ duration: 200 }}>
        <span class="typing-avatar">{typingUsers[0].avatar}</span> is adding an item
        <span class="typing-dots">
          <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
        </span>
      </div>
    {/if}

    <!-- List Items -->
    <div
      class="zl-list-container"
      bind:this={listContainerNode}
    >
      {#if list.items.length > 0 || draftItemActive}
        <ul class="zl-list" role="list" in:fade={{ duration: 200 }}>
          {#each renderedActiveItems as item, index (item.id)}
            <li
              class="zl-item {item.checked ? 'checked' : ''} {editingItemId === item.id ? 'editing' : ''}"
              class:dragging={draggedItemId === item.id}
              class:drag-over={dragOverItemId === item.id}
              class:drag-over-after={dragOverItemId === item.id && dragOverPosition === 'after'}
              class:just-edited={recentlyEditedItems.has(item.id)}
              class:settling={settlingItemIds.has(item.id)}
              class:touch-placeholder={touchDragItemId === item.id}
              draggable={!item.checked && editingItemId !== item.id && !touchDragItemId}
              on:dragstart|passive={(e) => handleDragStart(e, item.id)}
              on:dragend|passive={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
              animate:flip={{ duration: touchDragItemId ? 180 : 300 }}
              in:fly={{ y: 20, duration: 300, delay: getStaggerDelay(index) }}
              aria-grabbed={draggedItemId === item.id || touchDragItemId === item.id ? 'true' : 'false'}
              aria-dropeffect="move"
              role="listitem"
              use:registerItemNode={item.id}
            >
              {#if dragOverItemId === item.id}
                <div class="drop-indicator" class:after={dragOverPosition === 'after'}>
                  <div class="drop-arrow"></div>
                </div>
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
                    on:input={handleTyping}
                    transition:fade={{ duration: 150 }}
                    use:autoFocus
                  />
                {:else}
                  <button
                    type="button"
                    class="zl-item-text-button {item.checked ? 'checked' : ''}"
                    on:click|stopPropagation={() => {
                      if (!item.checked) startEditingItem(item);
                    }}
                    on:keydown={(e) =>
                      e.key === 'Enter' && !item.checked && startEditingItem(item)}
                    disabled={item.checked}
                    aria-label={item.checked
                      ? `Completed item: ${item.text}`
                      : `Edit item: ${item.text}`}
                  >
                    <span class="zl-item-text {item.checked ? 'checked' : ''}">
                      {item.text}
                    </span>
                  </button>
                {/if}
              </div>

              {#if !item.checked && editingItemId !== item.id && activeItems.length > 1}
                <button
                  type="button"
                  class="grab-indicator"
                  class:touch-active={touchDragItemId === item.id}
                  data-swipe-ignore="true"
                  aria-label={`Reorder ${item.text}`}
                  title="Press and hold to reorder"
                  on:click|stopPropagation={() => hapticService.selection()}
                  on:keydown={(event) => handleReorderKeyDown(event, item.id)}
                  on:touchstart={(event) => handleTouchGrabStart(event, item.id)}
                >
                  <span></span>
                  <span></span>
                  <span></span>
                </button>
              {/if}

              <button
                type="button"
                class="zl-delete-button"
                data-swipe-ignore="true"
                on:click|stopPropagation={() => deleteItem(item.id)}
                aria-label={`Delete ${item.text}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </li>
          {/each}

          {#if draftItemActive}
            <li
              class="zl-item editing zl-draft-item"
              in:fly={{ y: 20, duration: 220, delay: getStaggerDelay(renderedActiveItems.length) }}
              out:fly={{ y: -12, duration: 180 }}
              role="listitem"
            >
              <div class="zl-checkbox-wrapper zl-draft-checkbox" aria-hidden="true">
                <span class="zl-checkbox-custom"></span>
              </div>

              <div class="edit-wrapper">
                <input
                  id="draft-item-{list.id}"
                  class="zl-edit-input zl-draft-input"
                  placeholder="New item..."
                  bind:value={draftItemText}
                  bind:this={draftInputNode}
                  on:blur={saveDraftItem}
                  on:keydown={handleDraftItemKeyDown}
                  on:input={handleTyping}
                  transition:fade={{ duration: 150 }}
                  use:autoFocus
                />
              </div>

              <button
                type="button"
                class="zl-delete-button zl-draft-cancel"
                data-swipe-ignore="true"
                on:pointerdown|preventDefault
                on:click|stopPropagation={cancelDraftItem}
                aria-label="Cancel new item"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </li>
          {:else}
            <li class="zl-add-row" role="listitem">
              <button
                type="button"
                class="zl-add-item-button"
                on:click={handleAddItemClick}
                aria-label="Add item"
              >
                <span class="zl-add-item-icon">+</span>
                <span>Add item</span>
              </button>
            </li>
          {/if}

          {#if completedItems.length > 0}
            <li
              class="zl-completed-divider"
              role="listitem"
              aria-label="{completedItems.length} completed items"
            >
              <span class="zl-completed-line"></span>
              <span class="zl-completed-label">Done</span>
              <span class="zl-completed-count">{completedItems.length}</span>
              <span class="zl-completed-line"></span>
            </li>
          {/if}

          {#each renderedCompletedItems as item, index (item.id)}
            <li
              class="zl-item {item.checked ? 'checked' : ''} {editingItemId === item.id ? 'editing' : ''}"
              class:dragging={draggedItemId === item.id}
              class:drag-over={dragOverItemId === item.id}
              class:drag-over-after={dragOverItemId === item.id && dragOverPosition === 'after'}
              class:just-edited={recentlyEditedItems.has(item.id)}
              class:settling={settlingItemIds.has(item.id)}
              class:touch-placeholder={touchDragItemId === item.id}
              draggable={!item.checked && editingItemId !== item.id && !touchDragItemId}
              on:dragstart|passive={(e) => handleDragStart(e, item.id)}
              on:dragend|passive={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
              animate:flip={{ duration: touchDragItemId ? 180 : 300 }}
              in:fly={{
                y: 20,
                duration: 300,
                delay: getStaggerDelay(renderedActiveItems.length + index + 1),
              }}
              aria-grabbed={draggedItemId === item.id || touchDragItemId === item.id ? 'true' : 'false'}
              aria-dropeffect="move"
              role="listitem"
              use:registerItemNode={item.id}
            >
              {#if dragOverItemId === item.id}
                <div class="drop-indicator" class:after={dragOverPosition === 'after'}>
                  <div class="drop-arrow"></div>
                </div>
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
                    on:input={handleTyping}
                    transition:fade={{ duration: 150 }}
                    use:autoFocus
                  />
                {:else}
                  <button
                    type="button"
                    class="zl-item-text-button {item.checked ? 'checked' : ''}"
                    on:click|stopPropagation={() => {
                      if (!item.checked) startEditingItem(item);
                    }}
                    on:keydown={(e) =>
                      e.key === 'Enter' && !item.checked && startEditingItem(item)}
                    disabled={item.checked}
                    aria-label={item.checked
                      ? `Completed item: ${item.text}`
                      : `Edit item: ${item.text}`}
                  >
                    <span class="zl-item-text {item.checked ? 'checked' : ''}">
                      {item.text}
                    </span>
                  </button>
                {/if}
              </div>

              {#if !item.checked && editingItemId !== item.id && activeItems.length > 1}
                <button
                  type="button"
                  class="grab-indicator"
                  class:touch-active={touchDragItemId === item.id}
                  data-swipe-ignore="true"
                  aria-label={`Reorder ${item.text}`}
                  title="Press and hold to reorder"
                  on:click|stopPropagation={() => hapticService.selection()}
                  on:keydown={(event) => handleReorderKeyDown(event, item.id)}
                  on:touchstart={(event) => handleTouchGrabStart(event, item.id)}
                >
                  <span></span>
                  <span></span>
                  <span></span>
                </button>
              {/if}

              <button
                type="button"
                class="zl-delete-button"
                data-swipe-ignore="true"
                on:click|stopPropagation={() => deleteItem(item.id)}
                aria-label={`Delete ${item.text}`}
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
        <!-- Empty state - Minimalist and friendly -->
        <div
          class="zl-empty-state clickable"
          on:click={handleEmptyStateClick}
          role="button"
          tabindex="0"
          on:keydown={(e) => e.key === 'Enter' && handleEmptyStateClick()}
          in:fade={{ duration: 200 }}
        >
          <div class="zl-empty-content">
            <h3 class="zl-empty-title">Your list awaits</h3>
            <p class="zl-empty-description">Add the first thing</p>
            <p class="zl-empty-hint">or talk it in</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if touchDraggedItem && touchDragGhostRect}
  <div
    class="zl-touch-ghost"
    style={touchGhostStyle}
    aria-hidden="true"
  >
    <div class="zl-item zl-touch-ghost-item">
      <div class="zl-checkbox-wrapper ghost-checkbox">
        <span class="zl-checkbox-custom"></span>
      </div>

      <div class="edit-wrapper ghost-edit-wrapper">
        <span class="zl-item-text">{touchDraggedItem.text}</span>
      </div>

      <div class="grab-indicator touch-active">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>
{/if}

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

  @keyframes check-pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  @keyframes item-settle {
    0% { transform: translateY(0) scale(1); }
    45% { transform: translateY(-3px) scale(1.015); }
    100% { transform: translateY(0) scale(1); }
  }

  .animate-pop {
    animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  /**
   * Keyframes for the `gradient-shift` animation.
   */
  @keyframes gradient-shift {
    0% { background-position: 0% 0%; }
    25% { background-position: 50% 50%; }
    50% { background-position: 100% 100%; }
    75% { background-position: 50% 50%; }
    100% { background-position: 0% 0%; }
  }

  /**
   * Card styling with animated gradient background.
   */
  .zl-card {
    /* Core shape and structure */
    border-radius: var(--zl-card-border-radius); /* Pillowy, rounded corners */
    border: var(--zl-card-border-width) solid var(--zl-card-border-color);
    padding: 2rem;
    position: relative;
    overflow: clip;

    /* Size and positioning */
    box-sizing: border-box;
    width: 100%;
    max-width: 540px; /* Optimized for text wrapping */
    margin: 0 auto;
    margin-top: 1.5rem;
    margin-bottom: 2rem;
    height: auto;

    /* Typography */
    font-family: 'Space Mono', monospace;

    /* Transitions */
    transition: var(--zl-transition-standard);

    /* Shadow for depth */
    box-shadow: var(--zl-card-box-shadow);

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
  }

  @media (max-width: 480px) {
    .zl-card {
      padding: 0.95rem 0.75rem 1.1rem;
      border-radius: 18px;
      margin-top: 0.75rem;
      margin-bottom: 1rem;
      max-width: 100%;
    }

    .zl-list-header {
      align-items: stretch;
      flex-direction: column;
      gap: 0.65rem;
      margin-bottom: 0.75rem;
    }

    .zl-list-title-row {
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .zl-list-title-input {
      width: 100%;
    }

    .zl-card::before {
      border-radius: 18px;
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
    background: var(--zl-card-inner-border-gradient);
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
    background: radial-gradient(circle, rgba(var(--zl-primary-color-rgb, 255, 171, 119), 0.3) 0%, rgba(var(--zl-primary-color-rgb, 255, 171, 119), 0) 70%);
    border-radius: 50%;
    opacity: 0.5;
    pointer-events: none;
    animation: soft-pulse 8s infinite alternate ease-in-out;
  }

  /* Card content container */
  .card-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: visible;
  }

  .zl-list-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .zl-list-header-main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.45rem;
    min-width: 0;
  }

  .zl-list-title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem;
  }

  .zl-list-title-trigger {
    min-height: 44px;
    max-width: 100%;
    border: none;
    border-radius: 16px;
    background: transparent;
    color: inherit;
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.35rem;
    margin: -0.2rem -0.35rem;
    transition: var(--zl-transition-fast);
  }

  .zl-list-title-trigger:hover,
  .zl-list-title-trigger:focus-visible {
    background: rgba(255, 255, 255, 0.38);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    outline: none;
  }

  .zl-list-title {
    margin: 0;
    font-family: 'Space Mono', monospace;
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: 0;
    color: var(--zl-text-color-primary);
    display: block;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .zl-list-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.65rem;
  }

  .zl-list-title-input {
    width: min(100%, 22rem);
    min-height: 48px;
    border-radius: 18px;
    border: var(--zl-edit-input-border, 2px solid rgba(201, 120, 255, 0.3));
    background: rgba(255, 255, 255, 0.9);
    color: var(--zl-text-color-primary);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
    font-family: 'Space Mono', monospace;
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: 0;
    padding: 0.75rem 1rem;
    outline: none;
    transition: var(--zl-transition-fast);
  }

  .zl-list-title-input:focus {
    border-color: var(--zl-edit-input-focus-border, rgba(201, 120, 255, 0.6));
    box-shadow: var(--zl-edit-input-focus-shadow, 0 0 0 3px rgba(201, 120, 255, 0.1));
    background: rgba(255, 255, 255, 0.98);
  }

  .zl-title-edit-button {
    min-height: 44px;
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 999px;
    padding: 0.4rem 0.75rem;
    background: rgba(255, 255, 255, 0.52);
    color: var(--zl-text-color-secondary);
    font-family: 'Space Mono', monospace;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
    transition: var(--zl-transition-fast);
  }

  .zl-title-edit-button:hover,
  .zl-title-edit-button:focus-visible {
    background: rgba(255, 255, 255, 0.82);
    color: var(--zl-text-color-primary);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
    outline: none;
  }

  .zl-live-button,
  .zl-add-list-button,
  .zl-share-button,
  .zl-live-indicator {
    min-height: 44px;
    border-radius: 999px;
    padding: 0.65rem 0.9rem;
    font-family: 'Space Mono', monospace;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    white-space: nowrap;
  }

  .zl-add-list-button,
  .zl-live-button,
  .zl-share-button {
    border: 1px solid rgba(0, 188, 212, 0.2);
    background: rgba(255, 255, 255, 0.78);
    color: var(--zl-text-color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    transition: var(--zl-transition-fast);
  }

  .zl-add-list-button {
    border-color: rgba(var(--zl-primary-color-rgb, 255, 171, 119), 0.24);
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.92),
      rgba(var(--zl-primary-color-rgb, 255, 171, 119), 0.18)
    );
  }

  .zl-add-list-button .add-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .zl-add-list-button:hover,
  .zl-add-list-button:focus-visible,
  .zl-live-button:hover,
  .zl-share-button:hover,
  .zl-live-button:focus-visible,
  .zl-share-button:focus-visible {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
    border-color: rgba(0, 188, 212, 0.35);
    outline: none;
  }

  .zl-live-indicator {
    background: rgba(255, 244, 244, 0.9);
    color: #d9485f;
    border: 1px solid rgba(217, 72, 95, 0.16);
  }

  .live-count {
    min-width: 1.25rem;
    text-align: center;
  }

  .zl-undo-toast {
    align-items: center;
    background: rgba(24, 24, 27, 0.92);
    border: 2px solid rgba(0, 0, 0, 0.78);
    border-radius: 16px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
    color: #ffffff;
    display: flex;
    font-family: 'Space Mono', monospace;
    font-size: 0.82rem;
    font-weight: 700;
    gap: 0.75rem;
    justify-content: space-between;
    line-height: 1.25;
    margin: 0 0 0.85rem;
    padding: 0.7rem 0.85rem;
    position: sticky;
    top: 0.75rem;
    z-index: 20;
  }

  .zl-undo-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .zl-undo-button {
    background: #ffb000;
    border: 2px solid #000000;
    border-radius: 999px;
    color: #111111;
    cursor: pointer;
    flex-shrink: 0;
    font-family: 'Space Mono', monospace;
    font-size: 0.78rem;
    font-weight: 900;
    min-height: 44px;
    padding: 0.25rem 0.75rem;
    transition: transform 0.16s ease, box-shadow 0.16s ease;
  }

  .zl-undo-button:hover,
  .zl-undo-button:focus-visible {
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
    outline: none;
    transform: translateY(-1px);
  }

  /* List container */
  .zl-list-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    min-height: 0;
  }

  .zl-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    margin-bottom: var(--zl-spacing-m);
    position: relative;
    content-visibility: auto;
    contain-intrinsic-size: auto 400px;
  }

  .zl-add-row {
    list-style: none;
  }

  .zl-add-item-button {
    width: 100%;
    min-height: 52px;
    border: 2px dashed rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.34);
    border-radius: 18px;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.72), rgba(255, 245, 250, 0.5)),
      rgba(255, 255, 255, 0.5);
    color: var(--zl-text-color-primary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: 'Space Mono', monospace;
    font-size: 0.92rem;
    font-weight: 800;
    letter-spacing: 0;
    transition:
      transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
      box-shadow 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease;
  }

  .zl-add-item-button:hover,
  .zl-add-item-button:focus-visible {
    border-color: rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.62);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(255, 241, 248, 0.72)),
      rgba(255, 255, 255, 0.7);
    box-shadow: 0 8px 18px rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.13);
    outline: none;
    transform: translateY(-1px);
  }

  .zl-add-item-button:active {
    transform: translateY(1px) scale(0.99);
  }

  .zl-add-item-icon {
    align-items: center;
    background: var(--zl-primary-color, #ffb000);
    border: 2px solid rgba(0, 0, 0, 0.72);
    border-radius: 50%;
    box-shadow: 0 3px 0 rgba(0, 0, 0, 0.12);
    color: #111111;
    display: inline-flex;
    font-size: 1rem;
    height: 24px;
    justify-content: center;
    line-height: 1;
    width: 24px;
  }

  .zl-completed-divider {
    align-items: center;
    color: var(--zl-text-color-secondary);
    display: flex;
    font-family: 'Space Mono', monospace;
    font-size: 0.78rem;
    font-weight: 800;
    gap: 0.55rem;
    letter-spacing: 0;
    list-style: none;
    margin: 0.15rem 0 0;
    opacity: 0.8;
    text-transform: uppercase;
  }

  .zl-completed-line {
    border-top: 2px dashed rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.28);
    flex: 1;
    min-width: 18px;
  }

  .zl-completed-count {
    align-items: center;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.24);
    border-radius: 999px;
    display: inline-flex;
    height: 1.45rem;
    justify-content: center;
    min-width: 1.45rem;
    padding: 0 0.35rem;
  }

  .zl-item {
    border-radius: var(--zl-item-border-radius, 20px);
    background: var(--zl-item-bg, rgba(255, 255, 255, 0.5));
    padding: 0.85rem;

    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.65rem;

    min-height: 72px;
    height: auto;
    max-height: none;

    box-shadow: var(--zl-item-box-shadow, 0 4px 10px rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.1));
    border: 2px solid var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
    border-left: 4px solid var(--zl-item-border-color, rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.3));

    position: relative;
    cursor: grab;
    touch-action: manipulation;
    transition: var(--zl-transition-standard);
  }

  .zl-item:not(.checked):not(.editing) {
    will-change: transform, opacity;
  }

  .zl-item:hover {
    background: var(--zl-item-hover-bg, rgba(255, 255, 255, 0.8));
    transform: translateY(-3px);
    box-shadow: var(--zl-item-hover-box-shadow, 0 8px 20px rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.2));
    border-left: 4px solid var(--zl-item-border-hover-color, rgba(var(--zl-primary-color-rgb, 201, 120, 255), 0.7));
    border-color: var(--zl-item-border-hover-color, rgba(255, 212, 218, 0.9));
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
    opacity: var(--zl-item-checked-opacity, 0.75);
    background: var(--zl-item-checked-bg, rgba(245, 240, 250, 0.4));
    border-left: 4px solid var(--zl-item-checked-border-color, rgba(201, 120, 255, 0.2));
    transform: scale(0.98);
    box-shadow: 0 2px 6px rgba(0, 151, 167, 0.05);
    border-color: var(--zl-item-checked-border-color, rgba(255, 212, 218, 0.4));
  }

  .zl-item.settling:not(.touch-placeholder) {
    animation: item-settle 0.28s cubic-bezier(0.19, 1, 0.22, 1);
  }

  /* Item glow effect for remote edits */
  .zl-item.just-edited {
    animation: item-glow 2s ease-out;
    box-shadow: 0 0 20px rgba(255, 107, 107, 0.6), 0 0 40px rgba(255, 107, 107, 0.3);
  }

  @keyframes item-glow {
    0% {
      box-shadow: 0 0 30px rgba(255, 107, 107, 0.8), 0 0 50px rgba(255, 107, 107, 0.5);
      transform: scale(1.02);
    }
    50% {
      box-shadow: 0 0 20px rgba(255, 107, 107, 0.6), 0 0 40px rgba(255, 107, 107, 0.3);
    }
    100% {
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
      transform: scale(1);
    }
  }

  .zl-item-text {
    font-size: 1.05rem;
    font-weight: 800;
    line-height: 1.35;
    color: var(--zl-text-color-primary);
    font-family: 'Space Mono', monospace;
    letter-spacing: 0;

    box-sizing: border-box;
    display: inline-block;
    width: 100%;
    text-align: left;
    position: relative;
    vertical-align: middle;
    padding: 0.2rem 0;
    min-height: 0;

    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;

    transition: var(--zl-transition-fast);
  }

  .zl-item-text-button:hover .zl-item-text:not(.checked) {
    color: var(--zl-text-hover-color, #c978ff);
    text-shadow: 0 0 8px rgba(0, 151, 167, 0.3);
    transform: translateY(-1px) scale(1.01);
  }

  .zl-item-text.checked {
    text-decoration: line-through var(--zl-primary-color, rgba(201, 120, 255, 0.5)) 1.5px;
    color: var(--zl-text-color-disabled, #9d9d9d);
  }

  .zl-item-text-button {
    background: transparent;
    border: none;
    padding: 0.3rem 0.25rem;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    border-radius: 8px;
    transition: all 0.2s ease;
    margin-right: 0;
    position: relative;
    min-height: 44px;
    height: auto;
    align-self: center;
    flex-wrap: wrap;
  }

  .zl-item-text-button:hover:not(:disabled),
  .zl-item-text-button:focus-visible:not(:disabled) {
    background: var(--zl-text-button-hover-bg, linear-gradient(135deg, rgba(252, 235, 246, 0.7), rgba(255, 242, 253, 0.9)));
    outline: none;
    border-radius: 12px;
    box-shadow: var(--zl-text-button-focus-shadow, 0 3px 8px rgba(201, 120, 255, 0.2));
    transform: translateY(-1px);
  }

  .zl-checkbox-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 6px;
    align-self: center;
    min-width: 44px;
    min-height: 44px;
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
    width: var(--zl-checkbox-size, 32px);
    height: var(--zl-checkbox-size, 32px);
    border: var(--zl-checkbox-border, 2px solid rgba(201, 120, 255, 0.5));
    border-radius: var(--zl-checkbox-border-radius, 12px);
    background-color: var(--zl-checkbox-bg, rgba(255, 255, 255, 0.8));
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: var(--zl-checkbox-shadow, 0 3px 7px rgba(0, 151, 167, 0.15));
  }

  .zl-checkbox-wrapper:hover .zl-checkbox-custom {
    border: var(--zl-checkbox-hover-border, 2px solid rgba(0, 188, 212, 0.7));
    background-color: var(--zl-checkbox-hover-bg, rgba(255, 245, 250, 0.8));
    transform: scale(1.1);
    box-shadow: var(--zl-checkbox-hover-shadow, 0 3px 8px rgba(0, 151, 167, 0.15));
  }

  .zl-checkbox:checked + .zl-checkbox-custom {
    background: linear-gradient(145deg,
      var(--zl-checkbox-checked-gradient-start, #4dd0e1) 0%,
      var(--zl-checkbox-checked-gradient-end, #0097a7) 100%);
    border-color: transparent;
    box-shadow: var(--zl-checkbox-checked-shadow, 0 3px 8px rgba(0, 151, 167, 0.2));
  }

  .zl-checkbox:checked + .zl-checkbox-custom::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: radial-gradient(circle,
      var(--zl-checkbox-sparkle-color, rgba(255, 255, 255, 0.8)) 0%,
      rgba(255, 255, 255, 0) 70%);
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    animation: sparkle 0.5s var(--zl-transition-easing-bounce) forwards;
    z-index: 5;
  }

  .zl-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem 1.25rem;
    width: 100%;
    box-sizing: border-box;
    background: var(--zl-empty-state-bg);
    border: var(--zl-empty-state-border);
    border-radius: 24px;
    margin: 1rem 0;
    min-height: 260px;
    height: auto;
    transition: var(--zl-transition-fast);
  }

  .zl-empty-state.clickable {
    cursor: pointer;
  }

  .zl-empty-state.clickable:hover {
    background: linear-gradient(135deg, rgba(255, 245, 250, 0.6), rgba(255, 235, 245, 0.6));
    border-color: rgba(201, 120, 255, 0.5);
  }

  .zl-empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1;
    opacity: 1;
    transition: opacity 0.2s ease;
  }

  .zl-empty-title {
    font-weight: 800;
    color: var(--zl-empty-title-color);
    margin-bottom: 1.5rem;
    font-size: 1.9rem;
    font-family: 'Space Mono', monospace;
    letter-spacing: 0;
  }

  .zl-empty-description {
    color: var(--zl-text-color-secondary);
    font-size: 1.3rem;
    font-family: 'Space Mono', monospace;
    line-height: 1.5;
    letter-spacing: 0;
    font-weight: 600;
    margin-bottom: 0.3rem;
  }

  .zl-empty-hint {
    color: var(--zl-text-color-secondary);
    font-size: 1.1rem;
    font-family: 'Space Mono', monospace;
    font-weight: 400;
    letter-spacing: 0;
  }

  .edit-wrapper {
    flex: 1;
    position: relative;
    min-height: 44px;
    margin-right: 0;
    display: flex;
    align-items: center;
    padding-top: 0;
    align-self: center;
    width: auto;
    min-width: 0;
  }

  .zl-edit-input {
    font-family: 'Space Mono', monospace;
    font-weight: 800;
    border: var(--zl-edit-input-border, 2px solid rgba(201, 120, 255, 0.3));
    background-color: var(--zl-edit-input-bg, rgba(255, 255, 255, 0.8));
    border-radius: 16px;
    padding: 0.75rem 1.25rem;
    outline: none;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    color: #444444;
    width: 100%;
    font-size: 1.1rem;
    letter-spacing: 0;
    box-sizing: border-box;
    line-height: 1.5;
    margin: 0;
    min-height: 60px;
    height: 60px;
    text-align: left;
    display: flex;
    align-items: center;
  }

  .zl-edit-input {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    width: calc(100% - var(--zl-spacing-s));
    max-width: none;
  }

  .zl-edit-input::placeholder {
    color: #aaaaaa;
  }

  .zl-edit-input:focus {
    border-color: var(--zl-edit-input-focus-border, rgba(201, 120, 255, 0.6));
    box-shadow: var(--zl-edit-input-focus-shadow, 0 0 0 3px rgba(201, 120, 255, 0.1));
    background-color: rgba(255, 255, 255, 0.95);
  }

  .zl-draft-item {
    border-style: dashed;
    cursor: default;
  }

  .zl-draft-checkbox {
    cursor: default;
    opacity: 0.45;
  }

  .zl-draft-input {
    border-color: rgba(var(--zl-primary-color-rgb, 255, 171, 119), 0.46);
  }

  .zl-draft-cancel {
    opacity: 0.88;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(var(--float-y-min, 0)) rotate(var(--float-rotate-min, -0.5deg));
    }
    50% {
      transform: translateY(var(--float-y-max, -3px)) rotate(var(--float-rotate-max, 0.5deg));
    }
  }

  .zl-item.dragging {
    opacity: 1;
    background-color: var(--zl-item-dragging-bg, rgba(255, 255, 255, 1));
    transform: scale(1.03);
    box-shadow: var(--zl-item-dragging-shadow, 0 15px 30px rgba(0, 151, 167, 0.4));
    z-index: 10;
    border: var(--zl-item-dragging-border, 3px solid rgba(0, 188, 212, 0.85));
    --float-y-min: 0;
    --float-y-max: -3px;
    --float-rotate-min: -0.5deg;
    --float-rotate-max: 0.5deg;
    animation: float 2s infinite ease-in-out;
    cursor: grabbing;
    will-change: transform, opacity, border;
  }

  .zl-item.drag-over {
    position: relative;
    margin-top: 20px;
    background-color: var(--zl-item-dragover-bg, rgba(252, 242, 255, 0.9));
    border: var(--zl-item-dragover-border, 2px solid rgba(0, 188, 212, 0.8));
    box-shadow: var(--zl-item-dragover-shadow, 0 8px 20px rgba(0, 151, 167, 0.3));
    transform: translateY(2px);
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .zl-item.drag-over-after {
    margin-top: 0;
    margin-bottom: 20px;
  }

  .zl-item.touch-placeholder {
    opacity: 0.22;
    border-style: dashed;
    box-shadow: none;
    transform: none;
    background: rgba(255, 255, 255, 0.28);
  }

  .zl-item.touch-placeholder::after {
    opacity: 0;
  }

  .zl-item.touch-placeholder > :not(.drop-indicator) {
    opacity: 0;
  }

  .drop-indicator {
    position: absolute;
    top: -12px;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, transparent, var(--zl-drop-indicator-color, rgba(0, 188, 212, 0.7)), transparent);
    border-radius: 2px;
    animation: pulse-opacity 1.5s infinite ease-in-out;
    z-index: 5;
    pointer-events: none;
  }

  .drop-indicator.after {
    top: auto;
    bottom: -12px;
  }

  .drop-arrow {
    position: absolute;
    top: -6px;
    left: 50%;
    width: 14px;
    height: 14px;
    background-color: var(--zl-drop-arrow-bg, rgba(0, 188, 212, 0.9));
    border-radius: 50%;
    transform: translateX(-50%);
    box-shadow: var(--zl-drop-arrow-shadow, 0 0 8px rgba(0, 151, 167, 0.4));
  }

  .drop-indicator.after .drop-arrow {
    top: auto;
    bottom: -6px;
  }

  .drop-arrow::after {
    content: '';
    position: absolute;
    top: 4px;
    left: 3px;
    width: 8px;
    height: 8px;
    border-right: 2px solid white;
    border-bottom: 2px solid white;
    transform: rotate(45deg);
  }

  @keyframes pulse-opacity {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .grab-indicator {
    appearance: none;
    background: transparent;
    border: 0;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-right: 12px;
    opacity: var(--zl-grab-handle-opacity, 0.6);
    transition: all 0.25s ease;
    padding: 8px 8px;
    min-width: 32px;
    min-height: 32px;
    justify-content: center;
    align-self: center;
    cursor: grab;
    position: relative;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .grab-indicator span {
    width: 16px;
    height: 2.5px;
    background-color: var(--zl-grab-handle-color, rgba(0, 188, 212, 0.8));
    border-radius: 2px;
    transition: transform 0.2s ease, width 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  }

  .zl-item:hover .grab-indicator {
    opacity: var(--zl-grab-handle-hover-opacity, 1);
    transform: scale(1.1);
  }

  .zl-item:hover .grab-indicator span {
    background-color: var(--zl-grab-handle-color, rgba(0, 188, 212, 1));
    box-shadow: 0 1px 3px rgba(0, 151, 167, 0.3);
  }

  .grab-indicator.touch-active {
    opacity: 1;
    transform: scale(1.08);
  }

  .grab-indicator.touch-active span {
    background-color: rgba(0, 188, 212, 1);
    box-shadow: 0 2px 6px rgba(0, 151, 167, 0.35);
  }

  .zl-delete-button {
    background: var(--zl-delete-button-bg, rgba(255, 255, 255, 0.8));
    border: var(--zl-delete-button-border, 1px solid rgba(0, 188, 212, 0.4));
    cursor: pointer;
    color: var(--zl-delete-button-text-color, rgba(0, 188, 212, 0.9));
    opacity: 0;
    transition: all 0.2s;
    width: 44px;
    height: 44px;
    padding: 0;
    margin-left: 0.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .zl-item:hover .zl-delete-button {
    opacity: 1;
  }
  .zl-delete-button:hover {
    background-color: var(--zl-delete-button-hover-bg, rgba(255, 0, 0, 0.1));
    border-color: var(--zl-delete-button-hover-border, #ff4444);
    color: #ff4444;
  }

  .zl-touch-ghost {
    position: fixed;
    z-index: 999;
    pointer-events: none;
    transform: translateZ(0);
  }

  .zl-touch-ghost-item {
    margin: 0;
    opacity: 0.98;
    transform: rotate(1.1deg) scale(1.02);
    box-shadow: 0 16px 34px rgba(0, 151, 167, 0.24);
    border-color: rgba(0, 188, 212, 0.7);
    background: rgba(255, 255, 255, 0.96);
    animation: none;
  }

  .ghost-checkbox {
    padding: 0 6px 0 0;
  }

  .ghost-edit-wrapper {
    width: auto;
    min-height: auto;
    margin-right: 0;
    padding-top: 0;
    align-items: center;
  }

  .ghost-edit-wrapper .zl-item-text {
    padding: 0.45rem 0;
  }

  @media (max-width: 480px) {
    .zl-list-title {
      font-size: 1.1rem;
    }

    .zl-list-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.45rem;
      width: 100%;
    }

    .zl-list-actions > * {
      width: 100%;
    }

    .zl-share-button {
      grid-column: auto;
    }

    .zl-live-button,
    .zl-add-list-button,
    .zl-share-button,
    .zl-live-indicator {
      gap: 0.28rem;
      min-height: 44px;
      padding: 0.45rem 0.35rem;
      font-size: 0.68rem;
    }

    .zl-add-list-button .add-text,
    .zl-live-button .live-text {
      font-size: 0;
    }

    .zl-add-list-button .add-text::after {
      content: 'New';
      font-size: 0.68rem;
    }

    .zl-live-button .live-text::after {
      content: 'Live';
      font-size: 0.68rem;
    }

    .zl-list {
      gap: 0.75rem;
    }

    .zl-add-item-button {
      min-height: 48px;
      border-radius: 16px;
      font-size: 0.86rem;
    }

    .zl-add-item-icon {
      height: 22px;
      width: 22px;
    }

    .zl-completed-divider {
      font-size: 0.68rem;
      gap: 0.42rem;
      margin-top: 0;
    }

    .zl-completed-count {
      height: 1.3rem;
      min-width: 1.3rem;
    }

    .zl-item {
      grid-template-columns: 44px minmax(0, 1fr) 44px;
      grid-template-rows: repeat(2, minmax(44px, auto));
      gap: 0.25rem 0.45rem;
      min-height: 104px;
      padding: 0.45rem 0.6rem;
      border-radius: 16px;
    }

    .zl-item.checked {
      opacity: 0.72;
      transform: none;
    }

    .zl-checkbox-wrapper,
    .edit-wrapper {
      grid-row: 1 / -1;
    }

    .zl-item-text {
      font-size: 0.98rem;
      line-height: 1.32;
    }

    .zl-item-text-button {
      padding: 0.25rem 0.15rem;
    }

    .grab-indicator {
      grid-column: 3;
      grid-row: 1;
      margin-right: 0;
      min-height: 44px;
    }

    .zl-delete-button {
      grid-column: 3;
      grid-row: 1 / -1;
      margin-left: 0;
    }

    .grab-indicator + .zl-delete-button {
      grid-row: 2;
    }

    .zl-empty-state {
      min-height: 190px;
      margin: 0.65rem 0 0.25rem;
      padding: 1.15rem 0.8rem;
    }

    .zl-empty-title {
      margin-bottom: 0.75rem;
      font-size: 1.35rem;
    }

    .zl-empty-description {
      font-size: 0.92rem;
    }

    .zl-empty-hint {
      font-size: 0.84rem;
    }
  }

  @media (hover: none) {
    .zl-delete-button {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(255, 68, 68, 0.24);
      color: rgba(255, 68, 68, 0.82);
      opacity: 1;
    }

    .zl-item.checked .zl-delete-button {
      opacity: 0.78;
    }

    .grab-indicator {
      opacity: 0.85;
      min-width: 44px;
      min-height: 44px;
      padding: 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .zl-item.settling:not(.touch-placeholder),
    .animate-pop {
      animation: none;
    }
  }

  :global(body.zl-touch-dragging) {
    user-select: none;
    -webkit-user-select: none;
  }

  /* Presence Dots */
  .zl-presence-dots {
    display: flex;
    gap: 4px;
  }

  .zl-presence-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid white;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }

  /* Typing indicator */
  .typing-indicator {
    background: linear-gradient(135deg, rgba(255, 235, 245, 1), rgba(255, 245, 250, 1));
    border-radius: 16px;
    padding: 0.6rem 1rem;
    margin-bottom: 1rem;
    text-align: center;
    font-family: 'Space Mono', monospace;
    font-size: 0.85rem;
    color: #9b59b6;
    box-shadow: 0 3px 10px rgba(155, 89, 182, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
  }

  .typing-avatar {
    font-weight: 700;
    color: #8e44ad;
  }

  .typing-dots {
    display: inline-flex;
    gap: 2px;
    margin-left: 0.2rem;
  }

  .typing-dots .dot {
    animation: typing-bounce 1.4s infinite ease-in-out;
    opacity: 0.4;
    width: 4px;
    height: 4px;
    background-color: currentColor;
    border-radius: 50%;
    display: inline-block;
  }

  .typing-dots .dot:nth-child(1) {
    animation-delay: 0s;
  }

  .typing-dots .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-dots .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing-bounce {
    0%, 60%, 100% {
      opacity: 0.4;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-4px);
    }
  }
</style>
