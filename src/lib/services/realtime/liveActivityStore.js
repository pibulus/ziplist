import { writable } from "svelte/store";
import { getAvatarColor } from "./avatarService.js";

const DRAFT_TTL_MS = 6500;
const FOCUS_TTL_MS = 5500;
const VOICE_TTL_MS = 45000;
const CLEANUP_INTERVAL_MS = 1000;

function now() {
  return Date.now();
}

function decorateUser(user = {}) {
  const id = user.id || "remote";
  const avatar = user.avatar || "Guest";

  return {
    id,
    avatar,
    color: getAvatarColor(avatar),
  };
}

function isFresh(entry, ttl, timestamp = now()) {
  return timestamp - entry.updatedAt < ttl;
}

function pruneState(state, timestamp = now()) {
  return {
    drafts: state.drafts.filter((entry) =>
      isFresh(entry, DRAFT_TTL_MS, timestamp),
    ),
    focuses: state.focuses.filter((entry) =>
      isFresh(entry, FOCUS_TTL_MS, timestamp),
    ),
    voices: state.voices.filter((entry) =>
      isFresh(entry, VOICE_TTL_MS, timestamp),
    ),
  };
}

function upsertByUser(entries, userId, nextEntry) {
  return [...entries.filter((entry) => entry.id !== userId), nextEntry];
}

export function createLiveActivityStore() {
  const { subscribe, set, update } = writable({
    drafts: [],
    focuses: [],
    voices: [],
  });

  let cleanupInterval = setInterval(() => {
    update((state) => pruneState(state));
  }, CLEANUP_INTERVAL_MS);

  return {
    subscribe,

    updateDraft(user, data = {}) {
      const decoratedUser = decorateUser(user);
      update((state) => ({
        ...state,
        drafts: upsertByUser(state.drafts, decoratedUser.id, {
          ...decoratedUser,
          text: data.text || "",
          itemId: data.itemId || null,
          mode: data.mode || "typing",
          updatedAt: now(),
        }),
      }));
    },

    clearDraft(userId) {
      update((state) => ({
        ...state,
        drafts: state.drafts.filter((entry) => entry.id !== userId),
      }));
    },

    setItemFocus(user, data = {}) {
      const decoratedUser = decorateUser(user);
      const itemId = data.itemId || null;

      update((state) => ({
        ...state,
        focuses: itemId
          ? upsertByUser(state.focuses, decoratedUser.id, {
              ...decoratedUser,
              itemId,
              updatedAt: now(),
            })
          : state.focuses.filter((entry) => entry.id !== decoratedUser.id),
      }));
    },

    setVoiceActivity(user, data = {}) {
      const decoratedUser = decorateUser(user);

      update((state) => ({
        ...state,
        voices: data.active
          ? upsertByUser(state.voices, decoratedUser.id, {
              ...decoratedUser,
              stage: data.stage || "recording",
              updatedAt: now(),
            })
          : state.voices.filter((entry) => entry.id !== decoratedUser.id),
      }));
    },

    clearUser(userId) {
      update((state) => ({
        drafts: state.drafts.filter((entry) => entry.id !== userId),
        focuses: state.focuses.filter((entry) => entry.id !== userId),
        voices: state.voices.filter((entry) => entry.id !== userId),
      }));
    },

    clear() {
      set({ drafts: [], focuses: [], voices: [] });
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
    },
  };
}

const activityStores = new Map();

export function getLiveActivityStore(listId) {
  if (!activityStores.has(listId)) {
    activityStores.set(listId, createLiveActivityStore());
  }

  return activityStores.get(listId);
}

export function cleanupLiveActivityStore(listId) {
  const store = activityStores.get(listId);
  if (store) {
    store.clear();
    activityStores.delete(listId);
  }
}
