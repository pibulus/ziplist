import { browser } from "$app/environment";
import { STORAGE_KEYS } from "$lib/constants";

function getStorage(storage) {
  if (storage) return storage;
  if (!browser) return null;
  return localStorage;
}

export function normalizeStoredSupporterCode(code) {
  return code?.toString().trim().toUpperCase() || "";
}

export function clearStoredSupporterCode(storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return;
  try {
    targetStorage.removeItem(STORAGE_KEYS.SUPPORTER_PASSPORT_CODE);
  } catch (error) {
    console.warn("Failed to clear supporter passport code:", error);
  }
}

export function readStoredSupporterCode(storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return "";
  try {
    return normalizeStoredSupporterCode(
      targetStorage.getItem(STORAGE_KEYS.SUPPORTER_PASSPORT_CODE) ||
        targetStorage.getItem(STORAGE_KEYS.CONTRIBUTOR_TOKEN) ||
        "",
    );
  } catch {
    return "";
  }
}

export function saveStoredSupporterCode(code, storage) {
  const targetStorage = getStorage(storage);
  const normalizedCode = normalizeStoredSupporterCode(code);
  if (!normalizedCode) {
    throw new Error("Supporter passport code is missing");
  }

  if (targetStorage) {
    try {
      targetStorage.setItem(
        STORAGE_KEYS.SUPPORTER_PASSPORT_CODE,
        normalizedCode,
      );
    } catch (error) {
      console.warn("Failed to save supporter passport code:", error);
    }
  }
  return normalizedCode;
}

/**
 * Generate a deterministic hash from the supporter code (used as the passport / identity seed)
 */
export async function getVaultHash(code) {
  const normalized = normalizeStoredSupporterCode(code);
  if (!normalized) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(`ziplist-vault-id:${normalized}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
