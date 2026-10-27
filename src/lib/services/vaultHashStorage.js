import { browser } from "$app/environment";
import { STORAGE_KEYS } from "$lib/constants.js";

function getStorage(storage) {
  if (storage) return storage;
  if (!browser) return null;
  return localStorage;
}

export function normalizeStoredSupporterCode(code) {
  const clean = code?.toString().trim().toUpperCase() || "";
  const compact = clean.replace(/^ZL[-_\s]?/, "").replace(/[-_\s]/g, "");
  return /^[A-F0-9]{12}$/.test(compact)
    ? `ZL-${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8)}`
    : clean;
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

export function isPersonalPassportCode(code) {
  const clean = code?.toString().trim().toUpperCase() || "";
  const compact = clean.replace(/^ZL[-_\s]?/, "").replace(/[-_\s]/g, "");
  return clean.startsWith("ZL-") || /^[A-F0-9]{12}$/.test(compact);
}

export function readStoredRecoveryCodes(storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return [];
  try {
    const raw = targetStorage.getItem(STORAGE_KEYS.RECOVERY_PASSPORT_CODES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const active = readStoredSupporterCode(targetStorage);
    const seen = new Set();
    const result = [];
    for (const item of list) {
      const norm = normalizeStoredSupporterCode(item);
      if (norm && norm !== active && !seen.has(norm)) {
        seen.add(norm);
        result.push(norm);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function saveStoredRecoveryCodes(codes, storage) {
  if (!Array.isArray(codes)) return [];
  const targetStorage = getStorage(storage);
  const active = readStoredSupporterCode(targetStorage);
  const seen = new Set();
  const result = [];
  for (const item of codes) {
    const norm = normalizeStoredSupporterCode(item);
    if (norm && norm !== active && !seen.has(norm)) {
      seen.add(norm);
      result.push(norm);
    }
  }
  if (targetStorage) {
    try {
      targetStorage.setItem(
        STORAGE_KEYS.RECOVERY_PASSPORT_CODES,
        JSON.stringify(result),
      );
    } catch (error) {
      console.warn("Failed to save recovery passport codes:", error);
    }
  }
  return result;
}

export function addStoredRecoveryCode(code, storage) {
  const norm = normalizeStoredSupporterCode(code);
  if (!norm || !isPersonalPassportCode(norm))
    return readStoredRecoveryCodes(storage);
  const existing = readStoredRecoveryCodes(storage);
  if (!existing.includes(norm)) {
    return saveStoredRecoveryCodes([norm, ...existing], storage);
  }
  return existing;
}

export function clearStoredRecoveryCodes(storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return;
  try {
    targetStorage.removeItem(STORAGE_KEYS.RECOVERY_PASSPORT_CODES);
  } catch {
    // Ignore blocked storage
  }
}

export function saveStoredSupporterCode(code, storage) {
  const targetStorage = getStorage(storage);
  const normalizedCode = normalizeStoredSupporterCode(code);
  if (!normalizedCode) {
    throw new Error("Supporter passport code is missing");
  }

  const previousCode = readStoredSupporterCode(targetStorage);

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

  if (
    previousCode &&
    previousCode !== normalizedCode &&
    isPersonalPassportCode(previousCode)
  ) {
    addStoredRecoveryCode(previousCode, targetStorage);
  }

  // If the newly active code was previously in recovery codes, remove it from recovery
  const recovery = readStoredRecoveryCodes(targetStorage);
  if (recovery.includes(normalizedCode)) {
    saveStoredRecoveryCodes(
      recovery.filter((c) => c !== normalizedCode),
      targetStorage,
    );
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
