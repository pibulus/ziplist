<script>
  import { onMount, onDestroy, tick } from "svelte";
  import { get } from "svelte/store";
  import {
    listsStore,
    LIST_COLOR_PRESETS,
  } from "$lib/services/lists/listsStore";

  const DEFAULT_LIST_NAMES = new Set(
    LIST_COLOR_PRESETS.map((p) => p.defaultName),
  );
  import { listsService } from "$lib/services/lists/listsService";
  import { geminiService } from "$lib/services/geminiService";
  import {
    listToText,
    splitPastedList,
  } from "$lib/services/lists/listTextFormat.js";
  import { shareList, generateShareableUrl } from "$lib/services/share";
  import { tagColour } from "$lib/services/lists/itemTags";
  import { notePwaMoment } from "$lib/components/PwaInstallCard.svelte";
  import { fade } from "svelte/transition";
  import { cubicOut, backOut, quintOut } from "svelte/easing";
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
  function itemOut() {
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
    getOrCreateAvatar,
  } from "$lib/services/realtime/avatarService";
  import { getLiveActivityStore } from "$lib/services/realtime/liveActivityStore";
  import { getPresenceStore } from "$lib/services/realtime/presenceStore";
  import { getTypingStore } from "$lib/services/realtime/typingStore";
  import { ANIMATION, PRODUCT_LIMITS } from "$lib/constants";
  import { isContributor } from "$lib";
  import { autoFocus } from "./autoFocus.js";
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
  let isMagicParsing = false; // AI smart paste in progress
  let activeTagFilter = null; // Filter items in list by tag
  let undoDelete = null;
  let undoDeleteTimer = null;
  let previousListIdentity = null;
  let isLive = false; // Track if this list is live
  let liveFeatureAvailable = false;
  let isMakingLive = false;
  let presence = []; // Who's online
  let localAvatar = "";
  $: remotePresence = presence.filter((u) => u.avatar && u.avatar !== localAvatar);
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
  const MOBILE_REORDER_AUTO_SCROLL_EDGE_PX = 88;
  let touchDragPreviewItems = null;
  let touchDragItemId = null;
  let touchDragPendingItemId = null;
  let touchDragPendingTouchId = null;
  let touchDragStartY = 0;
  let touchDragCurrentY = 0;
  let touchDragTilt = 0; // deg — smoothed vertical-velocity lean on the ghost
  let touchDragGhostRect = null;
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
    localAvatar = getOrCreateAvatar();
    // Initialize the lists store
    listsStore.initialize();
    listsService.getAllLists();

    // Check if this list is already live. A reload wipes the in-memory
    // connection map, so a list that IS in a room comes back looking local —
    // resumeLive() reconnects it to the SAME room using the id saved on the
    // list. Without this, tapping "Go live" again minted a new room and
    // silently separated people who were already sharing.
    if (list && list.id) {
      isLive = liveListsService.isLive(list.id);
      if (isLive) {
        subscribeToLiveStores(list.id);
        liveListsService.resumeLive(list.id).then((rejoined) => {
          if (rejoined) return;
          // resumeLive clears the flags when the room is gone; follow the store.
          isLive = liveListsService.isLive(list.id);
        });
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("ziplist-list-notice", handleListNotice);
      window.addEventListener("ziplist-heart", handleRemoteHeart);
      window.addEventListener("ziplist-item-checked", handleRemoteItemChecked);
      window.addEventListener("keydown", handleGlobalKeyDown);
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
        window.removeEventListener("ziplist-heart", handleRemoteHeart);
        window.removeEventListener(
          "ziplist-item-checked",
          handleRemoteItemChecked,
        );
      window.removeEventListener("keydown", handleGlobalKeyDown);
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
  async function handleShareList(listToShare = list) {
    if (isLive) {
      await handleShareLiveList();
      return;
    }

    if (!listToShare || !listToShare.items || listToShare.items.length === 0) {
      showListStatus("Add an item before sharing.");
      soundService.locked();
      return;
    }

    try {
      const result = await shareList(listToShare);
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

    // Volume gate, not a feature gate: anyone can make a list live. Free
    // runs one live list at a time; contributor runs several. Only fires
    // when a DIFFERENT list is already live — re-tapping the live list
    // itself falls through to the isLive branch below.
    const maxLiveLists = $isContributor
      ? PRODUCT_LIMITS.CONTRIBUTOR_MAX_LIVE_LISTS
      : PRODUCT_LIMITS.FREE_MAX_LIVE_LISTS;
    if (
      !liveListsService.isLive(list?.id) &&
      liveListsService.getLiveListCount() >= maxLiveLists
    ) {
      showListStatus(
        $isContributor
          ? `ZipList runs ${maxLiveLists} live lists at once. End one to start another.`
          : `Free ZipList runs one live list at a time. End that one, or run more at once with Contributor.`,
        false,
        4200,
      );
      hapticService.notification("warning");
      soundService.locked({ force: true });
      if (!$isContributor) requestContributorUnlock();
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
      // startPhraseSync, not makeLive: it mints four words, derives the room
      // from them and hands back /j/<words>. "Send it to my other device" and
      // "share it with someone" were always the same room — now they're the
      // same link too, and it's one you can say out loud.
      const { shareUrl, phrase } = await liveListsService.startPhraseSync(
        list.id,
      );
      syncPhrase = phrase;
      isLive = true;

      let copied = false;
      try {
        copied = await copyText(shareUrl);
      } catch (error) {
        console.warn("Live link could not be copied:", error);
      }

      showListStatus(
        copied
          ? "Live. Link copied — or read out the words."
          : "Live. Tap the link icon to grab the link.",
        true,
      );
      soundService.success({ force: true });

      subscribeToLiveStores(list.id);
    } catch (error) {
      console.error("Failed to make list live:", error);
      // Only promise a retry when retrying could actually help. A 503 with
      // live_misconfigured is a server-side config fault that will fail
      // identically every time until someone fixes the deployment.
      const isConfigFault =
        error?.code === "live_misconfigured" || error?.status === 503;
      showListStatus(
        isConfigFault
          ? "Live sharing is down right now. Static share still works."
          : "Live sharing needs one more try.",
        false,
        5000,
      );
      soundService.error({ force: true });
    } finally {
      isMakingLive = false;
    }
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
  $: filteredSortedItems = activeTagFilter
    ? sortedItems.filter((item) => item.tags?.includes(activeTagFilter))
    : sortedItems;
  $: renderedActiveItems = filteredSortedItems.filter((item) => !item.checked);
  $: renderedCompletedItems = filteredSortedItems.filter((item) => item.checked);
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
  // Ghost transport is TRANSFORM-only: top/left/width are laid out once at
  // grab, then every finger move is a translate3d — compositor work, no
  // layout thrash (the old `top:` updates re-laid-out every frame).
  // --drag-tilt carries the finger's vertical velocity so the card leans
  // into fast moves and rights itself when you slow down.
  $: touchGhostStyle =
    touchDraggedItem && touchDragGhostRect
      ? `top: ${touchDragGhostRect.top}px; left: ${touchDragGhostRect.left}px; width: ${touchDragGhostRect.width}px; transform: translate3d(0, ${
          touchDragCurrentY - touchDragStartY
        }px, 0); --drag-tilt: ${touchDragTilt}deg;`
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

  // ── The heart ──────────────────────────────────────────────────────
  // The whole feature: someone taps it, everyone's screen blooms in that
  // person's colour. No count, no leaderboard, no persistence — it's the
  // multiplayer equivalent of catching someone's eye across a room.
  let hearts = [];
  let heartSeq = 0;

  function bloom(colour) {
    const id = (heartSeq += 1);
    // Slight horizontal scatter so two taps never stack identically.
    const drift = Math.round((id * 37) % 40) - 20;
    hearts = [...hearts, { id, colour, drift }];
    setTimeout(() => {
      hearts = hearts.filter((heart) => heart.id !== id);
    }, 1500);
  }

  function tapHeart() {
    hapticService.selection();
    soundService.select();
    bloom(myAvatarColour);
    if (isLive) {
      liveListsService.broadcastHeart(list.id);
    }
  }

  // Someone else ticked something off. You already feel your own checks —
  // this is for knowing the milk got got while you were looking elsewhere.
  let checkedBlooms = new Map();

  function handleRemoteItemChecked(event) {
    if (event.detail?.listId !== list.id) return;
    const { itemId, sender } = event.detail;
    if (!itemId) return;

    checkedBlooms = new Map(checkedBlooms).set(itemId, {
      colour: getAvatarColor(sender.avatar),
      key: (heartSeq += 1),
    });
    setTimeout(() => {
      const next = new Map(checkedBlooms);
      next.delete(itemId);
      checkedBlooms = next;
    }, 1400);
  }

  function handleRemoteHeart(event) {
    if (event.detail?.listId !== list.id) return;
    bloom(getAvatarColor(event.detail.sender.avatar));
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

    touchDragTilt = 0;
    touchDragPreviewItems = null;
    touchDragItemId = null;
    touchDragPendingItemId = null;
    touchDragPendingTouchId = null;
    touchDragGhostRect = null;
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
    if (!draggedNode || !listContainerNode) {
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

    const containerRect = listContainerNode.getBoundingClientRect();
    const nodeRect = draggedNode.getBoundingClientRect();
    touchDragItemId = touchDragPendingItemId;
    touchDragGhostRect = {
      top: nodeRect.top - containerRect.top + listContainerNode.scrollTop,
      left: nodeRect.left - containerRect.left,
      width: nodeRect.width,
      height: nodeRect.height,
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

    stopTouchDragAutoScroll();
    addTouchDragListeners();

    const touch = event.changedTouches[0];
    touchDragPendingItemId = itemId;
    touchDragPendingTouchId = touch.identifier;
    touchDragStartY = touch.clientY;
    touchDragCurrentY = touch.clientY;

    startTouchDrag();
  }

  function handleTouchGrabMove(event) {
    const touch = getTrackedTouch(event);
    if (!touch) return;

    if (!touchDragItemId) {
      return;
    }

    event.preventDefault();
    // Lean into the move: raw per-event delta, low-passed so it reads as
    // carry rather than jitter. Clamped to a whisper (±3°).
    const rawTilt = Math.max(
      -3,
      Math.min(3, (touch.clientY - touchDragCurrentY) * 0.35),
    );
    touchDragTilt = touchDragTilt * 0.65 + rawTilt * 0.35;
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
  function getDragOverPosition(event, targetItemId) {
    if (!draggedItemId || draggedItemId === targetItemId) return null;

    const sourceIndex = activeItems.findIndex(
      (item) => item.id === draggedItemId,
    );
    const targetIndex = activeItems.findIndex(
      (item) => item.id === targetItemId,
    );

    if (sourceIndex === -1 || targetIndex === -1) return null;

    // Direct predecessor: hovering over the item immediately above means move BEFORE that item
    if (targetIndex === sourceIndex - 1) {
      return "before";
    }
    // Direct successor: hovering over the item immediately below means move AFTER that item
    if (targetIndex === sourceIndex + 1) {
      return "after";
    }

    // For items 2+ positions away, split by vertical midpoint
    const targetBounds = event.currentTarget.getBoundingClientRect();
    return event.clientY > targetBounds.top + targetBounds.height / 2
      ? "after"
      : "before";
  }

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
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    if (!draggedItemId || draggedItemId === itemId) {
      if (dragOverItemId) {
        dragOverItemId = null;
        dragOverPosition = "before";
      }
      return;
    }

    // Don't allow drag over on checked items
    const targetItem = list.items.find((item) => item.id === itemId);
    if (targetItem?.checked) {
      if (dragOverItemId) {
        dragOverItemId = null;
        dragOverPosition = "before";
      }
      return;
    }

    const nextPosition = getDragOverPosition(event, itemId);
    if (!nextPosition) return;

    // Only update if position or target changed
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

    if (!draggedItemId || draggedItemId === targetItemId) {
      draggedItemId = null;
      dragOverItemId = null;
      dragOverPosition = "before";
      return;
    }

    // Check if target is a completed item (don't allow dropping on completed items)
    const targetItem = list.items.find((item) => item.id === targetItemId);
    if (targetItem?.checked) {
      draggedItemId = null;
      dragOverItemId = null;
      dragOverPosition = "before";
      return;
    }

    // Reorder only active items, then keep completed items anchored at the bottom.
    const reorderedActiveItems = [...activeItems];
    const sourceIndex = reorderedActiveItems.findIndex(
      (item) => item.id === draggedItemId,
    );
    const targetIndex = reorderedActiveItems.findIndex(
      (item) => item.id === targetItemId,
    );

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const position =
        dragOverItemId === targetItemId
          ? dragOverPosition
          : getDragOverPosition(event, targetItemId) || "before";
      const insertAfter = position === "after";
      let destinationIndex = targetIndex + (insertAfter ? 1 : 0);
      const [movedItem] = reorderedActiveItems.splice(sourceIndex, 1);

      if (sourceIndex < destinationIndex) {
        destinationIndex -= 1;
      }

      reorderedActiveItems.splice(destinationIndex, 0, movedItem);

      const didMove = sourceIndex !== destinationIndex;

      if (didMove) {
        listsService.reorderItems(
          [...reorderedActiveItems, ...completedItems],
          list.id,
        );
        hapticService.impact("heavy");
        soundService.drop();
        markItemSettling(draggedItemId);
      } else {
        hapticService.selection();
      }
    }

    draggedItemId = null;
    dragOverItemId = null;
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

  // ── Order play: shuffle & entry-order sort ─────────────────────────────
  function shuffleActiveItems() {
    const active = list.items.filter((i) => !i.checked);
    if (active.length < 2) return;
    const shuffled = [...active];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const completed = list.items.filter((i) => i.checked);
    listsService.reorderItems([...shuffled, ...completed], list.id);
    soundService.ratchet({ force: true });
    hapticService.impact("medium");
    showListStatus("Shuffled. Fate decides.", true, 2200);
  }

  // Sort is a toggle, not a one-way trip: press once for oldest-first, again
  // for newest-first. The tooltip advertises what the NEXT press does.
  let sortNewestFirst = false;

  // ── Send an item to another list ───────────────────────────────────────
  // listsStore.moveItem has been fully implemented (dedupe guard, insert
  // above the checked block, reindex both sides) and completely unreachable —
  // nothing ever called it. This is the UI it was waiting for.
  let movingItemId = null;

  $: moveTargets = ($listsStore?.lists ?? [])
    .filter((candidate) => candidate.id !== list.id)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name || "Untitled list",
      primary: candidate.primaryColor || candidate.color || "",
    }));

  // ── Share / export tray ────────────────────────────────────────────────
  let shareTrayOpen = false;
  let shareInputMode = null;
  let pasteText = "";
  let syncPhrase = "";

  // ── Sending part of a list ─────────────────────────────────────────────
  // Only ever appears on a list that HAS tags — a filter row on a list with
  // nothing to filter is furniture, and most lists never grow a single tag.
  // The filter shapes what LEAVES: the copy, the text, the file, the QR.
  // A live room is the whole list by definition, so the row hides there.
  let shareTagFilter = null;

  $: shareableList = shareTagFilter
    ? {
        ...list,
        items: list.items.filter((item) =>
          (item.tags ?? []).includes(shareTagFilter),
        ),
      }
    : list;

  $: shareFilterCount = shareableList.items.length;

  // Switching lists takes its tags with it; a stale filter would silently
  // send an empty list.
  $: if (list.id) shareTagFilter = null;

  function toggleShareTag(tag) {
    shareTagFilter = shareTagFilter === tag ? null : tag;
    hapticService.selection();
    soundService.select();
  }

  function toggleShareTray() {
    shareTrayOpen = !shareTrayOpen;
    if (!shareTrayOpen) {
      shareInputMode = null;
      syncPhrase = "";
      shareTagFilter = null;
    }
    soundService.select();
  }

  function toggleShareInput() {
    shareInputMode = shareInputMode === "paste" ? null : "paste";
  }

  async function shareAsLink() {
    const listToShare = shareableList;
    shareTrayOpen = false;
    await handleShareList(listToShare);
  }

  // The live door in the share tray. Keeps the tray open while the room is
  // minted so the four-word phrase can appear in it — that phrase IS the
  // link, and closing the tray would hide it the moment it arrived.
  async function shareAsLiveRoom() {
    await handleMakeLive();
  }

  async function handleStopLive() {
    if (!list?.id) return;
    liveListsService.disconnectFromLive(list.id);
    listsStore.upsertList(
      { id: list.id, isLive: false, liveRoomId: null },
      list.id,
    );
    isLive = false;
    syncPhrase = "";
    shareTrayOpen = false;
    showListStatus("Live sharing ended.", true, 2400);
    hapticService.impact("medium");
    soundService.close({ force: true });
  }

  async function copyAsText() {
    try {
      await navigator.clipboard.writeText(listToText(shareableList));
      shareTrayOpen = false;
      showListStatus("Copied as text.", true, 2200);
      soundService.copySuccess({ force: true });
    } catch {
      showListStatus("Copy did not take this time.", false, 2400);
    }
  }

  function downloadAsText() {
    const baseName = shareTagFilter
      ? `${list.name || "ziplist"} ${shareTagFilter}`
      : list.name || "ziplist";
    const name = baseName.replace(/[^\w\- ]+/g, "").trim() || "ziplist";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([listToText(shareableList)], { type: "text/plain" }),
    );
    a.download = `${name}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    shareTrayOpen = false;
    showListStatus("Saved as a text file.", true, 2200);
    soundService.copySuccess({ force: true });
  }

  function qrThisList() {
    if (!shareableList?.items?.length) {
      showListStatus("Add an item before sharing.");
      soundService.locked();
      return;
    }
    // Under the share-warning length the whole list lives INSIDE the code —
    // scanning it carries the data itself, no server round-trip. Over it,
    // fall back to what the share flow would hand out anyway: the short live
    // link when the list is live, otherwise the same long link (denser code).
    const rawUrl = generateShareableUrl(shareableList);
    let qrTarget = rawUrl;
    if (rawUrl.length > PRODUCT_LIMITS.SHARE_URL_WARNING_LENGTH && isLive) {
      qrTarget = liveListsService.getShareUrl(list.id) || rawUrl;
    }
    window.open(
      `https://qrbuddy.app/q?d=${encodeURIComponent(qrTarget)}&s=sunset`,
      "_blank",
      "noopener",
    );
    shareTrayOpen = false;
    showListStatus("QR ready in the new tab.", true, 2400);
    soundService.select();
  }

  function pasteItemsIn() {
    const { items } = splitPastedList(pasteText);
    if (!items.length) {
      showListStatus("Nothing in there to add.", false, 2200);
      return;
    }
    const result = listsService.addItems(items, list.id);
    const added = result?.addedCount ?? 0;
    pasteText = "";
    shareInputMode = null;
    shareTrayOpen = false;
    showListStatus(
      added === 0
        ? "Those were all here already."
        : `Added ${added} ${added === 1 ? "thing" : "things"}.`,
      added > 0,
      2400,
    );
    if (added) soundService.copySuccess({ force: true });
  }

  async function magicAiPaste() {
    if (!pasteText.trim()) {
      showListStatus("Paste some text first.", false, 2200);
      return;
    }

    isMagicParsing = true;
    showListStatus("Magic parsing with AI...", true, 4000);
    hapticService.impact("light");

    try {
      const existing = list.items.map((i) => i.text);
      const existingTags = listsStore.getAllTags();
      const result = await geminiService.parseUnstructuredText(
        pasteText,
        existing,
        existingTags,
      );

      if (result?.items && result.items.length > 0) {
        if (
          result.title &&
          (!list.name || DEFAULT_LIST_NAMES.has(list.name))
        ) {
          listsService.renameList(list.id, result.title);
        }

        const addResult = listsService.addItems(result.items, list.id);
        const added = addResult?.addedCount ?? result.items.length;

        pasteText = "";
        shareInputMode = null;
        shareTrayOpen = false;

        showListStatus(
          `Magic added ${added} ${added === 1 ? "item" : "items"}${
            result.title ? ` to "${result.title}"` : ""
          }!`,
          true,
          3000,
        );
        soundService.add({ force: true });
        hapticService.notification("success");
      } else {
        pasteItemsIn();
      }
    } catch (err) {
      console.warn("Magic paste fallback:", err);
      showListStatus("Could not reach AI. Added as raw lines.", false, 2500);
      pasteItemsIn();
    } finally {
      isMagicParsing = false;
    }
  }

  function handlePortalClick(targetName) {
    if (!targetName) return;
    const allLists = get(listsStore).lists;
    let target = allLists.find(
      (l) => l.name.toLowerCase() === targetName.toLowerCase(),
    );
    if (!target) {
      const created = listsService.addList(targetName);
      if (created?.id) target = { id: created.id };
    }
    if (target?.id) {
      listsStore.setActiveList(target.id);
      hapticService.impact("medium");
      soundService.select();
    }
  }

  function toggleActiveTagFilter(tag) {
    if (activeTagFilter === tag) {
      activeTagFilter = null;
      soundService.select();
    } else {
      activeTagFilter = tag;
      soundService.select();
      hapticService.selection();
    }
  }

  function clearActiveTagFilter() {
    activeTagFilter = null;
    soundService.select();
  }

  function spinOutTagToNewList() {
    if (!activeTagFilter) return;

    // Capitalize tag name: e.g. "music" -> "Music", "weekend-reno" -> "Weekend Reno"
    const newListName = activeTagFilter
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    // Extract all items in current list matching this tag
    const taggedItems = list.items.filter((item) =>
      item.tags?.includes(activeTagFilter),
    );

    if (!taggedItems.length) {
      showListStatus("No items with that tag.", false, 2000);
      return;
    }

    try {
      // Create new list
      const createResult = listsStore.addList(newListName);
      if (!createResult.ok) {
        showListStatus(
          createResult.message || "Could not create new list. Check list limit.",
          false,
          3200,
        );
        return;
      }

      const newListId = createResult.listId;

      // Add items to new list
      listsStore.addItems(
        taggedItems.map(({ text, checked, tags }) => ({
          text,
          checked,
          tags,
        })),
        newListId,
      );

      // Move / Remove these items from current list
      const remainingItems = list.items.filter(
        (item) => !item.tags?.includes(activeTagFilter),
      );
      listsStore.upsertList(
        {
          ...list,
          items: remainingItems,
          updatedAt: new Date().toISOString(),
        },
        list.id,
      );

      // Switch to new list!
      listsStore.setActiveList(newListId);
      activeTagFilter = null;

      soundService.sparkle({ force: true });
      hapticService.notification("success");
      showListStatus(`Resampled #${newListName} into its own list!`, true, 3000);
    } catch (err) {
      console.error("Error spinning out tag:", err);
      showListStatus("Could not resample tag into a new list.", false, 2500);
    }
  }

  async function copyPhraseLink() {
    if (!syncPhrase) return;
    const url = `${window.location.origin}/j/${syncPhrase}`;
    const copied = await copyText(url).catch(() => false);
    hapticService.selection();
    soundService.select();
    showListStatus(
      copied ? "Link copied" : "Couldn't copy — read the words out instead",
      copied,
      2400,
    );
  }


  function requestMove(itemId) {
    movingItemId = movingItemId === itemId ? null : itemId;
    if (movingItemId) soundService.select();
  }

  function moveItemToList(itemId, targetListId) {
    const result = listsService.moveItem(itemId, list.id, targetListId);
    movingItemId = null;

    if (result?.success) {
      soundService.copySuccess({ force: true });
      hapticService.impact("light");
      showListStatus(result.message || "Moved.", true, 2200);
    } else {
      soundService.locked();
      showListStatus(result?.message || "Could not move that item.", false, 2600);
    }
  }

  function sortItemsByAdded() {
    const active = list.items.filter((i) => !i.checked);
    if (active.length < 2) return;
    // addedAt is epoch ms on items created since the stamp landed; older
    // items fall back to their current index (tiny vs epoch), which sorts
    // them first while preserving their relative order — correct, since
    // they genuinely predate every stamped item.
    const sorted = active
      .map((item, index) => ({ item, index }))
      .sort(
        (a, b) =>
          (a.item.addedAt ?? a.index) - (b.item.addedAt ?? b.index) ||
          a.index - b.index,
      )
      .map((entry) => entry.item);
    if (sortNewestFirst) sorted.reverse();
    const completed = list.items.filter((i) => i.checked);
    listsService.reorderItems([...sorted, ...completed], list.id);
    soundService.select();
    hapticService.impact("light");
    showListStatus(
      sortNewestFirst ? "Newest first." : "Back in the order you added them.",
      true,
      2200,
    );
    sortNewestFirst = !sortNewestFirst;
  }

  // ── Full-clear celebration (lists with 5+ items only) ──────────────────
  let celebrationBurst = null;

  function fireListCompleteCelebration() {
    if (prefersReducedMotion) return;
    const colors = [
      list.primaryColor || "#ffb000",
      list.accentColor || "#ff6ac2",
      "#ffd166",
      "#fff6e6",
      "#76ead7",
    ];
    celebrationBurst = Array.from({ length: 28 }, (_, i) => ({
      i,
      left: 6 + Math.random() * 88,
      dx: (Math.random() - 0.5) * 150,
      rot: (Math.random() - 0.5) * 760,
      delay: Math.random() * 180,
      dur: 950 + Math.random() * 550,
      size: 6 + Math.random() * 7,
      color: colors[i % colors.length],
    }));
    const timer = setTimeout(() => {
      celebrationBurst = null;
      celebrationTimers.delete(timer);
    }, 1900);
    celebrationTimers.add(timer);
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

    // Tell the room — but only on the way IN. Un-checking is a correction,
    // not an accomplishment, and celebrating it would be sarcasm.
    if (willCheckItem && isLive) {
      liveListsService.broadcastItemChecked(list.id, itemId);
    }

    // Apply haptic feedback
    if (itemToToggle) {
      hapticService.impact(itemToToggle.checked ? "light" : "medium");
      if (willCompleteList) {
        // Five-plus items done = a real accomplishment: confetti + fanfare.
        // Smaller lists keep the modest completion chime.
        if (list.items.length >= 5) {
          soundService.fanfare({ force: true });
          fireListCompleteCelebration();
        } else {
          soundService.complete({ force: true });
        }
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

  // Tell the room which line you're in, so two people don't quietly overwrite
  // each other. The whole pipeline for this already existed — sender, protocol,
  // worker relay, receiving store, even a focus-by-item Map in this component.
  // Nothing had ever called it.

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

  $: myAvatarColour = getAvatarColor(getOrCreateAvatar());

  $: suggestedTags = [
    ...new Set((list?.items ?? []).flatMap((entry) => entry.tags ?? [])),
  ];

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
    } else if (
      event.key === "Backspace" &&
      (event.metaKey || event.ctrlKey)
    ) {
      // Cmd/Ctrl+Backspace while editing deletes the whole item.
      event.preventDefault();
      deleteItem(editingItemId);
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

  function clearDoneItems() {
    const doneItems = list.items.filter((item) => item.checked);
    if (!doneItems.length) return;

    hapticService.impact("medium");
    soundService.delete();

    if (undoDeleteTimer) clearTimeout(undoDeleteTimer);

    undoDelete = {
      items: [...doneItems],
      listId: list.id,
      type: "done",
      count: doneItems.length,
      originalListItems: [...list.items],
    };

    listsStore.upsertList(
      {
        ...list,
        items: list.items.filter((item) => !item.checked),
        updatedAt: new Date().toISOString(),
      },
      list.id,
    );

    undoDeleteTimer = setTimeout(() => {
      undoDelete = null;
      undoDeleteTimer = null;
    }, 5500);
  }

  function clearEntireList() {
    if (!list.items.length) return;

    hapticService.impact("medium");
    soundService.delete();

    if (undoDeleteTimer) clearTimeout(undoDeleteTimer);

    undoDelete = {
      items: [...list.items],
      listId: list.id,
      type: "all",
      count: list.items.length,
      originalListItems: [...list.items],
    };

    listsStore.upsertList(
      {
        ...list,
        items: [],
        updatedAt: new Date().toISOString(),
      },
      list.id,
    );

    undoDeleteTimer = setTimeout(() => {
      undoDelete = null;
      undoDeleteTimer = null;
    }, 5500);

    shareTrayOpen = false;
  }

  function restoreDeletedItem() {
    if (!undoDelete || undoDelete.listId !== list.id) return;

    if (undoDelete.originalListItems) {
      listsStore.upsertList(
        {
          ...list,
          items: undoDelete.originalListItems,
          updatedAt: new Date().toISOString(),
        },
        list.id,
      );
    } else if (undoDelete.item) {
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
    }

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
      // Each add pushes the draft row one item lower — keep it above the
      // open keyboard instead of letting it drift under it.
      draftInputNode?.scrollIntoView({ block: "center", behavior: "smooth" });
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

  // A bare Enter with nothing focused opens the draft row on the active list —
  // keyboard users get straight into the same rapid-fire add flow the Add item
  // button starts, without reaching for the mouse first.
  function handleGlobalKeyDown(event) {
    if (
      event.key !== "Enter" ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    ) {
      return;
    }
    if (draftItemActive || editingItemId || editingListName) return;
    // Only the active list answers; every carousel slide hears this event.
    if (get(listsStore).activeListId !== list.id) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("input, textarea, select, button, a, [contenteditable]")
    ) {
      return;
    }
    if (document.querySelector("dialog[open]")) return;
    event.preventDefault();
    startDraftItem();
  }

  async function handleEmptyStateClick() {
    await handleAddItemClick();
  }
</script>

<!-- The list's OWN colour, not the theme's. --zl-item-accent defaulted to
     --zl-primary-color, which is the vibe's colour and identical across all
     three lists — so every spine, on every list, came out the same amber and
     the lists still read as one beige family. The colour was already sitting
     on the list record, powering the header dot; it just never reached the
     items. -->
<section
  class="zl-card"
  style={list.primaryColor ? `--zl-item-accent: ${list.primaryColor}` : ""}
  aria-labelledby="list-title-{list.id || 'active'}"
>
  <span id="list-title-{list.id || 'active'}" class="zl-visually-hidden">
    {accessibleListName}
  </span>
  <div class="card-content">
    {#if celebrationBurst}
      <!-- Full-clear confetti — bursts from the top of the card, palette
           pulled from the list's own colors. Removed after ~1.9s. -->
      <div class="zl-confetti" aria-hidden="true">
        {#each celebrationBurst as p (p.i)}
          <span
            class="zl-confetti-piece"
            style="left: {p.left}%; --dx: {p.dx}px; --rot: {p.rot}deg; --delay: {p.delay}ms; --dur: {p.dur}ms; --size: {p.size}px; background: {p.color};"
          ></span>
        {/each}
      </div>
    {/if}
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
                      class:is-sole={isDefaultName}
                      style="background: {list.primaryColor};"
                      aria-hidden="true"
                    ></span>
                    <!-- A blue dot next to the words "Blue List" is the same
                         fact twice, so a factory-named list doesn't repeat
                         itself. But showing NOTHING left no hint that the
                         title is yours to write (Pablo, 2026-08-17) — so an
                         unnamed list shows a waiting line with a cursor
                         instead. No words: an instruction here would be the
                         app telling you what to do. -->
                    {#if !isDefaultName}
                      <span class="zl-list-title">{list.name}</span>
                    {:else}
                      <span class="zl-list-title-blank" aria-hidden="true">
                        <span class="zl-title-caret"></span>
                      </span>
                    {/if}
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
              <!-- The presence pill displays remote guests when in the room, or a clean live beacon -->
              <button
                type="button"
                class="zl-live-presence"
                on:click={tapHeart}
                title={remotePresence.length > 0
                  ? `Live — ${remotePresence.length} guest online. Tap for heart`
                  : "Live list active. Tap for heart"}
                aria-label="Live list status"
              >
                <span class="zl-live-presence-pulse" aria-hidden="true"></span>
                {#if remotePresence.length > 0}
                  <div class="zl-presence-dots" aria-hidden="true">
                    {#each remotePresence.slice(0, 3) as user (user.id)}
                      <img
                        class="zl-presence-dot"
                        title={user.avatar}
                        alt=""
                        src={getAvatarImage(user.avatar)}
                        style="background-color: {getAvatarColor(user.avatar)}"
                      />
                    {/each}
                  </div>
                  {#if remotePresence.length > 3}
                    <span class="zl-live-presence-count" aria-hidden="true"
                      >+{remotePresence.length - 3}</span
                    >
                  {/if}
                {:else}
                  <span class="zl-live-presence-label" aria-hidden="true">Live</span>
                {/if}
                <span class="zl-presence-heart" aria-hidden="true">♥</span>
                {#each hearts as heart (heart.id)}
                  <span
                    class="zl-heart-bloom"
                    style={`--bloom-colour: ${heart.colour}; --bloom-drift: ${heart.drift}px`}
                    aria-hidden="true">♥</span
                  >
                {/each}
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <div class="zl-list-actions">
        {#if activeItems.length >= 3}
          <button
            type="button"
            class="zl-shuffle-button"
            on:click={shuffleActiveItems}
            data-tip="Shuffle the order"
            aria-label={`Shuffle the items in ${list.name || "this list"}`}
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
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"></circle>
              <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"></circle>
              <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"></circle>
              <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"></circle>
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"></circle>
            </svg>
          </button>
          <button
            type="button"
            class="zl-sort-button"
            class:is-reversed={sortNewestFirst}
            on:click={sortItemsByAdded}
            data-tip={sortNewestFirst ? "Newest first" : "Oldest first"}
            aria-label={`Sort ${list.name || "this list"} ${
              sortNewestFirst ? "newest first" : "oldest first"
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
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
              ></path>
              <path d="M3 3v5h5"></path>
              <path d="M12 7v5l4 2"></path>
            </svg>
          </button>
        {/if}

        <button
          type="button"
          class="zl-share-button"
          class:is-open={shareTrayOpen}
          on:click={toggleShareTray}
          aria-expanded={shareTrayOpen}
          data-tip={isLive ? "Copy the live link" : "Share or export"}
          aria-label={isLive
            ? `Copy the live link for ${list.name || "this list"}`
            : `Send a copy of ${list.name || "this list"}. The link holds the list as it is now, and does not stay in sync.`}
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

    <!-- Getting a list in or out lives WITH the list, not in app Options —
         these are things you do to this list, not preferences. Inline tray, not
         a popover: .zl-card is overflow:clip and anything floating gets sliced. -->
    {#if shareTrayOpen}
      <div class="zl-share-tray" transition:fade={{ duration: 130 }}>
        <!-- Send only the part you mean. Appears solely on a list that has
             tags, so a plain list never sees it. Not shown for a live room —
             a room is the whole list by definition. -->
        {#if !isLive && suggestedTags.length > 0}
          <div class="zl-share-filter" role="group" aria-label="Send only items tagged">
            {#each suggestedTags as tag (tag)}
              <button
                type="button"
                class="zl-share-tag"
                class:is-on={shareTagFilter === tag}
                style={`--tag-colour: ${tagColour(tag)}`}
                aria-pressed={shareTagFilter === tag}
                on:click={() => toggleShareTag(tag)}
              >
                #{tag}
              </button>
            {/each}
            {#if shareTagFilter}
              <span class="zl-share-filter-count">
                {shareFilterCount}
                {shareFilterCount === 1 ? "item" : "items"}
              </span>
            {/if}
          </div>
        {/if}

        <!-- The two kinds of sharing sit side by side: a copy that freezes as
             it leaves, or a room that keeps up. Everything below them is
             export, which is a different job. -->
        <div class="zl-share-actions">
          <button type="button" class="zl-share-option" on:click={shareAsLink}>
            {isLive ? "Copy link" : "Send a copy"}
          </button>
          {#if liveFeatureAvailable && !isLive}
            <button
              type="button"
              class="zl-share-option zl-share-live"
              disabled={isMakingLive}
              aria-busy={isMakingLive}
              on:click={shareAsLiveRoom}
            >
              {isMakingLive ? "Opening the room..." : "Share live"}
            </button>
          {/if}
          {#if isLive}
            <button
              type="button"
              class="zl-share-option zl-share-stop"
              on:click={handleStopLive}
            >
              Stop live sharing
            </button>
          {/if}
          <button type="button" class="zl-share-option" on:click={copyAsText}>
            Copy as text
          </button>
          <button
            type="button"
            class="zl-share-option"
            on:click={downloadAsText}
          >
            Save as file
          </button>
          <button type="button" class="zl-share-option" on:click={qrThisList}>
            QR this list
          </button>
          {#if list.items.length > 0}
            <button
              type="button"
              class="zl-share-option zl-share-clear"
              on:click={clearEntireList}
            >
              Clear entire list
            </button>
          {/if}
        </div>

        {#if syncPhrase}
          <!-- The words ARE the link. Say them down the phone, or let someone
               type them in on another device — same room either way. -->
          <button
            type="button"
            class="zl-share-phrase"
            on:click={copyPhraseLink}
          >
            <code>{syncPhrase}</code>
          </button>
        {/if}

        <!-- Bringing things IN is not sharing, so it doesn't wear the same
             chrome as the two buttons that send things out. -->
        <button
          type="button"
          class="zl-share-import"
          on:click={toggleShareInput}
        >
          {shareInputMode === "paste" ? "Close paste" : "Paste things in"}
        </button>

        {#if shareInputMode === "paste"}
          <div class="zl-share-paste">
            <textarea
              bind:value={pasteText}
              rows="3"
              placeholder="Paste anything: a recipe, email, WhatsApp message, or checklist..."
              aria-label="Paste a list, recipe, or text"
              disabled={isMagicParsing}
            ></textarea>
            <div class="zl-paste-actions">
              <button
                type="button"
                class="zl-share-option zl-share-magic"
                disabled={!pasteText.trim() || isMagicParsing}
                on:click={magicAiPaste}
              >
                {isMagicParsing ? "🪄 Parsing..." : "🪄 Magic AI Import"}
              </button>
              <button
                type="button"
                class="zl-share-option"
                disabled={!pasteText.trim() || isMagicParsing}
                on:click={pasteItemsIn}
              >
                Add Lines
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

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
        <span class="zl-undo-text">
          {undoDelete.type === "all"
            ? "Cleared entire list"
            : undoDelete.type === "done"
              ? `Cleared ${undoDelete.count} completed ${undoDelete.count === 1 ? "item" : "items"}`
              : `Deleted ${undoDelete.item.text}`}
        </span>
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
      {#if activeTagFilter}
        <div class="zl-tag-filter-banner" transition:fade={{ duration: 150 }}>
          <span
            class="zl-tag-filter-badge"
            style={`--tag-colour: ${tagColour(activeTagFilter)}`}
          >
            #{activeTagFilter} ({renderedActiveItems.length + renderedCompletedItems.length})
          </span>
          <div class="zl-tag-filter-actions">
            <button
              type="button"
              class="zl-tag-spin-btn"
              on:click={spinOutTagToNewList}
              title={`Spin #${activeTagFilter} items into a new list`}
              aria-label={`Resample #${activeTagFilter} into new list`}
            >
              ✂️ Resample to new list
            </button>
            <button
              type="button"
              class="zl-tag-filter-clear"
              on:click={clearActiveTagFilter}
              aria-label="Show all items"
            >
              Show all ✕
            </button>
          </div>
        </div>
      {/if}

      {#if list.items.length > 0 || draftItemActive || remoteDrafts.length > 0 || remoteVoices.length > 0}
        <ul
          class="zl-list"
          role="list"
          aria-label={`${list.name || "List"} items`}
          in:fade={{ duration: 200 }}
        >
          {#each renderedActiveItems as item, index (item.id)}
            <!-- --zl-item-step is the row's position as 0..1. The tint and the
                 hover pitch both read it, so the colour ramp and the note ramp
                 are the same ramp — hover the third row, hear the third note.
                 Contract lives in weightless' noteAt(); nothing is shared but
                 the number, so they cannot drift apart. -->
            <li
              class="zl-item"
              style="--zl-item-step: {renderedActiveItems.length > 1
                ? index / (renderedActiveItems.length - 1)
                : 0}"
              on:mouseenter={() =>
                soundService.playAt("hover", index, {
                  total: renderedActiveItems.length,
                })}
              class:checked={item.checked}
              class:section-divider={!item.checked &&
                (/^##\s*/.test(item.text) || item.text.trim() === "---")}
              class:pure-divider={!item.checked &&
                (item.text.trim() === "##" || item.text.trim() === "---")}
              class:portal-item={!item.checked &&
                /^(\u2192|->)\s+/.test(item.text)}
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
              animate:flip={{ duration: touchDragItemId ? 220 : 260, easing: quintOut }}
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
                remoteFocus={remoteFocusByItem.get(item.id) || null}
                checkedBloom={checkedBlooms.get(item.id) || null}
                {moveTargets}
                isMoving={movingItemId === item.id}
                onRequestMove={requestMove}
                onMoveTo={moveItemToList}
                onNavigateToPortal={handlePortalClick}
                onFilterTag={toggleActiveTagFilter}
                {activeTagFilter}
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
              {suggestedTags}
            />
          {:else}
            <li
              class="zl-add-row"
              role="listitem"
              on:dragover={(e) => {
                if (!draggedItemId || activeItems.length === 0) return;
                const lastActive = activeItems[activeItems.length - 1];
                if (draggedItemId === lastActive.id) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                if (dragOverItemId !== lastActive.id || dragOverPosition !== "after") {
                  dragOverItemId = lastActive.id;
                  dragOverPosition = "after";
                  hapticService.impact("light");
                }
              }}
              on:drop={(e) => {
                if (!draggedItemId || activeItems.length === 0) return;
                const lastActive = activeItems[activeItems.length - 1];
                handleDrop(e, lastActive.id);
              }}
            >
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
            <CompletedDivider
              count={completedItems.length}
              on:clear={clearDoneItems}
            />
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
              animate:flip={{ duration: touchDragItemId ? 220 : 260, easing: quintOut }}
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
                remoteFocus={remoteFocusByItem.get(item.id) || null}
                checkedBloom={checkedBlooms.get(item.id) || null}
                {moveTargets}
                isMoving={movingItemId === item.id}
                onRequestMove={requestMove}
                onMoveTo={moveItemToList}
                onNavigateToPortal={handlePortalClick}
                onFilterTag={toggleActiveTagFilter}
                {activeTagFilter}
              />
            </li>
          {/each}
        </ul>
        {#if !draftItemActive}
          <button
            type="button"
            class="zl-tactile-add-button"
            on:click={startDraftItem}
            aria-label={`Add item to ${list.name || "this list"}`}
          >
            <span class="zl-tactile-add-plus" aria-hidden="true">+</span>
            <span class="zl-tactile-add-text">Add item</span>
          </button>
        {/if}
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
      {#if touchDraggedItem && touchDragGhostRect}
        <div class="zl-touch-ghost" style={touchGhostStyle} aria-hidden="true">
          <div
            class="zl-item zl-touch-ghost-item"
            style="--zl-item-step: {renderedActiveItems.length > 1
              ? Math.max(0, renderedActiveItems.findIndex((it) => it.id === touchDraggedItem.id)) /
                (renderedActiveItems.length - 1)
              : 0}"
          >
            <span class="zl-checkbox-wrapper">
              <span class="zl-checkbox-custom"></span>
            </span>

            <div class="edit-wrapper">
              <span class="zl-item-text-button">
                <span class="zl-item-text">{touchDraggedItem.text}</span>
                {#if touchDraggedItem.tags?.length}
                  <span class="zl-item-tags">
                    {#each touchDraggedItem.tags as tag (tag)}
                      <span class="zl-item-tag" style={`--tag-colour: ${tagColour(tag)}`}>#{tag}</span>
                    {/each}
                  </span>
                {/if}
              </span>
            </div>

            <div class="zl-item-side">
              <div class="grab-indicator touch-active">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div class="zl-item-more-button">
                <span>⋯</span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>
