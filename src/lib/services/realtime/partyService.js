/**
 * PartyKit Client Service
 *
 * Handles WebSocket connections to PartyKit rooms for live collaboration.
 */

import PartySocket from 'partysocket';
import { getOrCreateAvatar } from './avatarService.js';

/**
 * Get the PartyKit host based on environment
 * @returns {string} PartyKit host URL
 */
function getPartyKitHost() {
  if (typeof window === 'undefined') return '';

  // Check for configured host in environment variable
  const configuredHost = import.meta.env.VITE_PARTYKIT_HOST;
  if (configuredHost) {
    return configuredHost;
  }

  // Development: use localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'localhost:1999';
  }

  // Fallback: construct from current hostname
  // This assumes you deployed PartyKit with the same name as your app
  console.warn('[PartyService] No VITE_PARTYKIT_HOST configured, using fallback');
  return `ziplist.${window.location.hostname.split('.')[0]}.partykit.dev`;
}

/**
 * Create a live list room and get the room ID
 * @param {Object} listData - The list data to store
 * @param {string} [password] - Optional password for the room
 * @returns {Promise<{roomId: string, listId: string}>}
 */
export async function createLiveList(listData, password = null) {
  const host = getPartyKitHost();
  const url = `http${host.includes('localhost') ? '' : 's'}://${host}/party/listRoom?${password ? `pwd=${encodeURIComponent(password)}` : ''}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(listData)
  });

  if (!response.ok) {
    throw new Error(`Failed to create live list: ${response.statusText}`);
  }

  return await response.json();
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
  const host = getPartyKitHost();

  const query = {
    avatar
  };

  if (password) {
    query.pwd = password;
  }

  const socket = new PartySocket({
    host,
    room: roomId,
    query
  });

  // Handle incoming messages
  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'init':
          callbacks.onInit?.(message.data);
          break;

        case 'presence':
          callbacks.onPresence?.(message.data);
          break;

        case 'list_update':
        case 'item_add':
        case 'item_update':
        case 'item_delete':
        case 'item_toggle':
          callbacks.onUpdate?.(message);
          break;

        default:
          console.warn('[PartyService] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[PartyService] Failed to parse message:', error);
    }
  });

  // Handle connection events
  socket.addEventListener('open', () => {
    console.log('[PartyService] Connected to room:', roomId);
    callbacks.onConnect?.();
  });

  socket.addEventListener('close', () => {
    console.log('[PartyService] Disconnected from room:', roomId);
    callbacks.onDisconnect?.();
  });

  socket.addEventListener('error', (error) => {
    console.error('[PartyService] WebSocket error:', error);
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
    console.warn('[PartyService] Cannot send update, socket not open');
    return;
  }

  socket.send(JSON.stringify({
    type,
    data
  }));
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
  if (typeof window === 'undefined') return '';

  const baseUrl = `${window.location.origin}/live/${roomId}`;
  return password ? `${baseUrl}?pwd=${encodeURIComponent(password)}` : baseUrl;
}
