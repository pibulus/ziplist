import { browser } from "$app/environment";

/**
 * Safely copy text to clipboard with modern Clipboard API and fallback to execCommand.
 * Handles in-app browsers (Instagram, Messenger) and non-secure/permission-denied contexts.
 *
 * @param {string} text - The text to copy
 * @returns {Promise<boolean>} True if copy succeeded, false otherwise
 */
export async function copyTextToClipboard(text) {
  if (!text || !browser) return false;

  // 1. Try modern navigator.clipboard API first
  if (
    typeof navigator !== "undefined" &&
    navigator?.clipboard?.writeText &&
    (typeof window !== "undefined" ? window.isSecureContext : true)
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (clipErr) {
      console.warn(
        "[clipboard] writeText rejected, falling back to execCommand:",
        clipErr,
      );
    }
  }

  // 2. Fallback to execCommand (works in in-app webviews and legacy contexts)
  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "-9999px";
      textArea.setAttribute("readonly", "");
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (success) return true;
    } catch (execErr) {
      console.warn("[clipboard] execCommand fallback failed:", execErr);
    }
  }

  return false;
}
