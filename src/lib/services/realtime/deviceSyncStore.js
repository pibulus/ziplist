// ═══════════════════════════════════════════════════════════════════════════
// 📱 deviceSyncStore — Sovereign Device Sync Engine
// ═══════════════════════════════════════════════════════════════════════════
// Zero-knowledge end-to-end encrypted collection handoff and continuous sync
// across phones, tablets, and laptops.
//
// Key principles:
// 1. Encryption keys never leave the device (except in URL hash #k=...).
// 2. Debounced 500ms snapshots avoid echo storms.
// 3. 30-day tombstones prevent zombie resurrection.
// 4. Peer discovery via Cloudflare DO relay (zl_p<hex>).

import { writable, get } from "svelte/store";
import { browser } from "$app/environment";
import PartySocket from "partysocket";
import { getPartyKitHost } from "./partyService.js";
import {
  generateSyncPhrase,
  normalizeSyncPhrase,
  isValidSyncPhrase,
  deriveRoomIdFromPhrase,
} from "./syncPhrase.js";
import { generateRandomSyncKey } from "./syncCrypto.js";
import { STORAGE_KEYS } from "$lib/constants.js";
import { listsStore } from "../lists/listsStore.js";
import { getContributorTokenSnapshot, setContributorStatus } from "$lib";
import { LIVE_MESSAGE_TYPES } from "./liveListProtocol.js";

function createDeviceSyncStore() {
  const { subscribe, set, update } = writable({
    phrase: "",
    key: "",
    status: "disconnected", // "disconnected" | "connecting" | "connected" | "syncing" | "error"
    error: null,
    peerCount: 0,
    lastSyncAt: null,
    shareUrl: "",
    enabled: false,
  });

  let socket = null;
  let debounceTimer = null;
  let isApplyingRemote = false;
  let listsUnsubscribe = null;
  let lastReceivedEnvelopeTimestamp = 0;

  function buildShareUrl(phrase, key) {
    if (!browser || !phrase || !key) return "";
    const token = getContributorTokenSnapshot();
    const origin = window.location.origin;
    const codeParam = token ? `&code=${encodeURIComponent(token)}` : "";
    return `${origin}/?sync=${encodeURIComponent(phrase)}#k=${encodeURIComponent(key)}${codeParam}`;
  }

  function getStoredCredentials() {
    if (!browser) return { phrase: "", key: "" };
    const phrase = localStorage.getItem(STORAGE_KEYS.SYNC_PHRASE) || "";
    const key = localStorage.getItem(STORAGE_KEYS.SYNC_KEY) || "";
    return { phrase, key };
  }

  function persistCredentials(phrase, key) {
    if (!browser) return;
    if (phrase) localStorage.setItem(STORAGE_KEYS.SYNC_PHRASE, phrase);
    if (key) localStorage.setItem(STORAGE_KEYS.SYNC_KEY, key);
  }

  /**
   * Initialize or retrieve existing sync credentials.
   * If createIfMissing is true, generates a fresh phrase and 256-bit key.
   */
  function ensureCredentials(createIfMissing = false) {
    let { phrase, key } = getStoredCredentials();
    if ((!phrase || !key) && createIfMissing) {
      phrase = generateSyncPhrase();
      key = generateRandomSyncKey();
      persistCredentials(phrase, key);
    }
    const shareUrl = buildShareUrl(phrase, key);
    update((s) => ({
      ...s,
      phrase,
      key,
      shareUrl,
      enabled: Boolean(phrase && key),
    }));
    return { phrase, key, shareUrl };
  }

  /**
   * Connect to the Cloudflare DO relay room for this device's phrase.
   */
  async function connect() {
    if (!browser) return;
    const { phrase, key } = ensureCredentials(false);
    if (!phrase || !key) {
      update((s) => ({ ...s, status: "disconnected" }));
      return;
    }

    if (socket) {
      socket.close();
      socket = null;
    }

    update((s) => ({ ...s, status: "connecting", error: null }));

    try {
      const roomId = await deriveRoomIdFromPhrase(phrase);
      if (!roomId) {
        throw new Error("Could not derive room ID from sync phrase.");
      }

      const host = getPartyKitHost();
      if (!host) {
        update((s) => ({
          ...s,
          status: "disconnected",
          error: "Relay host not configured",
        }));
        return;
      }

      socket = new PartySocket({
        host,
        room: roomId,
        query: { avatar: "Device" },
      });

      socket.addEventListener("open", () => {
        update((s) => ({
          ...s,
          status: "connected",
          peerCount: Math.max(1, s.peerCount),
          error: null,
        }));
        // Push local snapshot envelope upon connection for catch-up
        void pushLocalEnvelope();
      });

      socket.addEventListener("message", async (event) => {
        try {
          const message = JSON.parse(event.data);
          if (
            message.type === LIVE_MESSAGE_TYPES.PRESENCE &&
            Array.isArray(message.data)
          ) {
            update((s) => ({ ...s, peerCount: message.data.length }));
          } else if (
            message.type === LIVE_MESSAGE_TYPES.SYNC_ENVELOPE ||
            (message.ct && message.iv)
          ) {
            await handleRemoteEnvelope(message);
          }
        } catch (err) {
          console.error(
            "[DeviceSync] Failed to process incoming message:",
            err,
          );
        }
      });

      socket.addEventListener("close", () => {
        update((s) => ({
          ...s,
          status: "disconnected",
          peerCount: 0,
        }));
      });

      socket.addEventListener("error", (err) => {
        console.warn("[DeviceSync] Socket error:", err);
        update((s) => ({
          ...s,
          status: "error",
          error: "Connection lost. Reconnecting...",
        }));
      });

      // Hook up listsStore changes to auto-broadcast
      bindListsStore();
    } catch (err) {
      console.error("[DeviceSync] Connection error:", err);
      update((s) => ({
        ...s,
        status: "error",
        error: err.message || "Failed to connect",
      }));
    }
  }

  /**
   * Handle an incoming encrypted sync envelope from the relay.
   */
  async function handleRemoteEnvelope(envelope) {
    const state = get({ subscribe });
    if (!state.key) return;

    // Check envelope timestamp to avoid reprocessing older snapshots
    if (
      envelope.updatedAt &&
      envelope.updatedAt <= lastReceivedEnvelopeTimestamp
    ) {
      return;
    }

    try {
      update((s) => ({ ...s, status: "syncing" }));
      isApplyingRemote = true;

      const result = await listsStore.importCollectionBundle(
        envelope,
        state.key,
      );
      if (result.ok) {
        lastReceivedEnvelopeTimestamp = envelope.updatedAt || Date.now();
        const now = Date.now();
        update((s) => ({
          ...s,
          status: "connected",
          lastSyncAt: now,
        }));
      } else {
        console.warn(
          "[DeviceSync] Could not merge incoming bundle:",
          result.error,
        );
        update((s) => ({ ...s, status: "connected" }));
      }
    } catch (err) {
      console.error("[DeviceSync] Error merging remote envelope:", err);
      update((s) => ({ ...s, status: "connected" }));
    } finally {
      // Delay releasing isApplyingRemote to allow store subscriber to settle
      setTimeout(() => {
        isApplyingRemote = false;
      }, 100);
    }
  }

  /**
   * Push current collection as an encrypted envelope to the relay.
   */
  async function pushLocalEnvelope() {
    if (!socket || socket.readyState !== PartySocket.OPEN || isApplyingRemote) {
      return;
    }

    const state = get({ subscribe });
    if (!state.key) return;

    try {
      update((s) => ({ ...s, status: "syncing" }));
      const envelope = await listsStore.exportCollectionBundle(state.key);
      if (envelope && socket.readyState === PartySocket.OPEN) {
        socket.send(JSON.stringify(envelope));
        update((s) => ({
          ...s,
          status: "connected",
          lastSyncAt: Date.now(),
        }));
      } else {
        update((s) => ({ ...s, status: "connected" }));
      }
    } catch (err) {
      console.error("[DeviceSync] Failed to push local envelope:", err);
      update((s) => ({ ...s, status: "connected" }));
    }
  }

  /**
   * Listen to local listsStore changes and debounced push (500ms).
   */
  function bindListsStore() {
    if (listsUnsubscribe) return;
    let initialSkip = true;

    listsUnsubscribe = listsStore.subscribe(() => {
      if (initialSkip) {
        initialSkip = false;
        return;
      }
      if (isApplyingRemote) return;

      const state = get({ subscribe });
      if (!state.enabled || state.status !== "connected") return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void pushLocalEnvelope();
      }, 500);
    });
  }

  /**
   * Inspect current window URL for incoming pairing link (?sync=...#k=...&code=...).
   */
  function handleIncomingUrl() {
    if (!browser) return false;

    const url = new URL(window.location.href);
    const syncParam = url.searchParams.get("sync");
    const hash = window.location.hash.slice(1);

    if (!syncParam || !hash) return false;

    const hashParams = new URLSearchParams(hash);
    const keyParam = hashParams.get("k");
    const codeParam = hashParams.get("code");

    if (!syncParam || !keyParam) return false;

    const normalizedPhrase = normalizeSyncPhrase(syncParam);
    if (!isValidSyncPhrase(normalizedPhrase)) return false;

    // Save credentials
    persistCredentials(normalizedPhrase, keyParam);

    // If supporter unlock code was bundled, unlock contributor mode
    if (codeParam) {
      try {
        setContributorStatus(true, codeParam);
      } catch (err) {
        console.warn(
          "[DeviceSync] Failed to apply supporter code from sync URL:",
          err,
        );
      }
    }

    // Clean address bar so key and phrase don't leak into browsing history
    url.searchParams.delete("sync");
    const cleanUrl = url.pathname + (url.search ? url.search : "");
    window.history.replaceState({}, "", cleanUrl);

    // Update store state and connect
    ensureCredentials(false);
    void connect();

    return true;
  }

  /**
   * Pair manually with a phrase and optional pass code / key.
   */
  async function pairManually(phraseInput, keyOrCodeInput = "") {
    const phrase = normalizeSyncPhrase(phraseInput);
    if (!isValidSyncPhrase(phrase)) {
      return {
        ok: false,
        error:
          "Please enter a valid 4-word phrase (e.g. sneaky-lynx-preens-streetside).",
      };
    }

    let key = keyOrCodeInput.trim();
    if (!key) {
      // If no key was entered, generate a fallback key or check existing
      const existing = getStoredCredentials();
      key = existing.key || generateRandomSyncKey();
    }

    persistCredentials(phrase, key);
    ensureCredentials(false);
    await connect();

    return { ok: true };
  }

  /**
   * Start device sync: create fresh phrase & key if none exist, and connect.
   */
  async function enableSync() {
    ensureCredentials(true);
    await connect();
  }

  /**
   * Generate a completely fresh sync phrase and encryption key.
   */
  async function rotateCredentials() {
    if (socket) {
      socket.close();
      socket = null;
    }
    const phrase = generateSyncPhrase();
    const key = generateRandomSyncKey();
    persistCredentials(phrase, key);
    ensureCredentials(false);
    await connect();
  }

  /**
   * Disconnect and clear sync from this device.
   */
  function disableSync() {
    if (socket) {
      socket.close();
      socket = null;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    if (listsUnsubscribe) {
      listsUnsubscribe();
      listsUnsubscribe = null;
    }
    if (browser) {
      localStorage.removeItem(STORAGE_KEYS.SYNC_PHRASE);
      localStorage.removeItem(STORAGE_KEYS.SYNC_KEY);
    }
    set({
      phrase: "",
      key: "",
      status: "disconnected",
      error: null,
      peerCount: 0,
      lastSyncAt: null,
      shareUrl: "",
      enabled: false,
    });
  }

  return {
    subscribe,
    ensureCredentials,
    connect,
    handleIncomingUrl,
    enableSync,
    rotateCredentials,
    disableSync,
    pairManually,
    pushLocalEnvelope,
  };
}

export const deviceSyncStore = createDeviceSyncStore();
