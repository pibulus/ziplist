// ═══════════════════════════════════════════════════════════════════════════
// 🔑 syncCrypto — Zero-Knowledge Client-Side AES-GCM-256 for Device Sync
// ═══════════════════════════════════════════════════════════════════════════
// Standardized across QRBuddy, TalkType, and ZipList.
// Uses native Web Crypto API (globalThis.crypto.subtle).
// Keys live ONLY in client memory or URL hash fragments (#k=...), never sent
// to servers or logged in access logs.

const PBKDF2_ITERATIONS = 100_000;

export function bufferToBase64Url(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlToBuffer(base64url) {
  if (typeof base64url !== "string") {
    throw new Error("Invalid base64url string");
  }
  const padded = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a cryptographically secure 256-bit random key (base64url encoded).
 * Carried in the URL hash fragment (#k=...) so relays never see it.
 */
export function generateRandomSyncKey() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes);
}

/**
 * Import a 256-bit raw base64url key directly for AES-GCM.
 */
async function importRawKey(base64Key) {
  const rawBytes = base64UrlToBuffer(base64Key);
  if (rawBytes.length !== 32) {
    throw new Error(
      `Invalid sync key length: expected 32 bytes, got ${rawBytes.length}`,
    );
  }
  return globalThis.crypto.subtle.importKey(
    "raw",
    rawBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Derive an AES-GCM 256-bit key from a passphrase and salt using PBKDF2.
 * Used when a user manually enters a 4-word phrase + pass code instead of QR scanning.
 */
async function deriveKeyFromPassphrase(passphrase, saltBytes) {
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase.trim()),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt any JavaScript object or string into an opaque AES-GCM envelope.
 *
 * @param {unknown} data - Plaintext object or string to encrypt
 * @param {string} keyOrPassphrase - 32-byte base64url key, or a passphrase string
 * @param {string} [optionalSalt] - Salt string for passphrase derivation (optional for 32-byte raw keys)
 * @returns {Promise<{ v: number, iv: string, ct: string, salt?: string }>}
 */
export async function encryptSyncEnvelope(
  data,
  keyOrPassphrase,
  optionalSalt = null,
) {
  if (!keyOrPassphrase || typeof keyOrPassphrase !== "string") {
    throw new Error("Missing encryption key or passphrase");
  }

  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  let key;
  let saltBase64 = null;

  // If 43 chars base64url (32 bytes), it's a raw 256-bit key
  let isRawKey = keyOrPassphrase.length === 43 && !optionalSalt;

  if (isRawKey) {
    try {
      key = await importRawKey(keyOrPassphrase);
    } catch {
      // Fall back to derivation if raw import fails
      isRawKey = false;
    }
  }

  if (!isRawKey) {
    const saltBytes = new Uint8Array(16);
    if (optionalSalt) {
      const enc = new TextEncoder().encode(optionalSalt);
      saltBytes.set(enc.slice(0, 16));
    } else {
      globalThis.crypto.getRandomValues(saltBytes);
    }
    saltBase64 = bufferToBase64Url(saltBytes);
    key = await deriveKeyFromPassphrase(keyOrPassphrase, saltBytes);
  }

  const plaintext = typeof data === "string" ? data : JSON.stringify(data);
  const encoded = new TextEncoder().encode(plaintext);

  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  const envelope = {
    v: 1,
    iv: bufferToBase64Url(iv),
    ct: bufferToBase64Url(encryptedBuffer),
  };

  if (saltBase64) {
    envelope.salt = saltBase64;
  }

  return envelope;
}

/**
 * Decrypt an opaque AES-GCM envelope back into the original data.
 *
 * @param {{ v?: number, iv: string, ct: string, salt?: string }} envelope
 * @param {string} keyOrPassphrase
 * @param {string} [optionalSalt]
 * @returns {Promise<any>}
 */
export async function decryptSyncEnvelope(
  envelope,
  keyOrPassphrase,
  optionalSalt = null,
) {
  if (!envelope || !envelope.iv || !envelope.ct) {
    throw new Error("Invalid sync envelope format");
  }
  if (!keyOrPassphrase || typeof keyOrPassphrase !== "string") {
    throw new Error("Missing decryption key or passphrase");
  }

  const iv = base64UrlToBuffer(envelope.iv);
  const ciphertext = base64UrlToBuffer(envelope.ct);

  let key;
  let isRawKey =
    keyOrPassphrase.length === 43 && !envelope.salt && !optionalSalt;

  if (isRawKey) {
    try {
      key = await importRawKey(keyOrPassphrase);
    } catch {
      isRawKey = false;
    }
  }

  if (!isRawKey) {
    const saltBytes = envelope.salt
      ? base64UrlToBuffer(envelope.salt)
      : optionalSalt
        ? new TextEncoder().encode(optionalSalt).slice(0, 16)
        : new Uint8Array(16);
    key = await deriveKeyFromPassphrase(keyOrPassphrase, saltBytes);
  }

  const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  const decodedText = new TextDecoder().decode(decryptedBuffer);
  try {
    return JSON.parse(decodedText);
  } catch {
    return decodedText;
  }
}
