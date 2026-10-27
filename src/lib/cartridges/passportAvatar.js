/**
 * Passport avatar — deterministic cute avatar from the vault hash.
 *
 * Uses DiceBear (offline SVG, no network → no CSP concerns). Each contributor
 * gets a unique face seeded from their hash, themed to their palette's avatar
 * style. Renders to a data-URI so it drops straight into an <img src>.
 */

import { createAvatar } from "@dicebear/core";
import { funEmoji, thumbs, adventurer, bottts } from "@dicebear/collection";

const COLLECTIONS = { funEmoji, thumbs, adventurer, bottts };

/**
 * Build a DiceBear avatar data-URI.
 * @param {string} seed - stable seed (vault hash or member id)
 * @param {string} style - collection key from the palette (funEmoji|thumbs|adventurer|bottts)
 * @returns {string} data:image/svg+xml URI, or '' if generation fails
 */
export function buildPassportAvatar(seed, style = "funEmoji") {
  const collection = COLLECTIONS[style] || funEmoji;
  try {
    return createAvatar(collection, {
      seed: seed || "ziplist",
      radius: 50,
      scale: 92,
      backgroundType: ["solid"],
      backgroundColor: ["transparent"],
    }).toDataUri();
  } catch (error) {
    console.warn("Passport avatar generation failed:", error);
    return "";
  }
}

export const CUSTOM_AVATAR_STORAGE_KEY = "ziplist_passport_custom_avatar_v1";
const MAX_STORED_DATA_URI_LENGTH = 120_000;

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof window !== "undefined" && window.localStorage)
    return window.localStorage;
  return null;
}

export function isValidAvatarDataUri(value) {
  return (
    typeof value === "string" &&
    /^data:image\/(webp|jpeg|png|gif);base64,[a-z0-9+/=\s]+$/i.test(
      value.trim(),
    ) &&
    value.length <= MAX_STORED_DATA_URI_LENGTH
  );
}

export function readCustomPassportAvatar(storage) {
  const target = resolveStorage(storage);
  if (!target) return "";
  try {
    const raw = target.getItem(CUSTOM_AVATAR_STORAGE_KEY) || "";
    return isValidAvatarDataUri(raw) ? raw.trim() : "";
  } catch {
    return "";
  }
}

export function saveCustomPassportAvatar(dataUri, storage) {
  const target = resolveStorage(storage);
  if (!target) return "";
  const clean = typeof dataUri === "string" ? dataUri.trim() : "";
  if (!clean) {
    clearCustomPassportAvatar(target);
    return "";
  }
  if (!isValidAvatarDataUri(clean)) {
    throw new Error("Invalid custom avatar image");
  }
  try {
    target.setItem(CUSTOM_AVATAR_STORAGE_KEY, clean);
    return clean;
  } catch (error) {
    console.warn("Failed to store custom passport avatar:", error);
    return "";
  }
}

export function clearCustomPassportAvatar(storage) {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(CUSTOM_AVATAR_STORAGE_KEY);
  } catch {
    // Ignore blocked storage
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image file"));
    };
    img.src = url;
  });
}

/**
 * Center-crops an image File/Blob to a square (default 128x128) and encodes
 * as a compact WebP (or JPEG fallback) data URI for zero-backend storage.
 */
export async function compressAvatarImageFile(file, size = 128) {
  if (
    !file ||
    typeof file.type !== "string" ||
    !file.type.startsWith("image/")
  ) {
    throw new Error("Choose an image file");
  }

  const img = await loadImageElement(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) {
    throw new Error("Image has no dimensions");
  }

  const side = Math.min(width, height);
  const sx = Math.floor((width - side) / 2);
  const sy = Math.floor((height - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }

  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  const webp = canvas.toDataURL("image/webp", 0.85);
  if (webp.startsWith("data:image/webp")) {
    return webp;
  }
  return canvas.toDataURL("image/jpeg", 0.85);
}
