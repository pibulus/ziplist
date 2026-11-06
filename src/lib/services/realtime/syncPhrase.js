// ═══════════════════════════════════════════════════════════════════════════
// 🔑 syncPhrase — carry a list to another device by typing four words
// ═══════════════════════════════════════════════════════════════════════════
// Re-exports the unified 4,096-word SoftStack Passport bank (4,096^4 = 48 bits)
// while preserving ZipList's legacy room-id derivation (`ziplist:sync:v1:` ->
// `zl_p<32hex>`) so every live link ever shared still resolves to its room.

import {
  WORDS,
  ADJECTIVES,
  NOUNS,
  VERBS,
  PLACES,
  PASSPHRASE_ENTROPY_BITS,
  SYNC_PHRASE_COMBINATIONS,
  generateSyncPhrase,
  normalizeSyncPhrase,
} from "../../softstack-passport/index.js";

export {
  WORDS,
  ADJECTIVES,
  NOUNS,
  VERBS,
  PLACES,
  PASSPHRASE_ENTROPY_BITS,
  SYNC_PHRASE_COMBINATIONS,
  generateSyncPhrase,
  normalizeSyncPhrase,
};

export const SYNC_ROOM_PREFIX = "zl_p";

/** A phrase-derived room id: the prefix plus 32 lowercase hex characters. */
export const SYNC_ROOM_PATTERN = /^zl_p[0-9a-f]{32}$/;

/** Does this look like a 4-word phrase we could derive a room from? */
export function isValidSyncPhrase(value) {
  const words = normalizeSyncPhrase(value).split("-").filter(Boolean);
  return words.length === 4;
}

/**
 * Deterministic phrase -> room id. Same words on any device, same room.
 * SHA-256 truncated to 128 bits: every phrase minted under the old 40/40/32/32
 * or 128^4 banks still lands in the exact same room.
 */
export async function deriveRoomIdFromPhrase(value) {
  const normalized = normalizeSyncPhrase(value);
  if (!isValidSyncPhrase(normalized)) return "";

  const bytes = new TextEncoder().encode(`ziplist:sync:v1:${normalized}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${SYNC_ROOM_PREFIX}${hex.slice(0, 32)}`;
}
