<script>
  import { onMount, onDestroy, tick } from "svelte";
  import {
    listsStore,
    LIST_COLOR_PRESETS,
  } from "$lib/services/lists/listsStore";

  const DEFAULT_LIST_NAMES = new Set(
    LIST_COLOR_PRESETS.map((p) => p.defaultName),
  );
  import { listsService } from "$lib/services/lists/listsService";
  import { shareList } from "$lib/services/share";
  import { notePwaMoment } from "$lib/components/PwaInstallCard.svelte";
  import { fade } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import { flip } from "svelte/animate";

  // Respect the user's motion preference for the juicy item transitions.
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Gentle pop/scale-in for freshly added rows — a little overshoot via backOut
  // makes an add feel like it *lands*. Reduced-motion folks get a plain fade.
  function itemIn(node, { delay = 0 } = {}) {
    if (prefersReducedMotion) {
      return { delay, duration: 160, css: (t) => `opacity: ${t}` };
    }
    return {
      delay,
      duration: 320,
      easing: backOut,
      css: (t) => {
        const eased = Math.min(1, t);
        return `opacity: ${Math.min(1, t * 1.4)}; transform: translateY(${(1 - eased) * 14}px) scale(${0.9 + eased * 0.1});`;
      },
    };
  }

  // Quick, satisfying exit for deletes — collapse + fade in sub-200ms so the
  // list closes the gap cleanly. Reduced-motion gets a bare fast fade.
  function itemOut(node) {
    if (prefersReducedMotion) {
      return { duration: 120, css: (t) => `opacity: ${t}` };
    }
    return {
      duration: 190,
      easing: cubicOut,
      css: (t) => {
        const eased = cubicOut(t);
        return `opacity: ${t}; transform: translateY(${(1 - eased) * -8}px) scale(${0.94 + eased * 0.06});`;
      },
    };
  }
  import { hapticService } from "$lib/services/infrastructure/hapticService";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import * as liveListsService from "$lib/services/realtime/liveListsService";
  import {
    getAvatarColor,
    getAvatarImage,
  } from "$lib/services/realtime/avatarService";
  import { getLiveActivityStore } from "$lib/services/realtime/liveActivityStore";
  import { getPresenceStore } from "$lib/services/realtime/presenceStore";
  import { getTypingStore } from "$lib/services/realtime/typingStore";
  import { ANIMATION, PRODUCT_LIMITS } from "$lib/constants";
  import { isContributor } from "$lib";
  import CompletedDivider from "./CompletedDivider.svelte";
  import DraftItemRow from "./DraftItemRow.svelte";
  import LiveActivityRow from "./LiveActivityRow.svelte";
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
  let isMakingLive = false;
  let presence = []; // Who's online
  let typingUsers = []; // Who's typing
  let liveActivity = { drafts: [], focuses: [], voices: [] };
  let recentlyEditedItems = new Set(); // Track items just edited by others
  let settlingItemIds = new Set(); // Brief bounce after check, uncheck, or reorder
  let typingTimeout = null; // Debounce typing broadcasts
  let draftBroadcastTimeout = null;
  let pendingDraftBroadcast = null;
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
  const celebrationTimers = new Set();

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
      unsubscribe = listsStore.subscribe((state) => {
        const activeListData = state.lists.find(
          (l) => l.id === state.activeListId,
        );
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
      liveListsService.broadcastDraftClear(previousListIdentity);
      liveListsService.broadcastItemFocus(previousListIdentity, null);
      draftItemActive = false;
      draftItemText = "";
      editingItemId = null;
      editedItemText = "";
      // Clear drag state so a mid-drag list switch doesn't leave a phantom indicator
      draggedItemId = null;
      dragOverItemId = null;
      dragOverPosition = "before";
    }
    previousListIdentity = list.id;
    isLive = liveListsService.isLive(list.id);
    if (isLive) {
      subscribeToLiveStores(list.id);
    }
  }

  $: isDefaultName = DEFAULT_LIST_NAMES.has(list.name);
  $: accessibleListName = list.name || "Your List";

  // Subscribe to presence and typing for this list
  let presenceUnsubscribe = null;
  let typingUnsubscribe = null;
  let activityUnsubscribe = null;

  onMount(() => {
    // Initialize the lists store
    listsStore.initialize();
    listsService.getAllLists();

    // Check if this list is already live
    if (list && list.id) {
      isLive = liveListsService.isLive(list.id);
      if (isLive) {
        subscribeToLiveStores(list.id);
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
    if (activityUnsubscribe) activityUnsubscribe();
    if (typingTimeout) clearTimeout(typingTimeout);
    if (draftBroadcastTimeout) clearTimeout(draftBroadcastTimeout);
    if (list?.id) {
      liveListsService.broadcastDraftClear(list.id);
      liveListsService.broadcastItemFocus(list.id, null);
    }
    if (undoDeleteTimer) clearTimeout(undoDeleteTimer);
    if (shareStatusTimer) clearTimeout(shareStatusTimer);
    clearCelebrationTimers();
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

  function subscribeToLiveStores(nextListId) {
    if (!nextListId) return;

    if (presenceUnsubscribe) presenceUnsubscribe();
    if (typingUnsubscribe) typingUnsubscribe();
    if (activityUnsubscribe) activityUnsubscribe();

    const presenceStore = getPresenceStore(nextListId);
    presenceUnsubscribe = presenceStore.subscribe((users) => {
      presence = users;
    });

    const typingStore = getTypingStore(nextListId);
    typingUnsubscribe = typingStore.subscribe((users) => {
      typingUsers = users;
    });

    const activityStore = getLiveActivityStore(nextListId);
    activityUnsubscribe = activityStore.subscribe((activity) => {
      liveActivity = activity;
    });
  }

  function showListStatus(message, success = false, duration = 3500) {
    if (shareStatusTimer) clearTimeout(shareStatusTimer);
    shareStatus = { success, message };
    shareStatusTimer = setTimeout(() => {
      shareStatus = null;
      shareStatusTimer = null;
    }, duration);
  }

  function scheduleCelebration(callback, delay) {
    const timer = setTimeout(() => {
      celebrationTimers.delete(timer);
      callback();
    }, delay);

    celebrationTimers.add(timer);
    return timer;
  }

  function clearCelebrationTimers() {
    celebrationTimers.forEach((timer) => clearTimeout(timer));
    celebrationTimers.clear();
  }

  function getConfettiOrigin(event) {
    if (typeof window === "undefined" || !event?.clientX || !event?.clientY) {
      return { x: 0.5, y: 0.62 };
    }

    return {
      x: Math.max(0.08, Math.min(0.92, event.clientX / window.innerWidth)),
      y: Math.max(0.12, Math.min(0.86, event.clientY / window.innerHeight)),
    };
  }

  function handleListNotice(event) {
    if (!event.detail?.message) return;
    showListStatus(event.detail.message, !!event.detail.success);
  }

  async function copyText(text) {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return false;
    }

    await navigator.clipboard.writeText(text);
    return true;
  }

  async function handleShareLiveList(shareUrl = null) {
    const liveUrl = shareUrl || liveListsService.getShareUrl(list.id);
    if (!liveUrl) {
      showListStatus("Live link is not ready yet");
      soundService.locked();
      return;
    }

    const sharePayload = {
      title: "Live ZipList",
      text: "Join my live ZipList.",
      url: liveUrl,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(sharePayload);
        showListStatus("Live link shared!", true);
        soundService.copySuccess({ force: true });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    try {
      const copied = await copyText(liveUrl);
      showListStatus(
        copied
          ? "Live link copied — send it to someone lovely!"
          : "Live link ready. Copying needs browser permission.",
        copied,
      );
      if (copied) {
        soundService.copySuccess({ force: true });
      } else {
        soundService.locked({ force: true });
      }
    } catch (error) {
      console.error("Failed to copy live link:", error);
      showListStatus("Live link ready. Copying needs browser permission.");
      soundService.error({ force: true });
    }
  }

  // Share list function
  async function handleShareList() {
    if (isLive) {
      await handleShareLiveList();
      return;
    }

    if (!list || !list.items || list.items.length === 0) {
      showListStatus("Add an item before sharing.");
      soundService.locked();
      return;
    }

    try {
      const result = await shareList(list);
      if (result.success) {
        showListStatus(
          result.urlTooLong
            ? "Link copied — it's a long one, but it'll work!"
            : "Link copied — send it to someone lovely!",
          true,
          result.urlTooLong ? 5000 : 3000,
        );
        soundService.copySuccess({ force: true });
        notePwaMoment(); // a shared list earns the install suggestion
      } else {
        showListStatus("Share needs one more try.");
        soundService.error({ force: true });
      }
    } catch (error) {
      console.error("Failed to share list:", error);
      showListStatus("Share needs one more try.");
      soundService.error({ force: true });
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
      soundService.locked();
      return;
    }

    if (!$isContributor) {
      showListStatus("Contributor opens live shared lists.", false, 4200);
      hapticService.notification("warning");
      soundService.locked({ force: true });
      requestContributorUnlock();
      return;
    }

    if (!list || !list.id) {
      showListStatus("Open a list before starting live sharing.");
      soundService.locked();
      return;
    }

    if (isMakingLive) {
      showListStatus("Starting live list...", false, 1600);
      soundService.select();
      return;
    }

    isMakingLive = true;

    try {
      const { shareUrl } = await liveListsService.makeLive(list.id);
      isLive = true;

      let copied = false;
      try {
        copied = await copyText(shareUrl);
      } catch (error) {
        console.warn("Live link could not be copied:", error);
      }

      showListStatus(
        copied
          ? "Live list ready. Link copied!"
          : "Live list ready. Tap Share to send the link.",
        true,
      );
      soundService.success({ force: true });

      subscribeToLiveStores(list.id);
    } catch (error) {
      console.error("Failed to make list live:", error);
      showListStatus("Live sharing needs one more try.", false, 5000);
      soundService.error({ force: true });
    } finally {
      isMakingLive = false;
    }
  }

  function handleCreateList() {
    const result = listsService.createList();
    if (!result.ok) {
      showListStatus(result.message);
      hapticService.notification("warning");
      soundService.locked();
      if (result.reason === "max-lists") {
        requestContributorUnlock();
      }
      return;
    }

    hapticService.notification("success");
    soundService.add({ force: true });
  }

  function requestContributorUnlock() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("ziplist-open-contributor"));
  }

  function startEditingListName() {
    if (!showListManagement || !list?.id) return;
    editingListName = true;
    editedListName = list.name || "";
    hapticService.selection();
    soundService.select();
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
    soundService.select();
  }

  function cancelListNameEdit() {
    editingListName = false;
    editedListName = list.name || "";
    soundService.close();
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
  $: remoteDrafts = isLive
    ? liveActivity.drafts.filter((draft) => !draft.itemId)
    : [];
  $: remoteVoices = isLive ? liveActivity.voices : [];
  $: remoteFocusByItem = new Map(
    isLive ? liveActivity.focuses.map((focus) => [focus.itemId, focus]) : [],
  );
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

  // Handle live typing heartbeat for older clients plus richer draft activity.
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

  function flushDraftBroadcast() {
    if (!pendingDraftBroadcast || !isLive) return;

    liveListsService.broadcastDraftUpdate(list.id, pendingDraftBroadcast);
    pendingDraftBroadcast = null;
  }

  function broadcastDraftActivity(data = {}) {
    if (!isLive) return;

    pendingDraftBroadcast = data;
    if (!draftBroadcastTimeout) {
      flushDraftBroadcast();
      draftBroadcastTimeout = setTimeout(() => {
        draftBroadcastTimeout = null;
        flushDraftBroadcast();
      }, 160);
    }
  }

  function clearDraftActivity() {
    pendingDraftBroadcast = null;
    if (draftBroadcastTimeout) {
      clearTimeout(draftBroadcastTimeout);
      draftBroadcastTimeout = null;
    }

    if (isLive) {
      liveListsService.broadcastDraftClear(list.id);
    }
  }

  function handleDraftTyping(text) {
    handleTyping();
    broadcastDraftActivity({ text, mode: "typing" });
  }

  function handleEditTyping(text, itemId) {
    handleTyping();
    if (!isLive) return;

    liveListsService.broadcastItemFocus(list.id, itemId);
    broadcastDraftActivity({ text, itemId, mode: "typing" });
  }

  function clearItemFocus() {
    if (isLive) {
      liveListsService.broadcastItemFocus(list.id, null);
    }
  }

  // Helper function to calculate staggered delay for animations.
  // Capped so long lists don't take seconds to finish animating in
  // (120 items * 50ms would be a 6s cascade).
  function getStaggerDelay(index) {
    return Math.min(index * 50, 500); // 50ms between each item, max 500ms
  }

  function getItemGrabbedState(itemId) {
    return draggedItemId === itemId || touchDragItemId === itemId
      ? "true"
      : "false";
  }

  function getRemoteFocus(itemId) {
    return remoteFocusByItem.get(itemId) || null;
  }

  function getRemoteItemStyle(itemId) {
    const remoteFocus = getRemoteFocus(itemId);
    return remoteFocus
      ? `--remote-color: ${remoteFocus.color}; --remote-glow: ${remoteFocus.color}33;`
      : "";
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
    soundService.select();
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
      soundService.drop();
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
    soundService.select();
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
      soundService.drop();
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
      soundService.locked();
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
    soundService.drop();
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
    const willCheckItem = itemToToggle && !itemToToggle.checked;
    const willCompleteList =
      willCheckItem &&
      list.items.length > 0 &&
      list.items
        .filter((item) => item.id !== itemId)
        .every((item) => item.checked);

    // Apply haptic feedback
    if (itemToToggle) {
      hapticService.impact(itemToToggle.checked ? "light" : "medium");
      if (willCompleteList) {
        soundService.complete({ force: true });
      } else if (willCheckItem) {
        soundService.check();
      } else {
        soundService.uncheck();
      }
    }

    // Toggle the item state
    listsService.toggleItem(itemId, list.id);
    markItemSettling(itemId);

    // If checking the item (not unchecking), add sparkle animation
    if (!itemToToggle?.checked) {
      const origin = getConfettiOrigin(event);

      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: Math.max(
          24,
          Math.round(ANIMATION.CONFETTI.PIECE_COUNT * 0.7),
        ),
        spread: 54,
        origin: origin,
        colors: ["#FFB000", "#FF6AC2", "#00D4FF"], // Use app colors
        disableForReducedMotion: true,
      });

      // Add sparkle animation after a small delay
      scheduleCelebration(() => {
        const checkbox = document.getElementById(`item-${list.id}-${itemId}`);
        if (checkbox) {
          // Force reflow to restart animation
          void checkbox.offsetWidth;

          // Check if we've completed all items
          const allCompleted =
            list.items.length > 0 &&
            list.items.filter((i) => i.id !== itemId).every((i) => i.checked);

          // If this completes the list, trigger haptic feedback but no message
          if (allCompleted) {
            hapticService.notification("success");

            // Extra confetti for finishing the list!
            scheduleCelebration(() => {
              confetti({
                particleCount: ANIMATION.CONFETTI.PIECE_COUNT,
                spread: 82,
                origin: { x: 0.5, y: 0.62 },
                colors: ["#FFB000", "#FF6AC2", "#00D4FF"],
                disableForReducedMotion: true,
              });
            }, 300);
          }
        }
      }, 50);
    }
  }

  function startEditingItem(item) {
    if (item.checked) return;
    clearDraftActivity();
    draftItemActive = false;
    draftItemText = "";
    editingItemId = item.id;
    editedItemText = item.text;
    if (isLive) {
      liveListsService.broadcastItemFocus(list.id, item.id);
      broadcastDraftActivity({
        text: item.text,
        itemId: item.id,
        mode: "typing",
      });
    }
    soundService.select();
  }

  function saveItemEdit() {
    if (editingItemId === null) return;

    const itemId = editingItemId;
    const nextText = editedItemText.trim();

    if (nextText) {
      listsService.editItem(itemId, nextText, list.id);
      hapticService.selection();
      soundService.select();
      editingItemId = null;
      editedItemText = "";
      clearDraftActivity();
      clearItemFocus();
    } else {
      deleteItem(itemId);
    }
  }

  function cancelItemEdit() {
    editingItemId = null;
    editedItemText = "";
    clearDraftActivity();
    clearItemFocus();
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
    soundService.delete();
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

    // Filter out both the deleted item AND any duplicate that was added while undo was pending
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
    soundService.add({ force: true });
    undoDelete = null;

    if (undoDeleteTimer) {
      clearTimeout(undoDeleteTimer);
      undoDeleteTimer = null;
    }
  }

  async function startDraftItem() {
    hapticService.selection();
    soundService.select();
    clearItemFocus();
    editingItemId = null;
    editedItemText = "";
    draftItemActive = true;
    draftItemText = "";
    broadcastDraftActivity({ text: "", mode: "typing" });

    await tick();
    draftInputNode?.scrollIntoView({ block: "center", behavior: "smooth" });
    draftInputNode?.focus();
  }

  // Returns true when an item was actually committed, so callers (e.g. Enter
  // for rapid-fire adds) know whether to keep the draft open for the next one.
  function saveDraftItem({ keepAdding = false } = {}) {
    const newText = draftItemText.trim();
    let didAdd = false;

    if (newText) {
      const result = listsService.addItem(newText, list.id);
      if (!result.ok) {
        showListStatus(result.message || "That item needs one more try.");
        hapticService.notification("warning");
        soundService.locked();
        return false;
      }

      if (result.message) {
        showListStatus(result.message, true);
      }
      soundService.add({ force: true });
      didAdd = true;
    }

    hapticService.selection();

    // Rapid-fire: a committed Enter clears the field but keeps the draft row
    // open and focused so you can keep piling items in without re-reaching for
    // the button. An empty Enter (nothing to add) closes out like before.
    if (keepAdding && didAdd) {
      draftItemText = "";
      broadcastDraftActivity({ text: "", mode: "typing" });
      draftInputNode?.focus();
      return true;
    }

    draftItemActive = false;
    draftItemText = "";
    clearDraftActivity();
    return didAdd;
  }

  function cancelDraftItem() {
    draftItemActive = false;
    draftItemText = "";
    clearDraftActivity();
    hapticService.selection();
    soundService.close();
  }

  function handleDraftItemKeyDown(event) {
    if (event.key === "Enter") {
      // Keep the draft open on Enter for rapid-fire adds; blur/Escape close it.
      saveDraftItem({ keepAdding: true });
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

<section
  class="zl-card"
  aria-labelledby="list-title-{list.id || 'active'}"
>
  <span id="list-title-{list.id || 'active'}" class="zl-visually-hidden">
    {accessibleListName}
  </span>
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
                  title="Tap to rename"
                >
                  <span class="zl-list-title-inner">
                    <span
                      class="zl-list-color-dot"
                      style="background: {list.primaryColor};"
                      aria-hidden="true"
                    ></span>
                    <span class="zl-list-title" class:is-default={isDefaultName}>
                      {list.name}
                    </span>
                  </span>
                </button>
              </h2>
            {:else}
              <!-- Guest view: no color dot — list color-coding is the
                   owner's filing system, meaningless in a shared room -->
              <h2 class="zl-list-title-inner">
                <span class="zl-list-title">{list.name}</span>
              </h2>
            {/if}
            {#if isLive}
              <div
                class="zl-live-presence"
                title="Live — {presence.length} here"
                aria-label="Live list. {presence.length} collaborators online"
              >
                <span class="zl-live-presence-pulse" aria-hidden="true"></span>
                <span class="zl-live-presence-label" aria-hidden="true"
                  >Live</span
                >
                {#if presence.length > 0}
                  <div class="zl-presence-dots" aria-hidden="true">
                    {#each presence.slice(0, 4) as user (user.id)}
                      <img
                        class="zl-presence-dot"
                        title={user.avatar}
                        alt=""
                        src={getAvatarImage(user.avatar)}
                        style="background-color: {getAvatarColor(user.avatar)}"
                      />
                    {/each}
                  </div>
                {/if}
                {#if presence.length > 4}
                  <span class="zl-live-presence-count" aria-hidden="true"
                    >+{presence.length - 4}</span
                  >
                {/if}
              </div>
            {/if}
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
            <svg
              class="zl-header-icon"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        {/if}
        {#if liveFeatureAvailable}
          {#if !isLive}
            <button
              type="button"
              class="zl-live-button"
              class:locked={!$isContributor}
              disabled={isMakingLive}
              on:click={handleMakeLive}
              title={$isContributor
                ? isMakingLive
                  ? "Starting live list"
                  : "Enable real-time collaboration"
                : "Contributor opens live shared lists"}
              aria-busy={isMakingLive}
              aria-label={isMakingLive
                ? "Starting live list"
                : `Make Live. Enable real-time collaboration for ${
                    list.name || "this list"
                  }`}
            >
              <svg
                class="zl-header-icon"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path>
                <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path>
                <circle cx="12" cy="12" r="2"></circle>
                <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path>
                <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"></path>
              </svg>
            </button>
          {/if}
        {/if}

        <button
          type="button"
          class="zl-share-button"
          on:click={handleShareList}
          title={isLive ? "Share live list link" : "Share list link"}
          aria-label={isLive
            ? `Share live link for ${list.name || "this list"}`
            : `Share ${list.name || "this list"}`}
        >
          <svg
            class="zl-header-icon"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
            ></path>
            <path
              d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
            ></path>
          </svg>
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

    {#if isLive && typingUsers.length > 0}
      <span class="zl-visually-hidden" role="status" aria-live="polite">
        Collaborator activity in this live list.
      </span>
    {/if}

    <!-- List Items -->
    <div class="zl-list-container" bind:this={listContainerNode}>
      {#if list.items.length > 0 || draftItemActive || remoteDrafts.length > 0 || remoteVoices.length > 0}
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
              class:remote-focused={!!getRemoteFocus(item.id)}
              style={getRemoteItemStyle(item.id)}
              draggable={!item.checked &&
                editingItemId !== item.id &&
                !touchDragItemId}
              on:dragstart|passive={(e) => handleDragStart(e, item.id)}
              on:dragend|passive={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
              animate:flip={{ duration: touchDragItemId ? 180 : 300 }}
              in:itemIn={{ delay: getStaggerDelay(index) }}
              out:itemOut
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
                onTyping={handleEditTyping}
                onReorderClick={() => hapticService.selection()}
                onReorderKeyDown={handleReorderKeyDown}
                onTouchGrabStart={handleTouchGrabStart}
                onDelete={deleteItem}
              />
            </li>
          {/each}

          {#each remoteVoices as activity, index (activity.id)}
            <LiveActivityRow
              {activity}
              type="voice"
              staggerDelay={getStaggerDelay(renderedActiveItems.length + index)}
            />
          {/each}

          {#each remoteDrafts as activity, index (activity.id)}
            <LiveActivityRow
              {activity}
              type="draft"
              staggerDelay={getStaggerDelay(
                renderedActiveItems.length + remoteVoices.length + index,
              )}
            />
          {/each}

          {#if draftItemActive}
            <DraftItemRow
              listId={list.id}
              bind:draftItemText
              bind:inputNode={draftInputNode}
              staggerDelay={getStaggerDelay(renderedActiveItems.length)}
              onSaveDraft={saveDraftItem}
              onDraftKeyDown={handleDraftItemKeyDown}
              onTyping={handleDraftTyping}
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
              class:remote-focused={!!getRemoteFocus(item.id)}
              style={getRemoteItemStyle(item.id)}
              draggable={!item.checked &&
                editingItemId !== item.id &&
                !touchDragItemId}
              on:dragstart|passive={(e) => handleDragStart(e, item.id)}
              on:dragend|passive={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
              animate:flip={{ duration: touchDragItemId ? 180 : 300 }}
              in:itemIn={{
                delay: getStaggerDelay(renderedActiveItems.length + index + 1),
              }}
              out:itemOut
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
                onTyping={handleEditTyping}
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
