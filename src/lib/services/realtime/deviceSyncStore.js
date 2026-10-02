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
import { listsStore, getMaxListCount } from "../lists/listsStore.js";
import { getContributorTokenSnapshot, setContributorStatus } from "$lib";
import { LIVE_MESSAGE_TYPES } from "./liveListProtocol.js";

function toast(message) {
  window.dispatchEvent(
    new CustomEvent("ziplist:toast", { detail: { message } }),
  );
}

function createDeviceSyncStore() {
  const { subscribe, set, update } = writable({
    phrase: "",
    key: "",
    status: "disconnected", // "disconnected" | "connecting" | "connected" | "mismatch" | "error"
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

    // No "newer than the last one" gate: the merge is idempotent, and a gate
    // keyed on another device's clock skipped real edits whenever that
    // clock ran behind.
    try {
      isApplyingRemote = true;

      const result = await listsStore.importCollectionBundle(
        envelope,
        state.key,
      );
      if (result.ok) {
        update((s) => ({
          ...s,
          status: "connected",
          error: null,
          lastSyncAt: Date.now(),
        }));
        if (result.overflowCount > 0) {
          toast(
            `${result.overflowCount} more ${result.overflowCount === 1 ? "list" : "lists"} on the other device. This one keeps ${getMaxListCount()}.`,
          );
        }
      } else {
        console.warn(
          "[DeviceSync] Could not merge incoming bundle:",
          result.error,
        );
        // A live envelope (the relay tags those with a sender) that will not
        // open means another device is in this room on a different key —
        // say so rather than show "On" over a sync that moves nothing. A
        // stored catch-up that will not open is just stale: this device's
        // own push on connect replaces it.
        if (envelope.sender) {
          update((s) => ({
            ...s,
            status: "mismatch",
            error: "Key mismatch. A fresh pairing link sorts it.",
          }));
        }
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

  function schedulePush() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void pushLocalEnvelope();
    }, 500);
  }

  /**
   * Push current collection as an encrypted envelope to the relay.
   */
  async function pushLocalEnvelope() {
    if (!socket || socket.readyState !== PartySocket.OPEN) return;
    if (isApplyingRemote) {
      schedulePush();
      return;
    }

    const state = get({ subscribe });
    if (!state.key) return;

    try {
      const envelope = await listsStore.exportCollectionBundle(state.key);
      // socket can be swapped or dropped while the envelope encrypts.
      if (envelope && socket?.readyState === PartySocket.OPEN) {
        socket.send(JSON.stringify(envelope));
        update((s) => ({ ...s, lastSyncAt: Date.now() }));
      }
    } catch (err) {
      console.error("[DeviceSync] Failed to push local envelope:", err);
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
      if (isApplyingRemote || !get({ subscribe }).enabled) return;
      schedulePush();
    });
  }

  /**
   * Pull phrase, key and supporter code out of a pairing link. Accepts the
   * whole URL or any paste that contains `?sync=…#k=…`.
   */
  function parsePairingLink(text) {
    const value = (text ?? "").toString().trim();
    const queryAt = value.indexOf("?");
    const hashAt = value.indexOf("#");
    if (queryAt === -1 || hashAt === -1 || hashAt < queryAt) return null;

    const query = new URLSearchParams(value.slice(queryAt + 1, hashAt));
    const hash = new URLSearchParams(value.slice(hashAt + 1));
    const phrase = normalizeSyncPhrase(query.get("sync"));
    const key = hash.get("k") || "";
    if (!isValidSyncPhrase(phrase) || key.length !== 43) return null;

    return { phrase, key, code: hash.get("code") || "" };
  }

  function applyPairing({ phrase, key, code }) {
    persistCredentials(phrase, key);
    if (code) {
      try {
        setContributorStatus(true, code);
      } catch (err) {
        console.warn("[DeviceSync] Failed to apply supporter code:", err);
      }
    }
    ensureCredentials(false);
    void connect();
  }

  /**
   * Cold boot from a scanned QR or opened link (?sync=...#k=...&code=...).
   */
  function handleIncomingUrl() {
    if (!browser) return false;
    const pairing = parsePairingLink(window.location.href);
    if (!pairing) return false;

    // Clean the address bar so the key never lands in browsing history.
    const url = new URL(window.location.href);
    url.searchParams.delete("sync");
    window.history.replaceState({}, "", url.pathname + url.search);

    applyPairing(pairing);
    return true;
  }

  /**
   * Pasted link — the way into an installed PWA, whose storage is separate
   * from the browser a QR scan opens. Four typed words cannot work here: the
   * key is random and lives only in the link (docs/DEVICE_SYNC_SPEC.md).
   */
  function pairWithLink(text) {
    const pairing = parsePairingLink(text);
    if (!pairing) return { ok: false };
    applyPairing(pairing);
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
    pairWithLink,
    enableSync,
    disableSync,
  };
}

export const deviceSyncStore = createDeviceSyncStore();
