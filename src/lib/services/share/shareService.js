/**
 * ShareService - Functions for encoding and sharing lists
 * Handles list data encoding/decoding for sharing between users
 */
import { PRODUCT_LIMITS } from "$lib/constants";
import { normalizeTags } from "$lib/services/lists/itemTags";
import { copyTextToClipboard } from "$lib/services/infrastructure/clipboard.js";

/**
 * Encode a list into a compact v2 tuple format suitable for sharing & QR codes.
 * Format: `{ v: 2, n: list.name, i: [[text, checked?1:0, tags?], ...] }`
 * Cuts ~70% of per-item JSON boilerplate compared to `{ text, checked: false }`
 * so 30–80 item lists fit cleanly inside a single scannable QR code.
 * @param {Object} list - The list to encode
 * @return {string} Base64url encoded list data
 */
export function encodeListForSharing(list) {
  const compactPayload = {
    v: 2,
    n: list.name || "",
    i: (list.items || []).map((item) => {
      if (item.tags?.length) {
        return [item.text, item.checked ? 1 : 0, item.tags];
      }
      return item.checked ? [item.text, 1] : [item.text];
    }),
  };

  return toBase64Url(JSON.stringify(compactPayload));
}

/* Share links are base64url over UTF-8 bytes. Two real bugs lived in the
   plain `btoa(JSON.stringify(...))` this replaced:

   1. btoa throws on any code point above Latin1. A curly apostrophe, an em
      dash, an arrow, an emoji — anything a speech model routinely produces —
      and the whole share threw InvalidCharacterError, taking the QR button,
      the copy link and the share sheet down with it. Encoding UTF-8 bytes
      first is the fix; btoa only ever sees 0-255.
   2. The payload rides in a hash read by URLSearchParams, which decodes "+"
      as a space — so any payload whose base64 happened to contain "+" was
      silently corrupted on import. base64url has no "+" or "/" at all. */
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(encoded) {
  // Old links used the standard alphabet, so "-"/"_" are absent from them and
  // this is a no-op there. A space can only be a "+" that URLSearchParams ate,
  // so putting it back repairs links that shipped before base64url.
  let normalized = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/ /g, "+");
  while (normalized.length % 4) normalized += "=";

  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Pre-UTF-8 link carrying a raw Latin1 byte (é as 0xE9). Invalid UTF-8,
    // so decode it the way it was written rather than serving U+FFFD.
    return binary;
  }
}

/**
 * Decode a shared list from its encoded format
 * @param {string} encodedData - Base64 encoded list data
 * @return {Object|null} The decoded list or null if decoding failed
 */
export function decodeSharedList(encodedData) {
  try {
    const listData = JSON.parse(fromBase64Url(encodedData));

    // Validate structure (supports both v2 compact tuples `{ v: 2, n, i }`
    // and legacy `{ name, items }` payloads so older links always open).
    if (!listData || typeof listData !== "object") return null;

    const rawName =
      typeof listData.n === "string"
        ? listData.n
        : typeof listData.name === "string"
          ? listData.name
          : "Imported List";
    const name =
      rawName.slice(0, PRODUCT_LIMITS.MAX_IMPORT_NAME_LENGTH) ||
      "Imported List";

    const rawItems = Array.isArray(listData.i)
      ? listData.i.map((entry) =>
          Array.isArray(entry)
            ? {
                text: entry[0],
                checked: Boolean(entry[1]),
                tags: entry[2],
              }
            : entry,
        )
      : Array.isArray(listData.items)
        ? listData.items
        : null;

    if (!rawItems) return null;

    // Cap item count and validate each item
    const validItems = rawItems
      .slice(0, PRODUCT_LIMITS.MAX_IMPORT_ITEMS)
      .filter(
        (item) =>
          item && typeof item.text === "string" && item.text.trim().length > 0,
      );

    if (validItems.length === 0) return null;

    const newList = {
      id: crypto.randomUUID(),
      name,
      items: validItems.map((item, index) => ({
        id: crypto.randomUUID(),
        text: item.text.trim().slice(0, PRODUCT_LIMITS.MAX_ITEM_TEXT_LENGTH),
        checked: !!item.checked,
        tags: normalizeTags(item.tags),
        completedAt: item.checked ? new Date().toISOString() : null,
        order: index,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return newList;
  } catch (e) {
    console.error("Failed to decode shared list", e);
    return null;
  }
}

/**
 * Generate a shareable URL for a list
 * @param {Object} list - The list to share
 * @param {string} baseUrl - The base URL of the application
 * @return {string} A URL that can be shared
 */
export function generateShareableUrl(list, baseUrl = window.location.origin) {
  const encodedList = encodeListForSharing(list);
  return `${baseUrl}/import#listdata=${encodedList}`;
}

/**
 * Extract encoded list data from a URL
 * @param {string} url - The URL containing encoded list data
 * @return {string|null} Encoded list data or null if not found
 */
export function extractListDataFromUrl(url) {
  try {
    // Parse the URL and extract the hash fragment
    const urlObj = new URL(url);
    const hashParams = new URLSearchParams(urlObj.hash.substring(1));

    // Get the listdata parameter
    return hashParams.get("listdata");
  } catch (e) {
    console.error("Failed to extract list data from URL", e);
    return null;
  }
}

/**
 * Share a list using Web Share API (mobile) or clipboard (desktop)
 * @param {Object} list - The list to share
 * @param {string} baseUrl - The base URL of the application
 * @return {Promise<{success: boolean, urlTooLong?: boolean}>} Result with success status and optional warning
 */
export async function shareList(list, baseUrl = window.location.origin) {
  // Generate shareable URL
  const shareUrl = generateShareableUrl(list, baseUrl);

  // Check URL length (warn if > 1500 characters, most browsers support 2000+)
  const urlTooLong = shareUrl.length > PRODUCT_LIMITS.SHARE_URL_WARNING_LENGTH;

  // Try Web Share API first (URL-only so iOS "Copy" copies a clean URL)
  if (
    navigator.share &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  ) {
    try {
      await navigator.share({
        title: `${list.name} - ZipList`,
        url: shareUrl,
      });
      return { success: true, urlTooLong };
    } catch (e) {
      if (e.name === "AbortError") {
        return { success: false, urlTooLong: false };
      }
    }
  }

  // Fallback: Copy to clipboard (with execCommand fallback)
  const copied = await copyTextToClipboard(shareUrl);
  return { success: copied, urlTooLong: copied ? urlTooLong : false };
}
