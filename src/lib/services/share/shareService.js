/**
 * ShareService - Functions for encoding and sharing lists
 * Handles list data encoding/decoding for sharing between users
 */

/**
 * Encode a list into a format suitable for sharing
 * @param {Object} list - The list to encode
 * @return {string} Base64 encoded list data
 */
export function encodeListForSharing(list) {
  // Strip unnecessary metadata and keep only essential data
  const essentialData = {
    name: list.name,
    items: list.items.map((item) => ({
      text: item.text,
      checked: item.checked,
    })),
  };

  // Compress and encode
  return btoa(JSON.stringify(essentialData));
}

/**
 * Decode a shared list from its encoded format
 * @param {string} encodedData - Base64 encoded list data
 * @return {Object|null} The decoded list or null if decoding failed
 */
export function decodeSharedList(encodedData) {
  try {
    const listData = JSON.parse(atob(encodedData));

    // Generate new IDs for the list and items
    const newList = {
      id: `list_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: listData.name,
      items: listData.items.map((item, index) => ({
        id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}_${index}`,
        text: item.text,
        checked: item.checked,
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
  const urlTooLong = shareUrl.length > 1500;

  // Try Web Share API first (better mobile UX)
  if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    try {
      await navigator.share({
        title: `${list.name} - ZipList`,
        text: `Check out my list: ${list.name}`,
        url: shareUrl,
      });
      return { success: true, urlTooLong };
    } catch (e) {
      // User cancelled share dialog or API not available
      // Fall back to clipboard
      if (e.name === "AbortError") {
        // User cancelled, don't show error
        return { success: false, urlTooLong: false };
      }
      console.log("Web Share API failed, falling back to clipboard", e);
    }
  }

  // Fallback: Copy to clipboard
  try {
    await navigator.clipboard.writeText(shareUrl);
    return { success: true, urlTooLong };
  } catch (e) {
    console.error("Failed to copy to clipboard", e);
    return { success: false, urlTooLong: false };
  }
}
