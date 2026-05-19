<script>
  import { onMount, onDestroy, tick } from "svelte";
  import { listsStore, activeList } from "$lib/services/lists/listsStore";
  import { listsService } from "$lib/services/lists/listsService";
  import { shareList } from "$lib/services/share";
  import { fade, fly } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { hapticService } from "$lib/services/infrastructure/hapticService";
  import * as liveListsService from "$lib/services/realtime/liveListsService";
  import { getPresenceStore } from "$lib/services/realtime/presenceStore";
  import { getTypingStore } from "$lib/services/realtime/typingStore";
  import { PRODUCT_LIMITS } from "$lib/constants";
  import CompletedDivider from "./CompletedDivider.svelte";
  import DraftItemRow from "./DraftItemRow.svelte";
  import ListItemBody from "./ListItemBody.svelte";
  import "./SingleList.css";

  // State variables
  let list = { name: "", items: [] };
  let draggedItemId = null;
  let dragOverItemId = null;
  let dragOverPosition = "before";
  let editingItemId = null;
  let editedItemText = "";
  let draftItemActive = false;
  let draftItemText = "";
  let draftInputNode = null;
  let editingListName = false;
  let editedListName = "";
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
  let shareStatusTimer = null;

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
      unsubscribe = listsStore.subscribe((state) => {
        const foundList = state.lists.find((l) => l.id === nextListId);
        if (foundList) list = foundList;
      });
    } else {
      unsubscribe = activeList.subscribe((activeListData) => {
        if (activeListData) list = activeListData;
      });
    }
  }

  $: liveFeatureAvailable = liveListsService.isLiveCollaborationAvailable();
  $: if (!editingListName) {
    editedListName = list.name || "";
  }
  $: if (list.id && previousListIdentity !== list.id) {
    if (previousListIdentity !== null) {
      draftItemActive = false;
      draftItemText = "";
      editingItemId = null;
      editedItemText = "";
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
        presenceUnsubscribe = presenceStore.subscribe((users) => {
          presence = users;
        });

        // Subscribe to typing indicators
        const typingStore = getTypingStore(list.id);
        typingUnsubscribe = typingStore.subscribe((users) => {
          typingUsers = users;
        });
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("ziplist-list-notice", handleListNotice);
    }
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
    if (presenceUnsubscribe) presenceUnsubscribe();
    if (typingUnsubscribe) typingUnsubscribe();
    if (typingTimeout) clearTimeout(typingTimeout);
    if (undoDeleteTimer) clearTimeout(undoDeleteTimer);
    if (shareStatusTimer) clearTimeout(shareStatusTimer);
    clearTouchDragLongPressTimer();
    stopTouchDragAutoScroll();
    removeTouchDragListeners();
    settlingTimers.forEach((timer) => clearTimeout(timer));
    settlingTimers.clear();
    if (typeof document !== "undefined") {
      document.body.classList.remove("zl-touch-dragging");
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("ziplist-list-notice", handleListNotice);
    }
  });

  function showListStatus(message, success = false, duration = 3500) {
    if (shareStatusTimer) clearTimeout(shareStatusTimer);
    shareStatus = { success, message };
    shareStatusTimer = setTimeout(() => {
      shareStatus = null;
      shareStatusTimer = null;
    }, duration);
  }

  function handleListNotice(event) {
    if (!event.detail?.message) return;
    showListStatus(event.detail.message, !!event.detail.success);
  }

  // Share list function
  async function handleShareList() {
    if (!list || !list.items || list.items.length === 0) {
      showListStatus("Cannot share an empty list");
      return;
    }

    try {
      const result = await shareList(list);
      if (result.success) {
        showListStatus(
          result.urlTooLong
            ? "Share link copied! Note: Very long URL."
            : "Share link copied!",
          true,
          result.urlTooLong ? 5000 : 3000,
        );
      } else {
        showListStatus("Failed to share list");
      }
    } catch (error) {
      console.error("Failed to share list:", error);
      showListStatus("Failed to share list");
    }
  }

  // Make list live (real-time collaboration)
  async function handleMakeLive() {
    if (!liveFeatureAvailable) {
      showListStatus(
        "Live collaboration is not configured on this deployment yet",
        false,
        4000,
      );
      return;
    }

    if (!list || !list.id) {
      showListStatus("Cannot make list live");
      return;
    }

    try {
      const { shareUrl } = await liveListsService.makeLive(list.id);
      isLive = true;

      // Copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }

      showListStatus("🔴 List is now LIVE! Link copied!", true);

      // Subscribe to presence
      const presenceStore = getPresenceStore(list.id);
      presenceUnsubscribe = presenceStore.subscribe((users) => {
        presence = users;
      });

      // Subscribe to typing indicators
      const typingStore = getTypingStore(list.id);
      typingUnsubscribe = typingStore.subscribe((users) => {
        typingUsers = users;
      });
    } catch (error) {
      console.error("Failed to make list live:", error);
      showListStatus("Failed to make list live: " + error.message, false, 5000);
    }
  }

  function handleCreateList() {
    const result = listsService.createList();
    if (!result.ok) {
      showListStatus(result.message);
      hapticService.notification("warning");
      return;
    }

    hapticService.notification("success");
  }

  function startEditingListName() {
    if (!showListManagement || !list?.id) return;
    editingListName = true;
    editedListName = list.name || "";
    hapticService.selection();
  }

  function saveListName() {
    if (!editingListName) return;

    const nextName = editedListName.trim();
    editingListName = false;

    if (!nextName || nextName === list.name) {
      editedListName = list.name || "";
      return;
    }

    listsStore.renameList(nextName, list.id);
    hapticService.impact("light");
  }

  function cancelListNameEdit() {
    editingListName = false;
    editedListName = list.name || "";
  }

  function handleListNameKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      saveListName();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelListNameEdit();
    }
  }

  // Separated active and completed items
  $: activeItems = list.items.filter((item) => !item.checked);
  $: completedItems = list.items.filter((item) => item.checked);

  // Sort items - active items first, completed items last
  $: sortedItems = touchDragPreviewItems || [...activeItems, ...completedItems];
  $: renderedActiveItems = sortedItems.filter((item) => !item.checked);
  $: renderedCompletedItems = sortedItems.filter((item) => item.checked);
  $: touchDraggedItem = touchDragItemId
    ? list.items.find((item) => item.id === touchDragItemId) || null
    : null;
  $: touchGhostStyle =
    touchDraggedItem && touchDragGhostRect
      ? `top: ${touchDragCurrentY - touchDragPointerOffsetY}px; left: ${touchDragGhostRect.left}px; width: ${touchDragGhostRect.width}px;`
      : "";

  // Track previous item IDs to detect new items (from remote users)
  let previousItemIds = new Set();
  $: {
    // Detect newly added items
    const currentItemIds = new Set(list.items.map((item) => item.id));
    const newItemIds = [...currentItemIds].filter(
      (id) => !previousItemIds.has(id),
    );

    // Add glow effect to new items (only if we're in a live session)
    if (isLive && newItemIds.length > 0 && previousItemIds.size > 0) {
      newItemIds.forEach((id) => {
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

  function getItemGrabbedState(itemId) {
    return draggedItemId === itemId || touchDragItemId === itemId
      ? "true"
      : "false";
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
      },
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
    if (touchDragListenersAttached || typeof window === "undefined") {
      return;
    }

    window.addEventListener("touchmove", handleTouchGrabMove, {
      passive: false,
    });
    window.addEventListener("touchend", handleTouchGrabEnd, { passive: false });
    window.addEventListener("touchcancel", handleTouchGrabCancel, {
      passive: false,
    });
    touchDragListenersAttached = true;
  }

  function removeTouchDragListeners() {
    if (!touchDragListenersAttached || typeof window === "undefined") {
      return;
    }

    window.removeEventListener("touchmove", handleTouchGrabMove);
    window.removeEventListener("touchend", handleTouchGrabEnd);
    window.removeEventListener("touchcancel", handleTouchGrabCancel);
    touchDragListenersAttached = false;
  }

  function getTrackedTouch(event) {
    if (touchDragPendingTouchId === null) return null;

    return (
      [...event.changedTouches, ...event.touches].find(
        (touch) => touch.identifier === touchDragPendingTouchId,
      ) || null
    );
  }

  function getTouchDragScrollContainer() {
    if (typeof window === "undefined" || typeof document === "undefined") {
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

    if (typeof document !== "undefined") {
      document.body.classList.remove("zl-touch-dragging");
    }
  }

  function buildTouchPreviewItems(targetIndex) {
    const draggedItem = activeItems.find((item) => item.id === touchDragItemId);
    if (!draggedItem) return null;

    const movableItems = activeItems.filter(
      (item) => item.id !== touchDragItemId,
    );
    const clampedIndex = Math.max(
      0,
      Math.min(targetIndex, movableItems.length),
    );
    const reorderedActiveItems = [...movableItems];

    reorderedActiveItems.splice(clampedIndex, 0, draggedItem);

    return [...reorderedActiveItems, ...completedItems];
  }

  function updateTouchDragPreview(clientY) {
    if (!touchDragItemId) return;

    const movableItems = activeItems.filter(
      (item) => item.id !== touchDragItemId,
    );
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
        behavior: "auto",
      });
    } else {
      scrollContainer.scrollTop += touchDragAutoScrollDelta;
    }

    updateTouchDragPreview(touchDragCurrentY);
    touchDragAutoScrollFrame = requestAnimationFrame(runTouchDragAutoScroll);
  }

  function updateTouchDragAutoScroll(clientY) {
    const scrollContainer = getTouchDragScrollContainer();
    if (!scrollContainer || typeof window === "undefined") return;

    const scrollBounds =
      scrollContainer === window
        ? { top: 0, bottom: window.innerHeight }
        : scrollContainer.getBoundingClientRect();
    const topEdgeDistance = clientY - scrollBounds.top;
    const bottomEdgeDistance = scrollBounds.bottom - clientY;
    let nextDelta = 0;

    if (topEdgeDistance < MOBILE_REORDER_AUTO_SCROLL_EDGE_PX) {
      nextDelta = -Math.max(
        4,
        Math.round((MOBILE_REORDER_AUTO_SCROLL_EDGE_PX - topEdgeDistance) / 10),
      );
    } else if (bottomEdgeDistance < MOBILE_REORDER_AUTO_SCROLL_EDGE_PX) {
      nextDelta = Math.max(
        4,
        Math.round(
          (MOBILE_REORDER_AUTO_SCROLL_EDGE_PX - bottomEdgeDistance) / 10,
        ),
      );
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

    const activeIndex = activeItems.findIndex(
      (item) => item.id === touchDragPendingItemId,
    );
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
      height: rect.height,
    };
    touchDragTargetIndex = activeIndex;
    touchDragPreviewItems = [...activeItems, ...completedItems];

    if (typeof document !== "undefined") {
      document.body.classList.add("zl-touch-dragging");
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
    touchDragLongPressTimer = setTimeout(
      startTouchDrag,
      MOBILE_REORDER_LONG_PRESS_MS,
    );
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

    const currentOrder = [...activeItems, ...completedItems].map(
      (item) => item.id,
    );
    const nextOrder = (
      touchDragPreviewItems || [...activeItems, ...completedItems]
    ).map((item) => item.id);
    const didMove = currentOrder.join("|") !== nextOrder.join("|");

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
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    draggedItemId = itemId;

    // Haptic feedback
    hapticService.impact("light");
  }

  function handleDragEnd() {
    // Remove styling
    draggedItemId = null;
    dragOverItemId = null;
    dragOverPosition = "before";

    // Haptic feedback
    hapticService.impact("medium");
  }

  function handleDragOver(event, itemId) {
    // Prevent default to allow drop
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (!draggedItemId) {
      dragOverItemId = null;
      dragOverPosition = "before";
      return;
    }

    // Don't allow drag over on checked items or the dragged item itself
    if (draggedItemId === itemId) {
      dragOverItemId = null;
      dragOverPosition = "before";
      return;
    }

    // Get the target item to check if it's checked
    const targetItem = list.items.find((item) => item.id === itemId);
    if (targetItem?.checked) {
      dragOverItemId = null;
      dragOverPosition = "before";
      return;
    }

    const targetBounds = event.currentTarget.getBoundingClientRect();
    const nextPosition =
      event.clientY > targetBounds.top + targetBounds.height / 2
        ? "after"
        : "before";

    // Only update if we're moving to a new item
    if (dragOverItemId === itemId && dragOverPosition === nextPosition) return;

    // Update dragover state
    dragOverItemId = itemId;
    dragOverPosition = nextPosition;

    // Haptic feedback
    hapticService.impact("light");
  }

  function handleDrop(event, targetItemId) {
    // Prevent default action
    event.preventDefault();

    dragOverItemId = null;

    if (!draggedItemId) {
      dragOverPosition = "before";
      return;
    }

    // If dropped on itself, do nothing
    if (draggedItemId === targetItemId) {
      dragOverPosition = "before";
      return;
    }

    // Check if target is a completed item (don't allow dropping on completed items)
    const targetItem = list.items.find((item) => item.id === targetItemId);
    if (targetItem?.checked) {
      dragOverPosition = "before";
      return;
    }

    // Haptic feedback - stronger for successful drop
    hapticService.impact("heavy");

    // Reorder only active items, then keep completed items anchored at the bottom.
    const reorderedActiveItems = [...activeItems];
    const sourceIndex = reorderedActiveItems.findIndex(
      (item) => item.id === draggedItemId,
    );
    const targetIndex = reorderedActiveItems.findIndex(
      (item) => item.id === targetItemId,
    );

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const targetBounds = event.currentTarget.getBoundingClientRect();
      const insertAfter =
        dragOverPosition === "after" ||
        event.clientY > targetBounds.top + targetBounds.height / 2;
      let destinationIndex = targetIndex + (insertAfter ? 1 : 0);
      const [movedItem] = reorderedActiveItems.splice(sourceIndex, 1);

      if (sourceIndex < destinationIndex) {
        destinationIndex -= 1;
      }

      reorderedActiveItems.splice(destinationIndex, 0, movedItem);

      // Update the list with the new order
      listsService.reorderItems(
        [...reorderedActiveItems, ...completedItems],
        list.id,
      );
      markItemSettling(draggedItemId);
    }

    dragOverPosition = "before";
  }

  function moveActiveItem(itemId, direction) {
    const sourceIndex = activeItems.findIndex((item) => item.id === itemId);
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

    listsService.reorderItems(
      [...reorderedActiveItems, ...completedItems],
      list.id,
    );
    markItemSettling(itemId);
    hapticService.selection();
  }

  function handleReorderKeyDown(event, itemId) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveItem(itemId, -1);
    } else if (event.key === "ArrowDown") {
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
    const itemToToggle = list.items.find((item) => item.id === itemId);

    // Apply haptic feedback
    if (itemToToggle) {
      hapticService.impact(itemToToggle.checked ? "light" : "medium");
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
          y: event.clientY / window.innerHeight,
        };
      }

      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 60,
        spread: 60,
        origin: origin,
        colors: ["#FFB000", "#FF6AC2", "#00D4FF"], // Use app colors
        disableForReducedMotion: true,
      });

      // Add sparkle animation after a small delay
      setTimeout(() => {
        const checkbox = document.getElementById(`item-${list.id}-${itemId}`);
        if (checkbox) {
          // Force reflow to restart animation
          void checkbox.offsetWidth;

          // Check if we've completed all items
          const allCompleted =
            list.items.length > 1 &&
            list.items.filter((i) => i.id !== itemId).every((i) => i.checked);

          // If this completes the list, trigger haptic feedback but no message
          if (allCompleted) {
            hapticService.notification("success");

            // Extra confetti for finishing the list!
            setTimeout(() => {
              confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 },
                colors: ["#FFB000", "#FF6AC2", "#00D4FF"],
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
    draftItemText = "";
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
      editedItemText = "";
    } else {
      deleteItem(itemId);
    }
  }

  function cancelItemEdit() {
    editingItemId = null;
    editedItemText = "";
  }

  function handleEditItemKeyDown(event) {
    if (event.key === "Enter") {
      saveItemEdit();
    } else if (event.key === "Escape") {
      cancelItemEdit();
    }
  }

  function deleteItem(itemId) {
    if (editingItemId === itemId) {
      cancelItemEdit();
    }

    const deletedItem = list.items.find((item) => item.id === itemId);
    const originalIndex = list.items.findIndex((item) => item.id === itemId);

    hapticService.impact("light");
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

    const currentItems = list.items.filter(
      (item) => item.id !== undoDelete.item.id,
    );
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
    editedItemText = "";
    draftItemActive = true;
    draftItemText = "";

    await tick();
    draftInputNode?.scrollIntoView({ block: "center", behavior: "smooth" });
    draftInputNode?.focus();
  }

  function saveDraftItem() {
    const newText = draftItemText.trim();

    if (newText) {
      const result = listsService.addItem(newText, list.id);
      if (!result.ok) {
        showListStatus(result.message || "Could not add that item");
        hapticService.notification("warning");
        return;
      }
    }

    hapticService.selection();
    draftItemActive = false;
    draftItemText = "";
  }

  function cancelDraftItem() {
    draftItemActive = false;
    draftItemText = "";
    hapticService.selection();
  }

  function handleDraftItemKeyDown(event) {
    if (event.key === "Enter") {
      saveDraftItem();
    } else if (event.key === "Escape") {
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

<section class="zl-card" aria-labelledby="list-title-{list.id || 'active'}">
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
            maxlength={PRODUCT_LIMITS.MAX_LIST_NAME_LENGTH}
            use:autoFocus
          />
        {:else}
          <div class="zl-list-title-row">
            {#if showListManagement}
              <h2 class="zl-list-title-heading">
                <button
                  type="button"
                  class="zl-list-title-trigger"
                  on:click={startEditingListName}
                  aria-label={`Rename ${list.name || "list"}`}
                >
                  <span
                    id="list-title-{list.id || 'active'}"
                    class="zl-list-title"
                  >
                    {list.name || "Your List"}
                  </span>
                </button>
              </h2>
              <button
                type="button"
                class="zl-title-edit-button"
                on:click={startEditingListName}
                aria-label={`Rename ${list.name || "list"}`}
              >
                Rename
              </button>
            {:else}
              <h2 id="list-title-{list.id || 'active'}" class="zl-list-title">
                {list.name || "Your List"}
              </h2>
            {/if}
          </div>
        {/if}
        {#if isLive}
          <div class="flex items-center gap-2 mt-1">
            <div
              class="zl-presence-dots"
              aria-label="{presence.length} collaborators online"
            >
              {#each presence as user (user.id)}
                <div
                  class="zl-presence-dot"
                  title={user.avatar}
                  aria-hidden="true"
                  style="background-color: {user.avatar.includes('Fox')
                    ? '#ff6b6b'
                    : user.avatar.includes('Frog')
                      ? '#51cf66'
                      : '#4dabf7'}"
                ></div>
              {/each}
            </div>
            <span class="text-xs font-bold text-red-500 animate-pulse"
              >LIVE</span
            >
          </div>
        {/if}
      </div>

      <div class="zl-list-actions">
        {#if showListManagement}
          <button
            type="button"
            class="zl-add-list-button"
            on:click={handleCreateList}
            title="Create a new list"
            aria-label="Create a new list"
          >
            <span class="add-icon">+</span>
            <span class="add-text">New List</span>
          </button>
        {/if}
        {#if liveFeatureAvailable}
          {#if !isLive}
            <button
              type="button"
              class="zl-live-button"
              on:click={handleMakeLive}
              title="Enable real-time collaboration"
              aria-label={`Make Live. Enable real-time collaboration for ${
                list.name || "this list"
              }`}
            >
              <span class="live-icon" aria-hidden="true">🔴</span>
              <span class="live-text">Make Live</span>
            </button>
          {:else}
            <div
              class="zl-live-indicator"
              role="status"
              aria-live="polite"
              aria-label="{presence.length} collaborators online"
            >
              <span class="live-pulse" aria-hidden="true">🔴</span>
              <span class="live-count">{presence.length}</span>
            </div>
          {/if}
        {/if}

        <button
          type="button"
          class="zl-share-button"
          on:click={handleShareList}
          title="Share list link"
          aria-label={`Share ${list.name || "this list"}`}
        >
          <span class="share-icon" aria-hidden="true">🔗</span>
          <span class="share-text">Share</span>
        </button>
      </div>
    </div>

    <!-- Share status notification -->
    {#if shareStatus}
      <div
        class="zl-share-notification {shareStatus.success
          ? 'success'
          : 'error'}"
        role={shareStatus.success ? "status" : "alert"}
        aria-live={shareStatus.success ? "polite" : "assertive"}
        transition:fade={{ duration: 200 }}
      >
        {shareStatus.message}
      </div>
    {/if}

    {#if undoDelete && undoDelete.listId === list.id}
      <div
        class="zl-undo-toast"
        role="status"
        aria-live="polite"
        transition:fade={{ duration: 180 }}
      >
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
      <div
        class="typing-indicator"
        role="status"
        aria-live="polite"
        in:fade={{ duration: 200 }}
      >
        <span class="typing-avatar">{typingUsers[0].avatar}</span> is adding an
        item
        <span class="typing-dots">
          <span class="dot">.</span><span class="dot">.</span><span class="dot"
            >.</span
          >
        </span>
      </div>
    {/if}

    <!-- List Items -->
    <div class="zl-list-container" bind:this={listContainerNode}>
      {#if list.items.length > 0 || draftItemActive}
        <ul
          class="zl-list"
          role="list"
          aria-label={`${list.name || "List"} items`}
          in:fade={{ duration: 200 }}
        >
          {#each renderedActiveItems as item, index (item.id)}
            <li
              class="zl-item"
              class:checked={item.checked}
              class:editing={editingItemId === item.id}
              class:dragging={draggedItemId === item.id}
              class:drag-over={dragOverItemId === item.id}
              class:drag-over-after={dragOverItemId === item.id &&
                dragOverPosition === "after"}
              class:just-edited={recentlyEditedItems.has(item.id)}
              class:settling={settlingItemIds.has(item.id)}
              class:touch-placeholder={touchDragItemId === item.id}
              draggable={!item.checked &&
                editingItemId !== item.id &&
                !touchDragItemId}
              on:dragstart|passive={(e) => handleDragStart(e, item.id)}
              on:dragend|passive={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
              animate:flip={{ duration: touchDragItemId ? 180 : 300 }}
              in:fly={{ y: 20, duration: 300, delay: getStaggerDelay(index) }}
              aria-grabbed={getItemGrabbedState(item.id)}
              aria-dropeffect="move"
              role="listitem"
              use:registerItemNode={item.id}
            >
              <ListItemBody
                listId={list.id}
                {item}
                isEditing={editingItemId === item.id}
                bind:editedItemText
                showDropIndicator={dragOverItemId === item.id}
                {dragOverPosition}
                activeItemsCount={activeItems.length}
                isTouchActive={touchDragItemId === item.id}
                onToggle={toggleItem}
                onStartEdit={startEditingItem}
                onSaveEdit={saveItemEdit}
                onEditKeyDown={handleEditItemKeyDown}
                onTyping={handleTyping}
                onReorderClick={() => hapticService.selection()}
                onReorderKeyDown={handleReorderKeyDown}
                onTouchGrabStart={handleTouchGrabStart}
                onDelete={deleteItem}
              />
            </li>
          {/each}

          {#if draftItemActive}
            <DraftItemRow
              listId={list.id}
              bind:draftItemText
              bind:inputNode={draftInputNode}
              staggerDelay={getStaggerDelay(renderedActiveItems.length)}
              onSaveDraft={saveDraftItem}
              onDraftKeyDown={handleDraftItemKeyDown}
              onTyping={handleTyping}
              onCancelDraft={cancelDraftItem}
            />
          {:else}
            <li class="zl-add-row" role="listitem">
              <button
                type="button"
                class="zl-add-item-button"
                on:click={handleAddItemClick}
                aria-label={`Add item to ${list.name || "this list"}`}
              >
                <span class="zl-add-item-icon">+</span>
                <span>Add item</span>
              </button>
            </li>
          {/if}

          {#if completedItems.length > 0}
            <CompletedDivider count={completedItems.length} />
          {/if}

          {#each renderedCompletedItems as item, index (item.id)}
            <li
              class="zl-item"
              class:checked={item.checked}
              class:editing={editingItemId === item.id}
              class:dragging={draggedItemId === item.id}
              class:drag-over={dragOverItemId === item.id}
              class:drag-over-after={dragOverItemId === item.id &&
                dragOverPosition === "after"}
              class:just-edited={recentlyEditedItems.has(item.id)}
              class:settling={settlingItemIds.has(item.id)}
              class:touch-placeholder={touchDragItemId === item.id}
              draggable={!item.checked &&
                editingItemId !== item.id &&
                !touchDragItemId}
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
              aria-grabbed={getItemGrabbedState(item.id)}
              aria-dropeffect="move"
              role="listitem"
              use:registerItemNode={item.id}
            >
              <ListItemBody
                listId={list.id}
                {item}
                isEditing={editingItemId === item.id}
                bind:editedItemText
                showDropIndicator={dragOverItemId === item.id}
                {dragOverPosition}
                activeItemsCount={activeItems.length}
                isTouchActive={touchDragItemId === item.id}
                onToggle={toggleItem}
                onStartEdit={startEditingItem}
                onSaveEdit={saveItemEdit}
                onEditKeyDown={handleEditItemKeyDown}
                onTyping={handleTyping}
                onReorderClick={() => hapticService.selection()}
                onReorderKeyDown={handleReorderKeyDown}
                onTouchGrabStart={handleTouchGrabStart}
                onDelete={deleteItem}
              />
            </li>
          {/each}
        </ul>
      {:else}
        <!-- Empty state - Minimalist and friendly -->
        <button
          type="button"
          class="zl-empty-state clickable"
          on:click={handleEmptyStateClick}
          aria-label={`Your list awaits. Add the first thing or talk it in. Add the first item to ${
            list.name || "this list"
          }`}
          in:fade={{ duration: 200 }}
        >
          <div class="zl-empty-content">
            <h3 class="zl-empty-title">Your list awaits</h3>
            <p class="zl-empty-description">Add the first thing</p>
            <p class="zl-empty-hint">or talk it in</p>
          </div>
        </button>
      {/if}
    </div>
  </div>
</section>

{#if touchDraggedItem && touchDragGhostRect}
  <div class="zl-touch-ghost" style={touchGhostStyle} aria-hidden="true">
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
