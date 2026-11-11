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
  import { geminiService } from "$lib/services/transcription/geminiService";
  import {
    splitPastedList,
    listToText,
  } from "$lib/services/lists/listTextFormat.js";
  import { generateShareableUrl } from "$lib/services/share";
  import { tagColour } from "$lib/services/lists/itemTags";
  import { notePwaMoment } from "$lib/services/pwa/installMoments.js";
  import { fade, slide } from "svelte/transition";
  import { cubicOut, backOut, quintOut } from "svelte/easing";
  import { flip } from "svelte/animate";

  // Respect the user's motion preference for the juicy item transitions.
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let hasMounted = false;

  // Gentle pop/scale-in for freshly added rows — a little overshoot via backOut
  // makes an add feel like it *lands*. Initial card mount renders immediately
  // at 0ms so deck virtualization never staggers existing items on swipe.
  function itemIn(node, { delay = 0 } = {}) {
    if (!hasMounted) {
      return { duration: 0 };
    }
    if (prefersReducedMotion) {
      return { delay, duration: 160, css: (t) => `opacity: ${t}` };
    }
    return {
      delay,
      duration: 280,
      easing: backOut,
      css: (t) => {
        const eased = Math.min(1, t);
        return `opacity: ${Math.min(1, t * 1.4)}; transform: translateY(${(1 - eased) * 12}px) scale(${0.92 + eased * 0.08});`;
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
    adoptPassportName,
  } from "$lib/services/realtime/avatarService";
  import { getLiveActivityStore } from "$lib/services/realtime/liveActivityStore";
  import { getPresenceStore } from "$lib/services/realtime/presenceStore";
  import { getTypingStore } from "$lib/services/realtime/typingStore";
  import { PRODUCT_LIMITS } from "$lib/constants";
  import { isContributor } from "$lib";
  import { listPreferences } from "$lib/services/lists/listPreferences.js";
  import { generateMemberIdentity } from "$lib/softstack-passport/index.js";
  import {
    buildPassportAvatar,
    readCustomPassportAvatar,
  } from "$lib/softstack-passport/avatar.js";
  import { selectSkin } from "$lib/softstack-passport/skins.js";
  import {
    readStoredSupporterCode,
    getVaultHash,
  } from "$lib/services/vaultHashStorage.js";
  import { setAvatarName } from "$lib/services/realtime/avatarService.js";
  import { autoFocus } from "./autoFocus.js";
  import {
    PULL_THRESHOLD,
    resolvePull,
  } from "$lib/services/lists/pullToAdd.js";
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
  let draftAfterItemId = null;
  let isCommittingDraft = false;
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
  let passportFace = "";
  let defaultPassportFace = "";
  $: remotePresence = presence.filter(
    (u) => u.avatar && u.avatar !== localAvatar,
  );
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
  let touchDragStartX = 0;
  let touchDragStartY = 0;
  let touchDragCurrentY = 0;
  let touchDragTilt = 0; // deg — smoothed vertical-velocity lean on the ghost
  let touchDragGhostRect = null;
  let touchDragTargetIndex = -1;
  let touchDragLongPressTimer = null;
  let lastTouchDragCommitTime = 0;
  let touchDragAutoScrollDelta = 0;
  let touchDragAutoScrollFrame = null;
  let touchDragListenersAttached = false;
  let shareStatusTimer = null;
  let fatePickedItemId = null;
  let fatePickTimer = null;
  let diceRolling = false;
  let diceRollTimer = null;
  const celebrationTimers = new Set();

  // Props
  export let listId = null;
  export let showListManagement = true;

  // Subscribe to the appropriate list (single store subscription per instance)
  let unsubscribe;
  let subscribedListId;
  let allLists = [];

  $: if (subscribedListId !== listId) {
    subscribeToList(listId);
    subscribedListId = listId;
  }

  function subscribeToList(nextListId) {
    if (unsubscribe) unsubscribe();
    if (nextListId) {
      unsubscribe = listsStore.subscribe((state) => {
        allLists = state.lists || [];
        if (state.activeListId && state.activeListId !== nextListId) {
          movingItemId = null;
          shareTrayOpen = false;
          manageTrayOpen = false;
        }
        const foundList = allLists.find((l) => l.id === nextListId);
        if (foundList) list = foundList;
      });
    } else {
      unsubscribe = listsStore.subscribe((state) => {
        allLists = state.lists || [];
        const activeListData = allLists.find(
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
      draftAfterItemId = null;
      editingItemId = null;
      editedItemText = "";
      movingItemId = null;
      // Clear drag state so a mid-drag list switch doesn't leave a phantom indicator
      draggedItemId = null;
      dragOverItemId = null;
      dragOverPosition = "before";
      fatePickedItemId = null;
    }
    previousListIdentity = list.id;
    isLive = liveListsService.isLive(list.id);
    if (isLive) {
      subscribeToLiveStores(list.id);
    }
  }

  $: isDefaultName = DEFAULT_LIST_NAMES.has(list.name);
  $: accessibleListName = list.name || "Active list";

  // Subscribe to presence and typing for this list
  let presenceUnsubscribe = null;
  let typingUnsubscribe = null;
  let activityUnsubscribe = null;

  onMount(() => {
    localAvatar = getOrCreateAvatar();
    refreshPassportIdentity();
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
      window.addEventListener("ziplist-list-deleted", handleListDeleted);
      window.addEventListener("ziplist-heart", handleRemoteHeart);
      window.addEventListener("ziplist-item-checked", handleRemoteItemChecked);
      window.addEventListener("keydown", handleGlobalKeyDown);
      window.addEventListener(
        "ziplist-avatar-changed",
        handleLocalAvatarChange,
      );
      window.addEventListener(
        "ziplist-passport-avatar-changed",
        refreshPassportFace,
      );
      window.addEventListener(
        "ziplist-passport-changed",
        refreshPassportIdentity,
      );
      requestAnimationFrame(() => {
        hasMounted = true;
      });
    } else {
      hasMounted = true;
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
    if (fatePickTimer) clearTimeout(fatePickTimer);
    if (diceRollTimer) clearTimeout(diceRollTimer);
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
      window.removeEventListener("ziplist-list-deleted", handleListDeleted);
      window.removeEventListener("ziplist-heart", handleRemoteHeart);
      window.removeEventListener(
        "ziplist-item-checked",
        handleRemoteItemChecked,
      );
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener(
        "ziplist-avatar-changed",
        handleLocalAvatarChange,
      );
      window.removeEventListener(
        "ziplist-passport-avatar-changed",
        refreshPassportFace,
      );
      window.removeEventListener(
        "ziplist-passport-changed",
        refreshPassportIdentity,
      );
    }
  });

  function handleLocalAvatarChange(event) {
    localAvatar = event.detail?.avatar || getOrCreateAvatar();
  }

  function refreshPassportFace() {
    passportFace = readCustomPassportAvatar() || defaultPassportFace;
  }

  async function refreshPassportIdentity() {
    const code = readStoredSupporterCode();
    if (!code) return;
    try {
      const hash = await getVaultHash(code);
      if (readStoredSupporterCode() !== code) return;
      const identity = generateMemberIdentity(hash, code);
      const seed = identity.syncRoomId || hash;
      defaultPassportFace = buildPassportAvatar(
        seed,
        selectSkin(seed).avatarStyle,
      );
      refreshPassportFace();
      adoptPassportName(identity.name);
    } catch {
      // Shared lists still have their local fallback identity.
    }
  }

  function saveCollaboratorName(event) {
    localAvatar = setAvatarName(event.currentTarget.value);
    event.currentTarget.value = localAvatar;
  }

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
    if (typeof window === "undefined") {
      return { x: 0.5, y: 0.62 };
    }
    let cx = event?.clientX;
    let cy = event?.clientY;
    // The native checkbox is visually hidden (0×0); anchor the paper to its
    // visible row instead of defaulting every check to the viewport centre.
    const anchor =
      event?.currentTarget?.closest?.(".zl-item") || event?.currentTarget;
    if ((!cx || !cy) && anchor?.getBoundingClientRect) {
      const rect = anchor.getBoundingClientRect();
      if (rect.width || rect.height) {
        cx = rect.left + rect.width / 2;
        cy = rect.top + rect.height / 2;
      }
    }
    if (!cx || !cy) {
      return { x: 0.5, y: 0.62 };
    }

    return {
      x: Math.max(0.08, Math.min(0.92, cx / window.innerWidth)),
      y: Math.max(0.12, Math.min(0.86, cy / window.innerHeight)),
    };
  }

  function handleListNotice(event) {
    if (!event.detail?.message) return;
    showListStatus(event.detail.message, !!event.detail.success);
  }

  function handleListDeleted(event) {
    if (!event.detail || get(listsStore).activeListId !== list.id) return;
    if (undoDeleteTimer) clearTimeout(undoDeleteTimer);
    undoDelete = event.detail;
    undoDeleteTimer = setTimeout(() => {
      undoDelete = null;
      undoDeleteTimer = null;
    }, 6500);
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
      text: list.name ? `${list.name} · Live ZipList` : "Live ZipList",
      url: liveUrl,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(sharePayload);
        showListStatus("Live link shared.", true);
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
          ? "Live link copied."
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

  // Copy a plain checklist, not a static link masquerading as "Copy List".
  async function handleShareList(listToShare = list) {
    if (!listToShare || !listToShare.items || listToShare.items.length === 0) {
      showListStatus("Add an item before sharing.");
      soundService.locked();
      return;
    }

    try {
      if (await copyText(listToText(listToShare))) {
        showListStatus("List copied.", true, 3000);
        soundService.copySuccess({ force: true });
        if (
          listToShare.items.some(
            (item) => !String(item.id).startsWith("starter-"),
          )
        ) {
          notePwaMoment(); // a real shared checklist earns the install suggestion
        }
      } else {
        showListStatus("Copy needs browser permission.");
        soundService.error({ force: true });
      }
    } catch (error) {
      console.error("Failed to copy list:", error);
      showListStatus("Copy needs browser permission.");
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
          : `Free ZipList runs one live list at a time. End that one or unlock more room.`,
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
          ? "Shared list link copied. The words work too."
          : "Shared list ready. Link available in Share.",
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
          ? "Shared lists are unavailable right now. Copy still works."
          : "Shared link needs one more try.",
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
    window.dispatchEvent(
      new CustomEvent("ziplist-open-contributor", {
        detail: { reason: "max-live-lists" },
      }),
    );
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
  $: inlineDraftAnchorId =
    draftItemActive &&
    draftAfterItemId !== null &&
    renderedActiveItems.some((item) => item.id === draftAfterItemId)
      ? draftAfterItemId
      : null;
  $: renderedActiveEntries = (() => {
    const entries = renderedActiveItems.map((item, index) => ({
      id: item.id,
      isDraft: false,
      item,
      step:
        renderedActiveItems.length > 1
          ? index / (renderedActiveItems.length - 1)
          : 0,
    }));
    if (inlineDraftAnchorId) {
      const anchorIdx = entries.findIndex(
        (entry) => entry.id === inlineDraftAnchorId,
      );
      if (anchorIdx !== -1) {
        entries.splice(anchorIdx + 1, 0, {
          id: "__inline_draft__",
          isDraft: true,
          item: null,
          step: entries[anchorIdx].step,
        });
      }
    }
    return entries;
  })();
  $: renderedCompletedItems = filteredSortedItems.filter(
    (item) => item.checked,
  );
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
    if (itemId) itemNodes.set(itemId, node);

    return {
      update(nextItemId) {
        if (nextItemId === itemId) return;
        if (itemId) itemNodes.delete(itemId);
        itemId = nextItemId;
        if (itemId) itemNodes.set(itemId, node);
      },
      destroy() {
        if (itemId) itemNodes.delete(itemId);
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
    // The audio half of a detent that was already being felt. playAt() swaps
    // the ratchet's fixed frequency for the note at this slot, so dragging up
    // the list runs up the scale and dragging down runs down it — the row's
    // position is the pitch, the same contract `hover` already uses. You can
    // hear where the item has landed without looking at it.
    soundService.playAt("ratchet", nextTargetIndex, {
      total: movableItems.length,
    });
  }

  function runTouchDragAutoScroll() {
    const scrollContainer = getTouchDragScrollContainer();

    if (!touchDragItemId || !touchDragAutoScrollDelta || !scrollContainer) {
      touchDragAutoScrollFrame = null;
      return;
    }

    const prevTop = listContainerNode
      ? listContainerNode.getBoundingClientRect().top
      : 0;

    if (scrollContainer === window) {
      window.scrollBy({
        top: touchDragAutoScrollDelta,
        behavior: "auto",
      });
    } else {
      scrollContainer.scrollTop += touchDragAutoScrollDelta;
    }

    if (listContainerNode) {
      touchDragStartY +=
        listContainerNode.getBoundingClientRect().top - prevTop;
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

    movingItemId = null;

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
    soundService.pickup();
  }

  let touchDragFromHandle = false;

  function handleTouchGrabStart(event, itemId) {
    if (
      event.touches.length !== 1 ||
      editingItemId === itemId ||
      activeItems.length < 2
    ) {
      return;
    }

    stopTouchDragAutoScroll();
    clearTouchDragLongPressTimer();
    addTouchDragListeners();

    const touch = event.changedTouches[0];
    touchDragFromHandle = true;
    touchDragPendingItemId = itemId;
    touchDragPendingTouchId = touch.identifier;
    touchDragStartX = touch.clientX;
    touchDragStartY = touch.clientY;
    touchDragCurrentY = touch.clientY;

    touchDragLongPressTimer = setTimeout(() => {
      touchDragLongPressTimer = null;
      startTouchDrag();
    }, 220);
  }

  function handleRowTouchStart(event, item) {
    if (
      !item ||
      item.checked ||
      event.touches.length !== 1 ||
      editingItemId === item.id ||
      activeItems.length < 2
    ) {
      return;
    }

    if (
      event.target?.closest?.(
        ".zl-checkbox-wrapper, .zl-item-more-button, .zl-item-tag, .zl-item-tray, .zl-item-portal-text, input",
      )
    ) {
      return;
    }

    stopTouchDragAutoScroll();
    clearTouchDragLongPressTimer();
    addTouchDragListeners();

    const touch = event.changedTouches[0];
    touchDragFromHandle = false;
    touchDragPendingItemId = item.id;
    touchDragPendingTouchId = touch.identifier;
    touchDragStartX = touch.clientX;
    touchDragStartY = touch.clientY;
    touchDragCurrentY = touch.clientY;

    touchDragLongPressTimer = setTimeout(() => {
      touchDragLongPressTimer = null;
      startTouchDrag();
    }, 260);
  }

  function handleTouchGrabMove(event) {
    const touch = getTrackedTouch(event);
    if (!touch) return;

    if (!touchDragItemId) {
      const dy = Math.abs(touch.clientY - touchDragStartY);
      const dx = Math.abs(touch.clientX - touchDragStartX);
      if (touchDragFromHandle) {
        if (dy >= 4 && dy >= dx) {
          startTouchDrag();
        } else if (dx > 10 && dx > dy) {
          resetTouchDragState();
          return;
        } else {
          return;
        }
      } else {
        if (dy > 7 || dx > 7) {
          resetTouchDragState();
        }
        return;
      }
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
      lastTouchDragCommitTime = performance.now();
      finishTouchDrag(true);
      return;
    }

    resetTouchDragState();
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
    // Prevent dragging if item is being edited or initiated from interactive child controls
    if (
      editingItemId === itemId ||
      activeItems.length < 2 ||
      event.target?.closest?.(
        ".zl-checkbox-wrapper, .zl-item-tag, .zl-item-tray, input",
      )
    ) {
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

    // Same pitched detent as the touch path, keyed off the row being hovered
    // so both input methods land on the same note for the same slot.
    const overIndex = activeItems.findIndex((item) => item.id === itemId);
    if (overIndex !== -1) {
      soundService.playAt("ratchet", overIndex, { total: activeItems.length });
    }
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

  function isCheckableItem(item) {
    if (!item || typeof item.text !== "string") return false;
    const text = item.text.trim();
    if (!text) return false;
    return (
      !/^##\s*/.test(text) && text !== "---" && !/^(\u2192|->)\s+/.test(text)
    );
  }

  function resolvePortalColor(item) {
    if (!item || item.checked || !/^(\u2192|->)\s+/.test(item.text)) return "";
    const targetName = item.text.replace(/^(\u2192|->)\s+/, "").trim();
    if (!targetName) return "";
    const match = moveTargets.find(
      (t) => t.name.toLowerCase() === targetName.toLowerCase(),
    );
    return match?.primary || "";
  }

  // ── Tidy: one considered order, chosen once ────────────────────────────
  // Not a live view and not a rule. The model may only permute what is here;
  // if it tries to add, drop or duplicate anything the order is ignored.
  let isTidying = false;
  async function tidyActiveItems() {
    if (isTidying) return;
    const pool = activeItems;
    if (pool.length < 3) return;

    isTidying = true;
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "order",
          items: pool.map((item) => ({ id: item.id, text: item.text })),
        }),
      });
      const payload = await response.json();
      const order = Array.isArray(payload?.order) ? payload.order : null;
      if (!order) throw new Error("no order");

      const rank = new Map(order.map((id, index) => [id, index]));
      const sorted = [...pool].sort(
        (a, b) =>
          (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
      listsService.reorderItems([...sorted, ...completedItems], list.id);
      showListStatus("Tidied", true, 2400);
      hapticService.impact("light");
      soundService.add({ force: true });
    } catch {
      showListStatus("Could not tidy just now. The order is unchanged.", false);
    } finally {
      isTidying = false;
    }
  }

  $: checkableActiveItems = activeItems.filter(isCheckableItem);

  // ── Fate: let the list decide ──────────────────────────────────────────
  // The opposite of deciding. One unchecked item, named out loud, so a stuck
  // evening has somewhere to start. Deliberately not a streak or a score.
  function pickOneForMe() {
    const pool = checkableActiveItems;
    if (pool.length < 2) return;
    const candidates =
      pool.length > 1 && fatePickedItemId
        ? pool.filter((candidate) => candidate.id !== fatePickedItemId)
        : pool;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    diceRolling = false;
    if (diceRollTimer) clearTimeout(diceRollTimer);
    requestAnimationFrame(() => {
      diceRolling = true;
      diceRollTimer = setTimeout(() => {
        diceRolling = false;
        diceRollTimer = null;
      }, 420);
    });

    fatePickedItemId = chosen.id;
    if (fatePickTimer) clearTimeout(fatePickTimer);
    fatePickTimer = setTimeout(() => {
      fatePickedItemId = null;
      fatePickTimer = null;
    }, 5200);

    itemNodes.get(chosen.id)?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
    });

    showListStatus(`Fate picks: ${chosen.text}`, true, 5200);
    hapticService.impact("medium");
    soundService.add({ force: true });
  }

  // ── Order play: shuffle & entry-order sort ─────────────────────────────
  function shuffleActiveItems() {
    const active = list.items.filter((i) => !i.checked);
    const checkableIndices = [];
    const checkablePool = [];
    active.forEach((item, idx) => {
      if (isCheckableItem(item)) {
        checkableIndices.push(idx);
        checkablePool.push(item);
      }
    });
    if (checkablePool.length < 2) return;
    for (let i = checkablePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [checkablePool[i], checkablePool[j]] = [
        checkablePool[j],
        checkablePool[i],
      ];
    }
    const shuffled = [...active];
    checkableIndices.forEach((slotIdx, poolIdx) => {
      shuffled[slotIdx] = checkablePool[poolIdx];
    });
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

  $: moveTargets = allLists
    .filter((candidate) => candidate.id !== list.id)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name || "Untitled list",
      primary: candidate.primaryColor || candidate.color || "",
    }));

  // ── Share tray ─────────────────────────────────────────────────────────
  // Sharing, and nothing else. A link icon should never be where someone
  // finds "Delete this list" — that pair lives in the ⋯ tray now.
  let shareTrayOpen = false;
  let shareInputMode = null;
  let pasteText = "";
  let syncPhrase = "";

  // ── Manage tray (the ⋯) ────────────────────────────────────────────────
  // These two sat under a hairline at the foot of the share tray. Grouping
  // them there was tidy and still wrong: they are not ways of sending a
  // list, they are ways of ending one.
  let manageTrayOpen = false;

  $: nonLiveListCount = allLists.filter(
    (l) => typeof l?.id !== "string" || !l.id.startsWith("live_"),
  ).length;
  $: canDeleteList = showListManagement && nonLiveListCount > 1;
  $: canManageList =
    list.items.length > 0 || canDeleteList || showListManagement;
  // If managing is no longer possible, close the drawer.
  $: if (!canManageList && manageTrayOpen) manageTrayOpen = false;

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
    if (shareTrayOpen) {
      manageTrayOpen = false;
      shareInputMode = null;
      movingItemId = null;
    }
    if (!shareTrayOpen) {
      shareInputMode = null;
      if (!isLive) syncPhrase = "";
      shareTagFilter = null;
    } else if (isLive && !syncPhrase) {
      const shareUrl = liveListsService.getShareUrl(list.id) || "";
      const phraseMatch = shareUrl.match(/\/j\/([a-z-]+)$/i);
      if (phraseMatch) syncPhrase = phraseMatch[1];
    }
    soundService.select();
  }

  function toggleManageTray() {
    manageTrayOpen = !manageTrayOpen;
    if (manageTrayOpen) {
      shareTrayOpen = false;
      movingItemId = null;
    } else {
      shareInputMode = null;
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
    if (isLive) await handleShareLiveList();
    else await handleMakeLive();
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
    showListStatus("Sharing ended.", true, 2400);
    hapticService.impact("medium");
    soundService.close({ force: true });
  }

  function qrThisList() {
    if (!shareableList?.items?.length && !isLive) {
      showListStatus("Add an item before sharing.");
      soundService.locked();
      return;
    }

    const rawUrl = isLive
      ? liveListsService.getShareUrl(list.id) ||
        generateShareableUrl(shareableList)
      : generateShareableUrl(shareableList);

    window.dispatchEvent(
      new CustomEvent("ziplist-open-qr", {
        detail: {
          shareUrl: rawUrl,
          title: isLive ? "Shared list" : `Scan "${list.name || "List"}"`,
          subtitle: isLive
            ? "Scan with any phone camera to edit together in real time"
            : "Scan with any phone camera to open and save this list",
          syncPhrase: isLive ? syncPhrase || "" : "",
          isLive: Boolean(isLive),
        },
      }),
    );
    shareTrayOpen = false;
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
    manageTrayOpen = false;
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
    showListStatus("Magic import in progress...", true, 4000);
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
        if (result.title && (!list.name || DEFAULT_LIST_NAMES.has(list.name))) {
          listsService.renameList(list.id, result.title);
        }

        const addResult = listsService.addItems(result.items, list.id);
        const added = addResult?.addedCount ?? result.items.length;

        pasteText = "";
        shareInputMode = null;
        manageTrayOpen = false;

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
      showListStatus("Magic import offline. Added as raw lines.", false, 2500);
      pasteItemsIn();
    } finally {
      isMagicParsing = false;
    }
  }

  function handlePortalClick(targetName) {
    if (!targetName) return;
    const currentLists = get(listsStore).lists;
    let target = currentLists.find(
      (l) => l.name.toLowerCase() === targetName.toLowerCase(),
    );
    if (target?.id === list.id) {
      showListStatus("Already on this list.", true, 1800);
      soundService.select();
      return;
    }
    if (!target) {
      const created = listsService.createList(targetName);
      if (created?.ok && created.listId) {
        target = { id: created.listId };
      } else {
        showListStatus(
          created?.message || "Could not create list.",
          false,
          2600,
        );
        soundService.locked();
        return;
      }
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
          createResult.message ||
            "Could not create new list. Check list limit.",
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
      showListStatus(
        `Resampled #${newListName} into its own list!`,
        true,
        3000,
      );
    } catch (err) {
      console.error("Error spinning out tag:", err);
      showListStatus("Could not resample tag into a new list.", false, 2500);
    }
  }

  let renamingTagActive = false;
  let renamingTagValue = "";
  let renameTagInputNode = null;

  async function startRenamingActiveTag() {
    if (!activeTagFilter) return;
    renamingTagActive = true;
    renamingTagValue = activeTagFilter;
    hapticService.selection();
    soundService.select();
    await tick();
    renameTagInputNode?.focus();
    renameTagInputNode?.select?.();
  }

  function cancelRenamingActiveTag() {
    renamingTagActive = false;
    renamingTagValue = "";
  }

  function commitRenameActiveTag() {
    if (!renamingTagActive || !activeTagFilter) {
      cancelRenamingActiveTag();
      return;
    }
    const oldTag = activeTagFilter;
    const input = renamingTagValue;
    renamingTagActive = false;
    renamingTagValue = "";
    if (!input || !input.trim()) return;

    const newTag = input
      .trim()
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/[^\p{L}\p{N}_-]/gu, "");
    if (!newTag || newTag === oldTag) return;

    // Replace oldTag with newTag across all items in list
    const updatedItems = list.items.map((item) => {
      if (!item.tags?.includes(oldTag)) return item;
      const newTags = item.tags.map((t) => (t === oldTag ? newTag : t));
      const newText = item.text.replace(
        new RegExp(`(^|\\s)#${oldTag}(?=\\s|$)`, "gi"),
        `$1#${newTag}`,
      );
      return {
        ...item,
        tags: Array.from(new Set(newTags)),
        text: newText,
      };
    });

    listsStore.upsertList(
      {
        ...list,
        items: updatedItems,
        updatedAt: new Date().toISOString(),
      },
      list.id,
    );

    activeTagFilter = newTag;
    soundService.sparkle({ force: true });
    hapticService.notification("success");
    showListStatus(`Renamed #${oldTag} to #${newTag}`, true, 2400);
  }

  function untagAllActiveTag() {
    if (!activeTagFilter) return;
    const targetTag = activeTagFilter;

    // Snapshot for undo
    const listSnapshot = {
      ...list,
      items: [...list.items],
    };

    const updatedItems = list.items.map((item) => {
      if (!item.tags?.includes(targetTag)) return item;
      return {
        ...item,
        tags: item.tags.filter((t) => t !== targetTag),
        text: item.text
          .replace(new RegExp(`(^|\\s)#${targetTag}(?=\\s|$)`, "gi"), "$1")
          .replace(/\s+/g, " ")
          .trim(),
      };
    });

    listsStore.upsertList(
      {
        ...list,
        items: updatedItems,
        updatedAt: new Date().toISOString(),
      },
      list.id,
    );

    activeTagFilter = null;
    soundService.delete();
    hapticService.impact("medium");

    if (undoDeleteTimer) clearTimeout(undoDeleteTimer);

    undoDelete = {
      type: "untag",
      listSnapshot,
      listId: list.id,
      tag: targetTag,
    };

    undoDeleteTimer = setTimeout(() => {
      undoDelete = null;
      undoDeleteTimer = null;
    }, 6000);
  }

  async function copyPhraseLink() {
    if (!syncPhrase) return;
    const url = `${window.location.origin}/j/${syncPhrase}`;
    const copied = await copyText(url).catch(() => false);
    hapticService.selection();
    if (copied) {
      soundService.copySuccess({ force: true });
    } else {
      soundService.locked({ force: true });
    }
    showListStatus(
      copied ? "Link copied" : "Copy unavailable · four words still work",
      copied,
      2400,
    );
  }

  function requestMove(itemId) {
    if (performance.now() - lastTouchDragCommitTime < 320) return;
    movingItemId = movingItemId === itemId ? null : itemId;
    if (movingItemId) soundService.select();
  }

  function moveItemToList(itemId, targetListId) {
    const result = listsService.moveItem(itemId, list.id, targetListId);
    movingItemId = null;

    if (result?.ok || result?.success) {
      soundService.plop({ force: true });
      hapticService.impact("medium");
      showListStatus(result.message || "Moved.", true, 2200);
    } else {
      soundService.locked();
      showListStatus(
        result?.message || "Could not move that item.",
        false,
        2600,
      );
    }
  }

  function sortItemsByAdded() {
    const active = list.items.filter((i) => !i.checked);
    const checkableIndices = [];
    const checkablePool = [];
    active.forEach((item, idx) => {
      if (isCheckableItem(item)) {
        checkableIndices.push(idx);
        checkablePool.push({ item, index: idx });
      }
    });
    if (checkablePool.length < 2) return;
    // addedAt is epoch ms on items created since the stamp landed; older
    // items fall back to their current index (tiny vs epoch), which sorts
    // them first while preserving their relative order — correct, since
    // they genuinely predate every stamped item.
    const sortedPool = checkablePool
      .sort(
        (a, b) =>
          (a.item.addedAt ?? a.index) - (b.item.addedAt ?? b.index) ||
          a.index - b.index,
      )
      .map((entry) => entry.item);
    if (sortNewestFirst) sortedPool.reverse();
    const sorted = [...active];
    checkableIndices.forEach((slotIdx, poolIdx) => {
      sorted[slotIdx] = sortedPool[poolIdx];
    });
    const completed = list.items.filter((i) => i.checked);
    listsService.reorderItems([...sorted, ...completed], list.id);
    soundService.select();
    hapticService.impact("light");
    showListStatus(
      sortNewestFirst ? "Newest first." : "Back in added order.",
      true,
      2200,
    );
    sortNewestFirst = !sortNewestFirst;
  }

  // One viewport canvas, not a second DOM burst inside the clipped card.
  // The same list-colour palette climbs from a tiny check to a full-list party.
  let confettiLoader;
  let lastCheckAt = 0;
  let checkStreak = 0;

  async function celebrate(tier, origin) {
    if (prefersReducedMotion || typeof window === "undefined") return;
    const colors = [
      list.primaryColor || "#62c9e8",
      list.accentColor || "#93dcf0",
      "#ffcc33",
      "#ff6ac2",
      "#fbf1e4",
    ];
    try {
      confettiLoader ||= import("canvas-confetti");
      const confetti = (await confettiLoader).default;
      const fire = (options) =>
        confetti({
          origin,
          colors: tier === "item" ? colors.slice(0, 2) : colors,
          disableForReducedMotion: true,
          zIndex: 90,
          ...options,
        });

      if (tier === "item") {
        fire({
          particleCount: 9,
          spread: 38,
          startVelocity: 18,
          decay: 0.93,
          gravity: 0.9,
          ticks: 175,
          scalar: 0.67,
        });
      } else if (tier === "streak" || tier === "clear") {
        fire({
          particleCount: tier === "clear" ? 38 : 22,
          spread: 68,
          startVelocity: tier === "clear" ? 27 : 23,
          decay: 0.94,
          gravity: 0.85,
          ticks: 230,
          scalar: 0.82,
        });
      } else {
        fire({
          particleCount: 55,
          spread: 76,
          startVelocity: 32,
          decay: 0.95,
          gravity: 0.85,
          ticks: 280,
          scalar: 0.9,
        });
        // A quieter second volley follows the first instead of two unrelated
        // animations clipping at the card edge at exactly the same moment.
        scheduleCelebration(() => {
          fire({
            particleCount: 16,
            angle: 72,
            spread: 48,
            startVelocity: 25,
            decay: 0.95,
            gravity: 0.9,
            ticks: 245,
            origin: { x: 0.12, y: 0.78 },
          });
          fire({
            particleCount: 16,
            angle: 108,
            spread: 48,
            startVelocity: 25,
            decay: 0.95,
            gravity: 0.9,
            ticks: 245,
            origin: { x: 0.88, y: 0.78 },
          });
        }, 160);
      }
    } catch (error) {
      console.warn("Confetti unavailable:", error);
    }
  }

  // Handle item toggle with sparkle animation
  function toggleItem(itemId, event) {
    const itemToToggle = list.items.find((item) => item.id === itemId);
    const willCheckItem = itemToToggle && !itemToToggle.checked;
    const checkableItems = list.items.filter(isCheckableItem);
    const willCompleteList =
      willCheckItem &&
      checkableItems.length > 0 &&
      checkableItems
        .filter((item) => item.id !== itemId)
        .every((item) => item.checked);

    // Tell the room — but only on the way IN. Un-checking is a correction,
    // not an accomplishment, and celebrating it would be sarcasm.
    if (willCheckItem && isLive) {
      liveListsService.broadcastItemChecked(list.id, itemId);
    }

    if (willCheckItem) {
      const now = Date.now();
      checkStreak = now - lastCheckAt < 3500 ? checkStreak + 1 : 1;
      lastCheckAt = now;
    } else {
      checkStreak = 0;
    }

    // Apply haptic feedback
    if (itemToToggle) {
      hapticService.impact(itemToToggle.checked ? "light" : "medium");
      if (willCompleteList) {
        // Five-plus items done = a real accomplishment: confetti + fanfare.
        // Smaller lists keep the modest completion chime.
        if (checkableItems.length >= 5) {
          soundService.fanfare({ force: true });
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

    if (willCheckItem) {
      if (willCompleteList) hapticService.notification("success");
      void celebrate(
        willCompleteList ? "list" : checkStreak >= 3 ? "streak" : "item",
        getConfettiOrigin(event),
      );
    }
  }

  // Tell the room which line you're in, so two people don't quietly overwrite
  // each other. The whole pipeline for this already existed — sender, protocol,
  // worker relay, receiving store, even a focus-by-item Map in this component.
  // Nothing had ever called it.

  function pressCheckbox() {
    hapticService.press();
    soundService.press();
  }

  function startEditingItem(item) {
    if (item.checked) return;
    if (performance.now() - lastTouchDragCommitTime < 320) return;
    clearDraftActivity();
    movingItemId = null;
    draftItemActive = false;
    draftItemText = "";
    draftAfterItemId = null;
    editingItemId = item.id;
    const tagSuffix = item.tags?.length
      ? ` ${item.tags.map((t) => `#${t}`).join(" ")}`
      : "";
    editedItemText = `${item.text}${tagSuffix}`;
    if (isLive) {
      liveListsService.broadcastItemFocus(list.id, item.id);
      broadcastDraftActivity({
        text: editedItemText,
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

  $: myAvatarColour = getAvatarColor(localAvatar || "Guest");

  // List-specific tags with counts (ranked by frequency)
  $: listTagCounts = (() => {
    const counts = new Map();
    for (const item of list?.items ?? []) {
      for (const tag of item.tags ?? []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return counts;
  })();

  $: listTags = Array.from(listTagCounts.keys()).sort(
    (a, b) => (listTagCounts.get(b) || 0) - (listTagCounts.get(a) || 0),
  );

  // Global tags across all lists in workspace (computed lazily only while drafting)
  $: globalVocabulary = draftItemActive
    ? Array.from(
        new Set(
          allLists.flatMap((l) =>
            (l.items ?? []).flatMap((item) => item.tags ?? []),
          ),
        ),
      )
    : [];

  // Suggested tags: list tags first (ranked by frequency), followed by other global tags
  $: suggestedTags = draftItemActive
    ? [
        ...listTags,
        ...globalVocabulary.filter((tag) => !listTags.includes(tag)),
      ]
    : listTags;

  function cancelItemEdit() {
    editingItemId = null;
    editedItemText = "";
    clearDraftActivity();
    clearItemFocus();
  }

  function handleEditItemKeyDown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      const currentId = editingItemId;
      const hadText = Boolean(editedItemText.trim());
      saveItemEdit();
      if (hadText && currentId !== null) {
        void startDraftItem({ afterItemId: currentId });
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelItemEdit();
    } else if (event.key === "Backspace" && (event.metaKey || event.ctrlKey)) {
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
    const doneItems = activeTagFilter
      ? renderedCompletedItems
      : list.items.filter((item) => item.checked);
    if (!doneItems.length) return;

    hapticService.notification("success");
    soundService.clearSweep(doneItems.length);
    if (doneItems.length >= 3) {
      void celebrate(
        "clear",
        getConfettiOrigin({ currentTarget: listContainerNode }),
      );
    }

    if (undoDeleteTimer) clearTimeout(undoDeleteTimer);

    undoDelete = {
      items: [...doneItems],
      listId: list.id,
      type: "done",
      count: doneItems.length,
      originalListItems: [...list.items],
    };

    const targetIds = new Set(doneItems.map((item) => item.id));
    listsStore.upsertList(
      {
        ...list,
        items: list.items.filter((item) => !targetIds.has(item.id)),
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
    if (list.items.length >= 3) {
      soundService.clearSweep(list.items.length);
      void celebrate(
        "clear",
        getConfettiOrigin({ currentTarget: listContainerNode }),
      );
    } else {
      soundService.delete();
    }

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

    manageTrayOpen = false;
  }

  function deleteEntireList() {
    const nonLiveLists = allLists.filter(
      (l) => typeof l?.id !== "string" || !l.id.startsWith("live_"),
    );
    if (nonLiveLists.length <= 1) {
      showListStatus("Can't delete the only list.", false, 2400);
      soundService.locked({ force: true });
      return;
    }

    const listSnapshot = {
      ...list,
      items: [...list.items],
    };

    hapticService.impact("medium");
    soundService.delete();

    if (undoDeleteTimer) clearTimeout(undoDeleteTimer);

    const undoPayload = {
      type: "list",
      listSnapshot,
      listName: list.name || "List",
    };
    undoDelete = undoPayload;

    listsStore.deleteList(list.id);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ziplist-list-deleted", { detail: undoPayload }),
      );
    }

    undoDeleteTimer = setTimeout(() => {
      undoDelete = null;
      undoDeleteTimer = null;
    }, 6500);

    manageTrayOpen = false;
  }

  function uncheckAllItems() {
    const doneItems = activeTagFilter
      ? renderedCompletedItems
      : list.items.filter((item) => item.checked);
    if (!doneItems.length) return;

    hapticService.notification("success");
    soundService.reset({ force: true });

    if (undoDeleteTimer) clearTimeout(undoDeleteTimer);

    undoDelete = {
      items: [...doneItems],
      listId: list.id,
      type: "uncheck",
      count: doneItems.length,
      originalListItems: [...list.items],
    };

    const targetIds = new Set(doneItems.map((item) => item.id));
    listsStore.upsertList(
      {
        ...list,
        items: list.items.map((item) =>
          targetIds.has(item.id)
            ? {
                ...item,
                checked: false,
                completedAt: undefined,
              }
            : item,
        ),
        updatedAt: new Date().toISOString(),
      },
      list.id,
    );

    undoDeleteTimer = setTimeout(() => {
      undoDelete = null;
      undoDeleteTimer = null;
    }, 5500);

    manageTrayOpen = false;
  }

  function duplicateCurrentList() {
    if (!showListManagement) return;
    const baseName = list.name || "List";
    const duplicateName = `${baseName} copy`;
    const createResult = listsStore.addList(duplicateName);
    if (!createResult.ok) {
      showListStatus(
        createResult.message || "Could not duplicate list.",
        false,
      );
      return;
    }
    const newListId = createResult.listId;
    if (list.items && list.items.length > 0) {
      listsStore.addItems(
        list.items.map(({ text, checked, tags }) => ({ text, checked, tags })),
        newListId,
      );
    }
    hapticService.selection();
    soundService.add?.({ force: true });
    showListStatus(`Duplicated "${baseName}"`, true);
    manageTrayOpen = false;
  }

  function restoreDeletedItem() {
    if (!undoDelete) return;

    if (undoDelete.type === "list" && undoDelete.listSnapshot) {
      listsStore.upsertList(
        undoDelete.listSnapshot,
        undoDelete.listSnapshot.id,
      );
      listsStore.setActiveList(undoDelete.listSnapshot.id);
      hapticService.selection();
      soundService.add({ force: true });
      undoDelete = null;
      if (undoDeleteTimer) {
        clearTimeout(undoDeleteTimer);
        undoDeleteTimer = null;
      }
      return;
    }

    if (undoDelete.type === "untag" && undoDelete.listSnapshot) {
      listsStore.upsertList(
        undoDelete.listSnapshot,
        undoDelete.listSnapshot.id,
      );
      hapticService.selection();
      soundService.add({ force: true });
      undoDelete = null;
      if (undoDeleteTimer) {
        clearTimeout(undoDeleteTimer);
        undoDeleteTimer = null;
      }
      return;
    }

    if (undoDelete.listId !== list.id) return;

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
      const insertIndex = Math.min(
        undoDelete.originalIndex,
        currentItems.length,
      );
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

  // ── Pull-down-to-add ────────────────────────────────────────────────────
  // Tug the top of the list, get a draft row.
  //
  // Deliberately never calls preventDefault. The swipe container above sets
  // `touch-action: pan-y`, which hands vertical panning to the browser — a
  // preventDefault here would be ignored, and forcing it back with
  // `touch-action: none` would kill scrolling from the top of a long list.
  // So instead of fighting the scroller, the gesture only arms when there is
  // nothing left to scroll (`scrollY <= 0` and the card's top edge in view).
  // At that point a downward drag IS pure overscroll and nobody is competing
  // for it — iOS's rubber band and this row travel together, which reads as
  // one pull rather than two.
  //
  // Direction lock mirrors the carousel's: same 8px slop, same 1.1 bias, so
  // a diagonal resolves to exactly one of swipe / scroll / pull, never both.
  // Tuning + direction lock live in pullToAdd.js so they can be checked
  // without a browser — see scripts/check-pull-to-add.mjs.
  const PULL_IGNORE_SELECTOR =
    'input, textarea, select, a, button, [data-swipe-ignore="true"]';

  let pullDistance = 0;
  let pullTracking = false;
  let pullLocked = false;
  let pullArmed = false;
  let pullStartX = 0;
  let pullStartY = 0;

  $: pullProgress = Math.min(1, pullDistance / PULL_THRESHOLD);

  function resetPullState() {
    pullTracking = false;
    pullLocked = false;
    pullArmed = false;
    pullDistance = 0;
  }

  function canStartPull() {
    if (typeof window === "undefined") return false;
    if (draftItemActive || editingItemId || editingListName) return false;
    if (touchDragItemId || touchDragPendingItemId) return false;
    if (window.scrollY > 0) return false;
    // Deep in a long list a downward drag means "scroll", every time. The
    // gesture belongs to the top of the card or to nothing.
    const top = listContainerNode?.getBoundingClientRect().top;
    return typeof top === "number" && top >= 0;
  }

  function handlePullStart(event) {
    if (event.touches.length !== 1 || !canStartPull()) {
      resetPullState();
      return;
    }

    if (event.target?.closest?.(PULL_IGNORE_SELECTOR)) {
      resetPullState();
      return;
    }

    const touch = event.changedTouches[0];
    pullStartX = touch.screenX;
    pullStartY = touch.screenY;
    pullTracking = true;
    pullLocked = false;
    pullArmed = false;
  }

  function handlePullMove(event) {
    if (!pullTracking) return;

    if (event.touches.length !== 1 || touchDragItemId) {
      resetPullState();
      return;
    }

    const touch = event.changedTouches[0];
    const diffX = touch.screenX - pullStartX;
    const diffY = touch.screenY - pullStartY;

    const { outcome, distance, armed } = resolvePull(diffX, diffY, pullLocked);

    if (outcome === "waiting") return;
    if (outcome === "release") {
      resetPullState();
      return;
    }

    if (window.scrollY > 0) {
      // The page found something to scroll after all — hand it back mid-drag
      // rather than growing a row over a moving page.
      resetPullState();
      return;
    }

    pullLocked = true;
    pullDistance = distance;

    if (armed !== pullArmed) {
      pullArmed = armed;
      // A detent in both directions: crossing back out has to feel like a
      // decision too, or the threshold is invisible.
      hapticService.selection();
      soundService.ratchet?.();
    }
  }

  function handlePullEnd() {
    if (!pullTracking) return;
    const commits = pullArmed;
    resetPullState();
    if (commits) startDraftItem();
  }

  async function startDraftItem({ afterItemId = null } = {}) {
    hapticService.selection();
    soundService.select();
    clearItemFocus();
    movingItemId = null;
    editingItemId = null;
    editedItemText = "";
    draftAfterItemId = afterItemId;
    draftItemActive = true;
    draftItemText = "";
    broadcastDraftActivity({ text: "", mode: "typing" });

    await tick();
    draftInputNode?.focus({ preventScroll: true });
    draftInputNode?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // Returns true when an item was actually committed, so callers (e.g. Enter
  // for rapid-fire adds) know whether to keep the draft open for the next one.
  async function saveDraftItem(options = {}) {
    const keepAdding =
      options !== null &&
      typeof options === "object" &&
      options.keepAdding === true;

    if (isCommittingDraft && !keepAdding) {
      return false;
    }

    const rawTrimmed = draftItemText.trim();
    const newText = /^(?:##|\u2192|->)\s*$/.test(rawTrimmed) ? "" : rawTrimmed;
    let didAdd = false;

    isCommittingDraft = true;
    try {
      if (newText) {
        const result = listsService.addItem(newText, list.id, {
          afterItemId: draftAfterItemId,
          position: "bottom",
        });
        if (!result?.ok) {
          showListStatus(result?.message || "That item needs one more try.");
          hapticService.notification("warning");
          soundService.locked();
          if (!keepAdding) {
            draftItemActive = false;
            draftAfterItemId = null;
            draftItemText = "";
            clearDraftActivity();
          }
          return false;
        }

        if (result.message) {
          showListStatus(result.message, true);
        }
        if (draftAfterItemId !== null && result.itemId) {
          draftAfterItemId = result.itemId;
        }
        soundService.add({ force: true });
        didAdd = true;
      }

      hapticService.selection();

      // Rapid-fire: a committed Enter clears the field, keeps the draft row
      // open directly beneath the item just typed, and restores focus after
      // the DOM updates so keyboard list-making flows uninterrupted.
      if (keepAdding && didAdd) {
        draftItemText = "";
        broadcastDraftActivity({ text: "", mode: "typing" });
        await tick();
        draftInputNode?.focus({ preventScroll: true });
        draftInputNode?.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
        return true;
      }

      draftItemActive = false;
      draftAfterItemId = null;
      draftItemText = "";
      clearDraftActivity();
      return didAdd;
    } finally {
      isCommittingDraft = false;
    }
  }

  function cancelDraftItem() {
    draftItemActive = false;
    draftAfterItemId = null;
    draftItemText = "";
    clearDraftActivity();
    hapticService.selection();
    soundService.close();
  }

  function handleDraftItemKeyDown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      // Keep the draft open on Enter for rapid-fire adds; blur/Escape close it.
      void saveDraftItem({ keepAdding: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
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
    <!-- List Header with Live Collaboration Toggle -->
    <div
      class="zl-list-header"
      class:is-sharing={isLive}
      class:is-guest={!showListManagement}
    >
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
              <div class="zl-live-header-pill">
                {#if !showListManagement}
                  <span
                    class="zl-guest-identity"
                    title={`Sharing as ${localAvatar}`}
                  >
                    <img
                      src={passportFace || getAvatarImage(localAvatar)}
                      alt=""
                      aria-hidden="true"
                    />
                    <span class="zl-visually-hidden">Sharing as</span>
                    <strong>{localAvatar}</strong>
                  </span>
                {/if}
                <button
                  type="button"
                  class="zl-live-presence"
                  on:click={tapHeart}
                  title={remotePresence.length > 0
                    ? `${remotePresence.length} here · send a heart`
                    : "Shared list · send a heart"}
                  aria-label={remotePresence.length > 0
                    ? `Send a heart · ${remotePresence.length} ${remotePresence.length === 1 ? "person" : "people"} here`
                    : "Send a heart to this shared list"}
                >
                  <span class="zl-live-presence-pulse" aria-hidden="true"
                  ></span>
                  {#if remotePresence.length > 0}
                    <div class="zl-presence-dots" aria-hidden="true">
                      {#each remotePresence.slice(0, 3) as user (user.id)}
                        <img
                          class="zl-presence-dot"
                          title={user.avatar}
                          alt=""
                          src={getAvatarImage(user.avatar)}
                          style="background-color: {getAvatarColor(
                            user.avatar,
                          )}"
                        />
                      {/each}
                    </div>
                    {#if remotePresence.length > 3}
                      <span class="zl-live-presence-count" aria-hidden="true"
                        >+{remotePresence.length - 3}</span
                      >
                    {/if}
                  {:else}
                    <span class="zl-live-presence-label" aria-hidden="true"
                      >Live</span
                    >
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
              </div>
            {/if}
          </div>
        {/if}
      </div>

      {#if !editingListName}
        <div class="zl-list-actions">
          {#if checkableActiveItems.length >= 2}
            <button
              type="button"
              class="zl-shuffle-button zl-dice-button"
              class:is-rolling={diceRolling}
              on:click={pickOneForMe}
              data-tip="Let fate pick one"
              aria-label={`Pick a random item from ${list.name || "this list"}`}
            >
              <svg
                class="zl-header-icon"
                width="18"
                height="18"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="4.5"></rect>
                <circle
                  cx="8.25"
                  cy="8.25"
                  r="1.35"
                  fill="currentColor"
                  stroke="none"
                ></circle>
                <circle
                  cx="15.75"
                  cy="8.25"
                  r="1.35"
                  fill="currentColor"
                  stroke="none"
                ></circle>
                <circle
                  cx="12"
                  cy="12"
                  r="1.35"
                  fill="currentColor"
                  stroke="none"
                ></circle>
                <circle
                  cx="8.25"
                  cy="15.75"
                  r="1.35"
                  fill="currentColor"
                  stroke="none"
                ></circle>
                <circle
                  cx="15.75"
                  cy="15.75"
                  r="1.35"
                  fill="currentColor"
                  stroke="none"
                ></circle>
              </svg>
            </button>
          {/if}

          <button
            type="button"
            class="zl-share-button"
            class:is-open={shareTrayOpen}
            class:is-live={isLive}
            on:click={toggleShareTray}
            aria-expanded={shareTrayOpen}
            data-tip={isLive ? "Live sharing options" : "Share this list"}
            aria-label={`Share ${list.name || "this list"}`}
          >
            <svg
              class="zl-header-icon"
              width="18"
              height="18"
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

          <!-- Only appears when there is something to manage or order. -->
          {#if canManageList}
            <button
              type="button"
              class="zl-manage-button"
              class:is-open={manageTrayOpen}
              on:click={toggleManageTray}
              aria-expanded={manageTrayOpen}
              data-tip="List options"
              aria-label={`List options for ${list.name || "this list"}`}
            >
              <svg
                class="zl-header-icon"
                width="18"
                height="18"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <circle cx="5" cy="12" r="1.9"></circle>
                <circle cx="12" cy="12" r="1.9"></circle>
                <circle cx="19" cy="12" r="1.9"></circle>
              </svg>
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Getting a list in or out lives WITH the list, not in app Options —
         these are things you do to this list, not preferences. Inline tray, not
         a popover: .zl-card is overflow:clip and anything floating gets sliced. -->
    {#if shareTrayOpen}
      <div
        class="zl-share-tray"
        transition:slide={{ duration: 180, easing: cubicOut }}
      >
        {#if !isLive && listTags.length > 0}
          <div
            class="zl-share-filter"
            role="group"
            aria-label="Send only items tagged"
          >
            {#each listTags as tag (tag)}
              <button
                type="button"
                class="zl-share-tag"
                class:is-on={shareTagFilter === tag}
                data-swipe-ignore="true"
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

        {#if liveFeatureAvailable}
          <button
            type="button"
            class="zl-share-option zl-share-live zl-share-hero"
            class:is-live-active={isLive}
            disabled={isMakingLive}
            aria-busy={isMakingLive}
            title={isLive
              ? "Copy or send the live room link"
              : "Start a live list everyone can edit together"}
            aria-label={isLive ? "Share live link" : "Start live list"}
            on:click={shareAsLiveRoom}
          >
            <span class="zl-share-hero-main">
              <svg
                class="zl-pill-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
                <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
              </svg>
              <span>
                {isMakingLive
                  ? "Connecting..."
                  : isLive
                    ? "Share Live Link"
                    : "Start Live List"}
              </span>
            </span>
            <span class="zl-share-hero-sub">
              {isLive
                ? "Room open · edits sync live"
                : "Edit together in real time"}
            </span>
          </button>
        {/if}

        {#if syncPhrase}
          <!-- The words ARE the link. Say them down the phone, or let someone
               type them in on another device — same room either way. -->
          <button
            type="button"
            class="zl-share-phrase"
            on:click={copyPhraseLink}
            title="Tap to copy live room link"
          >
            <span class="zl-share-phrase-kicker">Room words · tap to copy</span>
            <code>{syncPhrase}</code>
          </button>
        {/if}

        <div
          class="zl-share-secondary"
          role="group"
          aria-label="Send snapshot or QR code"
        >
          <button
            type="button"
            class="zl-share-option"
            title="Show QR code for this list"
            aria-label="QR this list"
            on:click={qrThisList}
          >
            <svg
              class="zl-pill-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3" />
            </svg>
            <span>QR Code</span>
          </button>
          <button
            type="button"
            class="zl-share-option"
            title="Copy a snapshot of this list"
            on:click={shareAsLink}
          >
            <svg
              class="zl-pill-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path
                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              />
            </svg>
            <span>Copy Text</span>
          </button>
        </div>

        {#if isLive}
          <div class="zl-live-footer-row">
            <div class="zl-collaborator-badge">
              <img
                src={passportFace || getAvatarImage(localAvatar)}
                alt=""
                aria-hidden="true"
              />
              <label for="zl-collaborator-name-{list.id}">As</label>
              <input
                id="zl-collaborator-name-{list.id}"
                type="text"
                value={localAvatar}
                maxlength="48"
                autocomplete="off"
                on:change={saveCollaboratorName}
                aria-label="Collaborator display name"
              />
            </div>
            {#if showListManagement}
              <button
                type="button"
                class="zl-share-option zl-share-stop"
                on:click={handleStopLive}
                title="End live sharing for this list"
                aria-label="End live sharing for this list"
              >
                <span>End Live</span>
              </button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Actions affect this list rather than sending it. -->
    {#if manageTrayOpen && canManageList}
      <div
        class="zl-manage-tray"
        role="group"
        aria-label="Manage this list"
        transition:slide={{ duration: 180, easing: cubicOut }}
      >
        {#if checkableActiveItems.length >= 2}
          <div class="zl-order-strip" role="group" aria-label="Order items">
            {#if activeItems.length >= 3}
              <button
                type="button"
                class="zl-share-option zl-order-pill"
                on:click={tidyActiveItems}
                disabled={isTidying}
                aria-busy={isTidying}
                title="Group and order items thoughtfully"
                aria-label={`Tidy the items in ${list.name || "this list"}`}
              >
                <svg
                  class="zl-pill-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"
                  ></path>
                  <path
                    d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"
                  ></path>
                </svg>
                <span>{isTidying ? "Tidying..." : "Tidy"}</span>
              </button>
            {/if}
            <button
              type="button"
              class="zl-share-option zl-order-pill"
              on:click={shuffleActiveItems}
              title="Shuffle unchecked items"
              aria-label={`Shuffle the items in ${list.name || "this list"}`}
            >
              <svg
                class="zl-pill-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M16 3h5v5"></path>
                <path d="M4 20 21 3"></path>
                <path d="M21 16v5h-5"></path>
                <path d="M15 15l6 6"></path>
                <path d="M4 4l5 5"></path>
              </svg>
              <span>Shuffle</span>
            </button>
            <button
              type="button"
              class="zl-share-option zl-order-pill"
              class:is-active={sortNewestFirst}
              on:click={sortItemsByAdded}
              title={sortNewestFirst
                ? "Sort newest added first"
                : "Sort oldest added first"}
              aria-label={`Sort ${list.name || "this list"} ${
                sortNewestFirst ? "newest first" : "oldest first"
              }`}
            >
              <svg
                class="zl-pill-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m3 16 4 4 4-4"></path>
                <path d="M7 20V4"></path>
                <path d="m21 8-4-4-4 4"></path>
                <path d="M17 4v16"></path>
              </svg>
              <span>{sortNewestFirst ? "Newest" : "Oldest"}</span>
            </button>
          </div>
        {/if}
        <button
          type="button"
          class="zl-share-option"
          class:is-active={shareInputMode === "paste"}
          on:click={toggleShareInput}
          aria-expanded={shareInputMode === "paste"}
        >
          <svg
            class="zl-pill-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            ><path
              d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
            /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg
          >
          <span>Paste Items</span>
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
                <svg
                  class="zl-pill-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path
                    d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"
                  />
                </svg>
                <span>{isMagicParsing ? "Parsing..." : "Magic Import"}</span>
              </button>
              <button
                type="button"
                class="zl-share-option"
                disabled={!pasteText.trim() || isMagicParsing}
                on:click={pasteItemsIn}
              >
                <span>Add Lines</span>
              </button>
            </div>
          </div>
        {/if}
        {#if showListManagement}
          <button
            type="button"
            class="zl-share-option"
            title="Clone this list and all its items"
            aria-label="Duplicate list"
            on:click={duplicateCurrentList}
          >
            <svg
              class="zl-pill-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="8" y="8" width="13" height="13" rx="2" />
              <path
                d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"
              />
            </svg>
            <span>Duplicate List</span>
          </button>
        {/if}
        {#if list.items.some((item) => item.checked)}
          <button
            type="button"
            class="zl-share-option"
            on:click={() => {
              clearDoneItems();
              manageTrayOpen = false;
            }}
          >
            <span>Clear Checked</span>
          </button>
        {/if}
        {#if list.items.length > 0}
          <button
            type="button"
            class="zl-share-option zl-share-clear"
            title="Wipe all items from this list"
            aria-label="Empty this list"
            on:click={clearEntireList}
          >
            <svg
              class="zl-pill-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.8 2.4c.8-.8 2-.8 2.8 0L21.6 7.4c.8.8.8 2 0 2.8L11 20"
              />
              <path d="m6 11 7 7" />
            </svg>
            <span>Empty List</span>
          </button>
        {/if}
        {#if canDeleteList}
          <button
            type="button"
            class="zl-share-option zl-share-delete-list"
            title="Delete this list"
            aria-label="Delete this list"
            on:click={deleteEntireList}
          >
            <svg
              class="zl-pill-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete List</span>
          </button>
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

    {#if undoDelete && (undoDelete.type === "list" || undoDelete.type === "untag" || undoDelete.listId === list.id)}
      <div
        class="zl-undo-toast"
        role="status"
        aria-live="polite"
        transition:fade={{ duration: 180 }}
      >
        <span class="zl-undo-text">
          {undoDelete.type === "list"
            ? `Deleted list "${undoDelete.listName}"`
            : undoDelete.type === "untag"
              ? `Removed #${undoDelete.tag} from items`
              : undoDelete.type === "all"
                ? "Cleared entire list"
                : undoDelete.type === "done"
                  ? `Cleared ${undoDelete.count} completed ${undoDelete.count === 1 ? "item" : "items"}`
                  : undoDelete.type === "uncheck"
                    ? `Unchecked ${undoDelete.count} ${undoDelete.count === 1 ? "item" : "items"}`
                    : `Deleted ${undoDelete.item?.text || "item"}`}
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

    <!-- Interactive Tag Rack Shelf: 1-tap filtering across list tags -->
    {#if listTags.length > 0}
      <div
        class="zl-tag-rack"
        data-swipe-ignore="true"
        role="toolbar"
        aria-label="Filter by tag"
      >
        <button
          type="button"
          class="zl-tag-rack-pill zl-tag-rack-all"
          class:is-active={activeTagFilter === null}
          data-swipe-ignore="true"
          on:click={() => {
            if (activeTagFilter !== null) clearActiveTagFilter();
          }}
          aria-pressed={activeTagFilter === null}
        >
          All
          <span class="zl-tag-rack-count">
            {activeItems.filter(isCheckableItem).length || activeItems.length}
          </span>
        </button>
        {#each listTags as tag (tag)}
          {@const count = listTagCounts.get(tag) || 0}
          <button
            type="button"
            class="zl-tag-rack-pill"
            class:is-active={activeTagFilter === tag}
            data-swipe-ignore="true"
            style={`--tag-colour: ${tagColour(tag)}`}
            on:click={() => toggleActiveTagFilter(tag)}
            aria-pressed={activeTagFilter === tag}
            title={`Filter by #${tag} (${count})`}
          >
            <span class="zl-tag-rack-hash">#</span>{tag}
            <span class="zl-tag-rack-count">{count}</span>
          </button>
        {/each}
      </div>
    {/if}

    <!-- List Items -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="zl-list-container"
      bind:this={listContainerNode}
      on:touchstart={handlePullStart}
      on:touchmove={handlePullMove}
      on:touchend={handlePullEnd}
      on:touchcancel={resetPullState}
    >
      <!-- What the active tag can DO, hung under the rack that already says
           WHICH tag it is. This used to be a full bordered card that opened
           by restating "#ziplist (5)" — a label and a count already on screen
           forty pixels above, in a highlighted pill. It also carried its own
           "Show all ✕", which was the THIRD control for clearing a filter:
           the "All" pill does it, and tapping the lit tag toggles it off
           (toggleActiveTagFilter). Both survive; this one doesn't.

           What's left is only what nothing else can do. Resample and Rename
           read as one pair because they are one: both make something new out
           of the tag. Untag all destroys and says so. -->
      {#if activeTagFilter}
        <div
          class="zl-tag-filter-actions"
          role="group"
          aria-label={`Actions for #${activeTagFilter}`}
          transition:fade={{ duration: 150 }}
        >
          <button
            type="button"
            class="zl-tag-action-btn zl-tag-spin-btn"
            data-swipe-ignore="true"
            on:click={spinOutTagToNewList}
            title={`Spin #${activeTagFilter} items into a new list`}
            aria-label={`Spin #${activeTagFilter} into new list`}
          >
            <svg
              class="zl-pill-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
            <span>Spin</span>
          </button>
          {#if renamingTagActive}
            <input
              type="text"
              class="zl-tag-rename-input"
              data-swipe-ignore="true"
              bind:this={renameTagInputNode}
              bind:value={renamingTagValue}
              aria-label={`Rename #${activeTagFilter}`}
              on:blur={commitRenameActiveTag}
              on:keydown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRenameActiveTag();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRenamingActiveTag();
                }
              }}
            />
          {:else}
            <button
              type="button"
              class="zl-tag-action-btn"
              data-swipe-ignore="true"
              on:click={startRenamingActiveTag}
              title={`Rename #${activeTagFilter} across this list`}
              aria-label={`Rename #${activeTagFilter}`}
            >
              <svg
                class="zl-pill-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path
                  d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                />
              </svg>
              <span>Rename</span>
            </button>
          {/if}
          <button
            type="button"
            class="zl-tag-action-btn zl-tag-action-untag"
            data-swipe-ignore="true"
            on:click={untagAllActiveTag}
            title={`Remove #${activeTagFilter} from all items`}
            aria-label={`Remove #${activeTagFilter} tag`}
          >
            <span>Untag</span>
          </button>
        </div>
      {/if}

      <!-- The affordance IS the gesture: a ghost of the draft row grows out
           of the top of the list under the finger, dashed exactly like the
           real one, so the control explains itself without a word of
           instruction. Height comes straight off --zl-pull, so there is no
           animation to keep in sync with the touch handler — one number
           drives both, and they cannot drift apart. -->
      <div
        class="zl-pull-hint"
        class:armed={pullArmed}
        class:settling={!pullTracking}
        style="--zl-pull: {pullDistance}px; --zl-pull-t: {pullProgress}"
        aria-hidden="true"
      >
        <div class="zl-pull-hint-row">
          <span class="zl-pull-mark">+</span>
          <span class="zl-pull-label">New item</span>
        </div>
      </div>

      {#if list.items.length > 0 || draftItemActive || remoteDrafts.length > 0 || remoteVoices.length > 0}
        <ul
          class="zl-list"
          role="list"
          aria-label={`${list.name || "List"} items`}
          in:fade={{ duration: 200 }}
        >
          {#each renderedActiveEntries as entry (entry.id)}
            {@const item = entry.item}
            {@const itemPortalColor = item ? resolvePortalColor(item) : ""}
            <li
              class="zl-item"
              style="--zl-item-step: {entry.step}{itemPortalColor
                ? `; --portal-colour: ${itemPortalColor}`
                : ''}"
              class:zl-draft-item={entry.isDraft}
              class:checked={Boolean(item?.checked)}
              class:section-divider={Boolean(
                item &&
                !item.checked &&
                (/^##\s*/.test(item.text) || item.text.trim() === "---"),
              )}
              class:pure-divider={Boolean(
                item &&
                !item.checked &&
                (item.text.trim() === "##" || item.text.trim() === "---"),
              )}
              class:portal-item={Boolean(
                item && !item.checked && /^(\u2192|->)\s+/.test(item.text),
              )}
              class:editing={entry.isDraft || editingItemId === item?.id}
              class:dragging={!entry.isDraft && draggedItemId === item?.id}
              class:drag-over={!entry.isDraft && dragOverItemId === item?.id}
              class:drag-over-after={!entry.isDraft &&
                dragOverItemId === item?.id &&
                dragOverPosition === "after"}
              class:just-edited={Boolean(
                item && recentlyEditedItems.has(item.id),
              )}
              class:fate-picked={!entry.isDraft &&
                fatePickedItemId === item?.id}
              class:settling={Boolean(item && settlingItemIds.has(item.id))}
              class:touch-placeholder={!entry.isDraft &&
                touchDragItemId === item?.id}
              draggable={Boolean(
                item &&
                !item.checked &&
                editingItemId !== item.id &&
                !touchDragItemId,
              )}
              on:touchstart={(e) => item && handleRowTouchStart(e, item)}
              on:dragstart={(e) => item && handleDragStart(e, item.id)}
              on:dragend={handleDragEnd}
              on:dragover={(e) => item && handleDragOver(e, item.id)}
              on:drop={(e) => item && handleDrop(e, item.id)}
              animate:flip={{
                duration: touchDragItemId ? 220 : 260,
                easing: quintOut,
              }}
              in:itemIn
              out:itemOut
              aria-grabbed={item ? getItemGrabbedState(item.id) : undefined}
              aria-dropeffect={item ? "move" : undefined}
              role="listitem"
              use:registerItemNode={item ? item.id : null}
            >
              {#if entry.isDraft}
                <DraftItemRow
                  bare
                  listId={list.id}
                  bind:draftItemText
                  bind:inputNode={draftInputNode}
                  staggerDelay={0}
                  onSaveDraft={saveDraftItem}
                  onDraftKeyDown={handleDraftItemKeyDown}
                  onTyping={handleDraftTyping}
                  onCancelDraft={cancelDraftItem}
                  {suggestedTags}
                  {moveTargets}
                />
              {:else}
                <ListItemBody
                  listId={list.id}
                  {item}
                  isEditing={editingItemId === item.id}
                  bind:editedItemText
                  showDropIndicator={dragOverItemId === item.id}
                  {dragOverPosition}
                  activeItemsCount={activeItems.length}
                  isTouchActive={touchDragItemId === item.id}
                  isSettling={settlingItemIds.has(item.id)}
                  currentListName={list.name || ""}
                  onToggle={toggleItem}
                  onPressCheckbox={pressCheckbox}
                  onStartEdit={startEditingItem}
                  onSaveEdit={saveItemEdit}
                  onEditKeyDown={handleEditItemKeyDown}
                  onTyping={handleEditTyping}
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
              {/if}
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

          {#if draftItemActive && !inlineDraftAnchorId}
            <DraftItemRow
              listId={list.id}
              bind:draftItemText
              bind:inputNode={draftInputNode}
              staggerDelay={0}
              onSaveDraft={saveDraftItem}
              onDraftKeyDown={handleDraftItemKeyDown}
              onTyping={handleDraftTyping}
              onCancelDraft={cancelDraftItem}
              {suggestedTags}
              {moveTargets}
            />
          {:else if !draftItemActive}
            <li
              class="zl-add-row"
              role="listitem"
              on:dragover={(e) => {
                if (!draggedItemId || activeItems.length === 0) return;
                const lastActive = activeItems[activeItems.length - 1];
                if (draggedItemId === lastActive.id) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                if (
                  dragOverItemId !== lastActive.id ||
                  dragOverPosition !== "after"
                ) {
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

          {#if $listPreferences.showChecked && (activeTagFilter ? renderedCompletedItems.length : completedItems.length) > 0}
            <CompletedDivider
              count={activeTagFilter
                ? renderedCompletedItems.length
                : completedItems.length}
              on:clear={clearDoneItems}
              on:reset={uncheckAllItems}
            />
          {/if}

          {#each $listPreferences.showChecked ? renderedCompletedItems : [] as item (item.id)}
            <li
              class="zl-item"
              class:checked={item.checked}
              class:editing={editingItemId === item.id}
              class:dragging={draggedItemId === item.id}
              class:drag-over={dragOverItemId === item.id}
              class:drag-over-after={dragOverItemId === item.id &&
                dragOverPosition === "after"}
              class:just-edited={recentlyEditedItems.has(item.id)}
              class:fate-picked={fatePickedItemId === item.id}
              class:settling={settlingItemIds.has(item.id)}
              class:touch-placeholder={touchDragItemId === item.id}
              draggable={!item.checked &&
                editingItemId !== item.id &&
                !touchDragItemId}
              on:touchstart={(e) => handleRowTouchStart(e, item)}
              on:dragstart={(e) => handleDragStart(e, item.id)}
              on:dragend={handleDragEnd}
              on:dragover={(e) => handleDragOver(e, item.id)}
              on:drop={(e) => handleDrop(e, item.id)}
              animate:flip={{
                duration: touchDragItemId ? 220 : 260,
                easing: quintOut,
              }}
              in:itemIn
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
                isSettling={settlingItemIds.has(item.id)}
                currentListName={list.name || ""}
                onToggle={toggleItem}
                onPressCheckbox={pressCheckbox}
                onStartEdit={startEditingItem}
                onSaveEdit={saveItemEdit}
                onEditKeyDown={handleEditItemKeyDown}
                onTyping={handleEditTyping}
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
      {:else}
        <!-- Empty state - Minimalist and friendly with tactile add button -->
        <div class="zl-empty-container" in:fade={{ duration: 200 }}>
          <button
            type="button"
            class="zl-empty-state clickable"
            on:click={handleEmptyStateClick}
            aria-label={`Fresh slate. Add the first thing or talk it in. Add the first item to ${
              list.name || "this list"
            }`}
          >
            <div class="zl-empty-content">
              <h3 class="zl-empty-title">Fresh slate</h3>
              <p class="zl-empty-description">Add the first thing</p>
              <p class="zl-empty-hint">or talk it in</p>
            </div>
          </button>
          {#if !draftItemActive}
            <button
              type="button"
              class="zl-tactile-add-button zl-empty-add-button"
              on:click={startDraftItem}
              aria-label={`Add item to ${list.name || "this list"}`}
            >
              <span class="zl-tactile-add-plus" aria-hidden="true">+</span>
              <span class="zl-tactile-add-text">Add item</span>
            </button>
          {/if}
        </div>
      {/if}
      {#if touchDraggedItem && touchDragGhostRect}
        {@const ghostIsSection =
          /^##\s*/.test(touchDraggedItem.text) ||
          touchDraggedItem.text.trim() === "---"}
        {@const ghostSectionTitle = ghostIsSection
          ? touchDraggedItem.text.trim() === "---"
            ? ""
            : touchDraggedItem.text.replace(/^##\s*/, "").trim()
          : ""}
        {@const ghostIsPortal = /^(\u2192|->)\s+/.test(touchDraggedItem.text)}
        {@const ghostPortalTarget = ghostIsPortal
          ? touchDraggedItem.text.replace(/^(\u2192|->)\s+/, "").trim()
          : ""}
        {@const ghostPortalColor = resolvePortalColor(touchDraggedItem)}
        <div class="zl-touch-ghost" style={touchGhostStyle} aria-hidden="true">
          <div
            class="zl-item zl-touch-ghost-item"
            class:section-divider={ghostIsSection}
            class:pure-divider={ghostIsSection && !ghostSectionTitle}
            class:portal-item={ghostIsPortal}
            style="--zl-item-step: {renderedActiveItems.length > 1
              ? Math.max(
                  0,
                  renderedActiveItems.findIndex(
                    (it) => it.id === touchDraggedItem.id,
                  ),
                ) /
                (renderedActiveItems.length - 1)
              : 0}{ghostPortalColor
              ? `; --portal-colour: ${ghostPortalColor}`
              : ''}"
          >
            {#if ghostIsSection}
              {#if ghostSectionTitle}
                <span class="zl-checkbox-wrapper zl-item-section-glyph">
                  <span class="zl-section-badge">§</span>
                </span>
              {/if}
            {:else if ghostIsPortal}
              <span class="zl-checkbox-wrapper zl-portal-button">
                <span class="zl-portal-badge">→</span>
              </span>
            {:else}
              <span class="zl-checkbox-wrapper">
                <span class="zl-checkbox-custom"></span>
              </span>
            {/if}

            <div class="edit-wrapper">
              <span class="zl-item-text-button">
                {#if ghostIsSection}
                  {#if ghostSectionTitle}
                    <span class="zl-item-section-text">
                      {ghostSectionTitle}
                    </span>
                  {:else}
                    <div class="zl-item-divider-bar">
                      <span class="zl-item-divider-line"></span>
                    </div>
                  {/if}
                {:else if ghostIsPortal}
                  <span class="zl-item-text zl-item-portal-text">
                    <span class="zl-portal-target-name">
                      {ghostPortalTarget}
                    </span>
                    <span class="zl-portal-jump-chip">
                      {ghostPortalColor ? "Jump ↗" : "New list ↗"}
                    </span>
                  </span>
                {:else}
                  <span class="zl-item-text">{touchDraggedItem.text}</span>
                {/if}
              </span>
              {#if touchDraggedItem.tags?.length}
                <div class="zl-item-tags">
                  {#each touchDraggedItem.tags as tag (tag)}
                    <span
                      class="zl-item-tag"
                      style={`--tag-colour: ${tagColour(tag)}`}>#{tag}</span
                    >
                  {/each}
                </div>
              {/if}
            </div>

            <div class="zl-item-side">
              <div class="zl-item-more-button grab-indicator touch-active">
                <svg
                  class="zl-item-handle-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="7" cy="5" r="1.65" />
                  <circle cx="13" cy="5" r="1.65" />
                  <circle cx="7" cy="10" r="1.65" />
                  <circle cx="13" cy="10" r="1.65" />
                  <circle cx="7" cy="15" r="1.65" />
                  <circle cx="13" cy="15" r="1.65" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>
