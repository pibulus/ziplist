// ═══════════════════════════════════════════════════════════════════════════
// 📱 deviceSyncStore — Sovereign Device Sync Engine
// ═══════════════════════════════════════════════════════════════════════════
// Zero-knowledge end-to-end encrypted collection handoff and continuous sync
// across phones, tablets, and laptops.
//
// Key principles (aligned to TalkType canon):
// 1. The pass code IS the room & key secret (PBKDF2 + HKDF-SHA256).
// 2. Encryption keys never leave the device (derived locally in WebCrypto).
// 3. Continuous debounced 500ms snapshots avoid echo storms.
// 4. 30-day tombstones prevent zombie resurrection.
// 5. Cloudflare DO relay stores one sealed catch-up snapshot per room.

import { writable, get } from "svelte/store";
import { browser } from "$app/environment";
import PartySocket from "partysocket";
import { getPartyKitHost } from "./partyService.js";
import { normalizeSyncPhrase, isValidSyncPhrase } from "./syncPhrase.js";
import { deriveSyncRoom } from "./syncCrypto.js";
import { STORAGE_KEYS } from "$lib/constants";
import { listsStore, getMaxListCount } from "../lists/listsStore.js";
import { isContributor, setContributorStatus } from "$lib";
import { LIVE_MESSAGE_TYPES } from "./liveListProtocol.js";
import {
  readStoredSupporterCode,
  saveStoredSupporterCode,
  clearStoredSupporterCode,
  getVaultHash,
} from "../vaultHashStorage.js";
import { buildDeviceSyncUrl } from "../qrHandshakeService.js";

function toast(message, type = "success") {
  if (!browser) return;
  window.dispatchEvent(
    new CustomEvent("ziplist:toast", { detail: { message, type } }),
  );
}

function readPrivatePhrase() {
  if (!browser) return "";
  try {
    return normalizeSyncPhrase(
      window.localStorage.getItem(STORAGE_KEYS.SYNC_PRIVATE_PHRASE) || "",
    );
  } catch {
    return "";
  }
}

function createDeviceSyncStore() {
  const { subscribe, update } = writable({
    code: "",
    privatePhrase: readPrivatePhrase(),
    vaultHash: "",
    status: "off", // "off" | "connecting" | "connected" | "disconnected" | "unavailable" | "mismatch" | "error"
    error: null,
    peerCount: 0,
    peers: 0,
    lastSyncAt: null,
    shareUrl: "",
    enabled: false,
    roomId: "",
  });

  let socket = null;
  let roomKey = null;
  let roomSecret = "";
  let connectAttempt = 0;
  let debounceTimer = null;
  let isApplyingRemote = false;
  let listsUnsubscribe = null;
  let contributorUnsubscribe = null;
  const CATCH_UP_GRACE_MS = 1500;
  let heardCatchUp = false;
  let catchUpTimer = null;

  function refreshStoreState() {
    const code = readStoredSupporterCode();
    const privatePhrase = readPrivatePhrase();
    const enabled = Boolean(code && get(isContributor));
    const shareUrl = code
      ? buildDeviceSyncUrl({ code, phrase: privatePhrase })
      : "";

    update((s) => ({
      ...s,
      code,
      privatePhrase,
      enabled,
      shareUrl,
    }));

    if (code) {
      getVaultHash(code)
        .then((hash) => {
          update((s) => ({ ...s, vaultHash: hash }));
        })
        .catch(() => {});
    }

    return { code, privatePhrase, enabled, shareUrl };
  }

  function closeSocket() {
    if (catchUpTimer) clearTimeout(catchUpTimer);
    catchUpTimer = null;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
    if (socket) {
      socket.close();
      socket = null;
    }
    roomKey = null;
    roomSecret = "";
  }

  /**
   * Connect to the Cloudflare DO relay room derived from this device's pass code.
   */
  async function connect() {
    if (!browser) return;

    const code = readStoredSupporterCode();
    const isUnlocked = get(isContributor);

    if (!code || !isUnlocked) {
      disconnect();
      return;
    }

    const host = getPartyKitHost();
    if (!host) {
      update((s) => ({
        ...s,
        status: "unavailable",
        error: "Relay host not configured",
      }));
      return;
    }

    const phrase = get({ subscribe }).privatePhrase;
    const secret = phrase ? `${code}:${phrase}` : code;
    if (
      secret === roomSecret &&
      socket &&
      socket.readyState === PartySocket.OPEN
    ) {
      return;
    }

    roomSecret = secret;
    const attempt = ++connectAttempt;
    closeSocket();
    update((s) => ({
      ...s,
      status: "connecting",
      error: null,
      roomId: "",
      peers: 0,
      peerCount: 0,
      enabled: true,
    }));

    let room;
    try {
      room = await deriveSyncRoom(secret, "zl_p");
    } catch (err) {
      console.warn("[DeviceSync] Could not derive sync room:", err);
      if (attempt === connectAttempt) {
        roomSecret = "";
        update((s) => ({
          ...s,
          status: "error",
          error: "Key derivation failed",
        }));
      }
      return;
    }

    if (attempt !== connectAttempt) return;

    roomKey = room.key;
    update((s) => ({
      ...s,
      roomId: room.roomId,
      shareUrl: buildDeviceSyncUrl({ code, phrase }),
    }));

    try {
      socket = new PartySocket({
        host,
        room: room.roomId,
        query: { avatar: "Device" },
      });

      socket.addEventListener("open", () => {
        if (attempt !== connectAttempt) return;
        update((s) => ({
          ...s,
          status: "connected",
          peers: Math.max(1, s.peers),
          peerCount: Math.max(1, s.peerCount),
          error: null,
        }));

        // Prompt presence count
        socket.send(JSON.stringify({ type: "hello" }));
        // Hear the room's catch-up first, and speak only if nothing arrives.
        heardCatchUp = false;
        if (catchUpTimer) clearTimeout(catchUpTimer);
        catchUpTimer = setTimeout(() => {
          catchUpTimer = null;
          if (!heardCatchUp) void pushLocalEnvelope();
        }, CATCH_UP_GRACE_MS);
      });

      socket.addEventListener("message", async (event) => {
        if (attempt !== connectAttempt) return;
        try {
          const message = JSON.parse(event.data);
          if (
            (message.type === LIVE_MESSAGE_TYPES.PRESENCE ||
              message.type === "presence") &&
            (Array.isArray(message.data) ||
              typeof message.data?.count === "number")
          ) {
            const count = Array.isArray(message.data)
              ? message.data.length
              : Number(message.data?.count) || 1;
            update((s) => ({ ...s, peerCount: count, peers: count }));
          } else if (
            message.type === LIVE_MESSAGE_TYPES.SYNC_ENVELOPE ||
            message.type === "sync_envelope" ||
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
        if (attempt !== connectAttempt) return;
        update((s) => ({
          ...s,
          status: "disconnected",
          peerCount: 0,
          peers: 0,
        }));
      });

      socket.addEventListener("error", (err) => {
        if (attempt !== connectAttempt) return;
        console.warn("[DeviceSync] Socket error:", err);
        update((s) => ({
          ...s,
          status: "error",
          error: "Connection lost. Reconnecting...",
        }));
      });

      bindListsStore();
    } catch (err) {
      console.error("[DeviceSync] Connection error:", err);
      if (attempt === connectAttempt) {
        update((s) => ({
          ...s,
          status: "error",
          error: err.message || "Failed to connect",
        }));
      }
    }
  }

  function disconnect() {
    connectAttempt += 1;
    roomSecret = "";
    closeSocket();
    update((s) => ({
      ...s,
      status: "off",
      roomId: "",
      peers: 0,
      peerCount: 0,
      enabled: false,
    }));
  }

  /**
   * Handle an incoming encrypted sync envelope from the relay.
   */
  async function handleRemoteEnvelope(envelope) {
    if (!roomKey) return;

    heardCatchUp = true;
    if (catchUpTimer) {
      clearTimeout(catchUpTimer);
      catchUpTimer = null;
    }

    try {
      isApplyingRemote = true;

      const result = await listsStore.importCollectionBundle(envelope, roomKey);
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

        // If local device had items/lists/edits that the incoming snapshot lacked,
        // push the reconciled collection to update the relay catch-up snapshot.
        if (result.hasLocalDifferences) {
          schedulePush();
        }
      } else {
        console.warn(
          "[DeviceSync] Could not merge incoming bundle:",
          result.error,
        );
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

    if (!roomKey) return;

    try {
      const envelope = await listsStore.exportCollectionBundle(roomKey);
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

  function setPrivatePhrase(value) {
    const phrase = normalizeSyncPhrase(value);
    if (phrase && !isValidSyncPhrase(phrase)) return false;
    if (browser) {
      try {
        if (phrase) {
          window.localStorage.setItem(STORAGE_KEYS.SYNC_PRIVATE_PHRASE, phrase);
        } else {
          window.localStorage.removeItem(STORAGE_KEYS.SYNC_PRIVATE_PHRASE);
        }
      } catch {
        // Storage blocked
      }
    }
    update((s) => ({
      ...s,
      privatePhrase: phrase,
      shareUrl: s.code ? buildDeviceSyncUrl({ code: s.code, phrase }) : "",
    }));
    if (get(isContributor)) void connect();
    return true;
  }

  /**
   * Parse pairing text from URL or pasted string.
   * Supports:
   * 1. New TalkType canon format: /#code=<code>&sync=<phrase>
   * 2. Legacy format: /?sync=<phrase>#k=<key>&code=<code>
   */
  function parsePairingLink(text) {
    const value = (text ?? "").toString().trim();
    if (!value) return null;

    // Check for fragment parameters (#code=... or #k=...)
    const hashAt = value.indexOf("#");
    const queryAt = value.indexOf("?");

    let hashParams = new URLSearchParams();
    let queryParams = new URLSearchParams();

    if (hashAt !== -1) {
      hashParams = new URLSearchParams(value.slice(hashAt + 1));
    }
    if (queryAt !== -1) {
      const queryPart =
        hashAt !== -1 && hashAt > queryAt
          ? value.slice(queryAt + 1, hashAt)
          : value.slice(queryAt + 1);
      queryParams = new URLSearchParams(queryPart);
    }

    const code =
      hashParams.get("code") ||
      hashParams.get("unlock") ||
      queryParams.get("code") ||
      queryParams.get("unlock") ||
      "";
    const privatePhrase =
      hashParams.get("sync") || queryParams.get("sync") || "";

    if (code) {
      return {
        code: code.trim().toUpperCase(),
        phrase: privatePhrase ? normalizeSyncPhrase(privatePhrase) : "",
      };
    }

    // If the input looks like a URL or path without code/unlock query/hash params,
    // never treat the URL itself as a bare Passport code.
    if (
      /^https?:\/\//i.test(value) ||
      value.includes("://") ||
      value.includes("/")
    ) {
      return null;
    }

    // Bare code or 4-word passkey entered directly (e.g. "ZL-XXXX-XXXX" or "velvet-octopus-drifts-by")
    if (value.startsWith("ZL-") || value.length >= 8) {
      return {
        code: value.toUpperCase(),
        phrase: "",
      };
    }

    return null;
  }

  async function applyPairing({ code, phrase }) {
    if (!code) return false;
    try {
      const res = await fetch("/api/contributor/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.valid) {
        return false;
      }
      const canonicalCode = payload.code || code;
      const token = payload.token || null;
      saveStoredSupporterCode(canonicalCode);
      setContributorStatus(true, token);
      if (phrase) {
        setPrivatePhrase(phrase);
      }
      refreshStoreState();
      await connect();
      toast("Devices linked! ✨");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cold boot from opened link or scanned QR.
   */
  function handleIncomingUrl() {
    if (!browser) return false;
    const pairing = parsePairingLink(window.location.href);
    if (!pairing || !pairing.code) return false;

    // Clean address bar so code doesn't stay in browser history
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    url.searchParams.delete("code");
    url.searchParams.delete("unlock");
    url.searchParams.delete("sync");
    url.searchParams.delete("k");
    hashParams.delete("code");
    hashParams.delete("unlock");
    hashParams.delete("sync");
    hashParams.delete("k");
    const nextHash = hashParams.toString();
    url.hash = nextHash ? `#${nextHash}` : "";
    window.history.replaceState(
      {},
      document.title,
      url.pathname + (url.search || "") + (url.hash || ""),
    );

    void applyPairing(pairing);
    return true;
  }

  /**
   * Pair using a pasted link or typed pass code.
   */
  async function pairWithLink(text) {
    const pairing = parsePairingLink(text);
    if (!pairing || !pairing.code) return { ok: false };
    const ok = await applyPairing(pairing);
    return { ok };
  }

  function pairWithPhrase(phrase) {
    return setPrivatePhrase(phrase);
  }

  async function enableSync() {
    refreshStoreState();
    await connect();
  }

  function disableSync() {
    disconnect();
    if (listsUnsubscribe) {
      listsUnsubscribe();
      listsUnsubscribe = null;
    }
    clearStoredSupporterCode();
    if (browser) {
      localStorage.removeItem(STORAGE_KEYS.SYNC_PRIVATE_PHRASE);
    }
    refreshStoreState();
    toast("Sync off on this device");
  }

  return {
    subscribe,
    connect,
    disconnect,
    enableSync,
    activatePassport: enableSync,
    disableSync,
    handleIncomingUrl,
    pairWithLink,
    pairWithPhrase,
    setPrivatePhrase,
    syncNow: () => pushLocalEnvelope(),
    init: () => {
      if (!browser) return;
      refreshStoreState();

      handleIncomingUrl();
      window.addEventListener("hashchange", () => handleIncomingUrl());

      if (contributorUnsubscribe) contributorUnsubscribe();
      contributorUnsubscribe = isContributor.subscribe((unlocked) => {
        if (unlocked) {
          void connect();
        } else {
          disconnect();
        }
      });
    },
  };
}

export const deviceSyncStore = createDeviceSyncStore();
