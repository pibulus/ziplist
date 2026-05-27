/**
 * PartyKit Client Service
 *
 * Handles WebSocket connections to PartyKit rooms for live collaboration.
 */

import PartySocket from "partysocket";
import { getContributorTokenSnapshot } from "$lib";
import { getOrCreateAvatar } from "./avatarService.js";
import { LIVE_MESSAGE_TYPES } from "./liveListProtocol.js";

const PARTYKIT_PLACEHOLDER_HOST = "ziplist.your-username.partykit.dev";

function getConfiguredPartyKitHost() {
  const host = import.meta.env.VITE_PARTYKIT_HOST?.trim();
  if (!host || host === PARTYKIT_PLACEHOLDER_HOST) {
    return "";
  }
  return normalizePartyKitHost(host);
}

function normalizePartyKitHost(host) {
  return host.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function isLocalNetworkHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

/**
 * Get the PartyKit host based on environment
 * @returns {string} PartyKit host URL
 */
function getPartyKitHost() {
  if (typeof window === "undefined") {
    return getConfiguredPartyKitHost();
  }

  // Development: match the current host so LAN devices can reach PartyKit too.
  if (import.meta.env.DEV && isLocalNetworkHost(window.location.hostname)) {
    return `${window.location.hostname}:1999`;
  }

  return getConfiguredPartyKitHost();
}

export function isLiveCollaborationAvailable() {
  return Boolean(getPartyKitHost());
}

function requirePartyKitHost() {
  const host = getPartyKitHost();
  if (!host) {
    throw new Error(
      "Live collaboration is not configured for this deployment yet.",
    );
  }
  return host;
}

/**
 * Create a live list room and get the room ID
 * @param {Object} listData - The list data to store
 * @param {string} [password] - Optional password for the room
 * @returns {Promise<{roomId: string, listId: string}>}
 */
export async function createLiveList(listData, password = null) {
  requirePartyKitHost();

  const token = getContributorTokenSnapshot();
  const response = await fetch("/api/live/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ listData, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.error || `Failed to create live list: ${response.statusText}`,
    );
  }

  return payload;
}

/**
 * Connect to a live list room
 * @param {string} roomId - The room ID to connect to
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onInit - Called when initial list data is received
 * @param {Function} callbacks.onUpdate - Called when list updates are received
 * @param {Function} callbacks.onPresence - Called when presence updates are received
 * @param {Function} callbacks.onConnect - Called when connected
 * @param {Function} callbacks.onDisconnect - Called when disconnected
 * @param {string} [password] - Optional password for password-protected rooms
 * @returns {PartySocket} The PartySocket connection
 */
export function connectToLiveList(roomId, callbacks = {}, password = null) {
  const avatar = getOrCreateAvatar();
  const host = requirePartyKitHost();

  const query = {
    avatar,
  };

  if (password) {
    query.pwd = password;
  }

  const socket = new PartySocket({
    host,
    room: roomId,
    query,
  });

  // Handle incoming messages
  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case LIVE_MESSAGE_TYPES.INIT:
          callbacks.onInit?.(message.data);
          break;

        case LIVE_MESSAGE_TYPES.PRESENCE:
          callbacks.onPresence?.(message.data);
          break;

        case LIVE_MESSAGE_TYPES.LIST_UPDATE:
        case LIVE_MESSAGE_TYPES.TYPING_START:
        case LIVE_MESSAGE_TYPES.TYPING_STOP:
          callbacks.onUpdate?.(message);
          break;

        default:
          console.warn("[PartyService] Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("[PartyService] Failed to parse message:", error);
    }
  });

  // Handle connection events
  socket.addEventListener("open", () => {
    console.log("[PartyService] Connected to room:", roomId);
    callbacks.onConnect?.();
  });

  socket.addEventListener("close", (event) => {
    console.log("[PartyService] Disconnected from room:", roomId);
    callbacks.onDisconnect?.(event);
  });

  socket.addEventListener("error", (error) => {
    console.error("[PartyService] WebSocket error:", error);
    callbacks.onError?.(error);
  });

  return socket;
}

/**
 * Send a list update to the room
 * @param {PartySocket} socket - The PartySocket connection
 * @param {string} type - The message type
 * @param {any} data - The message data
 */
export function sendUpdate(socket, type, data) {
  if (socket.readyState !== PartySocket.OPEN) {
    console.warn("[PartyService] Cannot send update, socket not open");
    return false;
  }

  socket.send(
    JSON.stringify({
      type,
      data,
    }),
  );
  return true;
}

/**
 * Disconnect from a live list room
 * @param {PartySocket} socket - The PartySocket connection
 */
export function disconnectFromLiveList(socket) {
  if (socket) {
    socket.close();
  }
}

/**
 * Generate a shareable URL for a live list
 * @param {string} roomId - The room ID
 * @param {string} [password] - Optional password
 * @returns {string} Shareable URL
 */
export function generateShareUrl(roomId, password = null) {
  if (typeof window === "undefined") return "";

  const baseUrl = `${window.location.origin}/live/${roomId}`;
  return password ? `${baseUrl}?pwd=${encodeURIComponent(password)}` : baseUrl;
}
