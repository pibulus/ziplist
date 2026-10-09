// ═══════════════════════════════════════════════════════════════════════════
// 🔑 syncCrypto — Zero-Knowledge Client-Side AES-GCM-256 for Device Sync
// ═══════════════════════════════════════════════════════════════════════════
// Standardized across TalkType and ZipList (SoftStack Sync).
// Uses native Web Crypto API (globalThis.crypto.subtle).
//
// The room is derived from a secret both devices already hold — the supporter /
// contributor code, plus a private phrase when someone sets one.
//
// One PBKDF2 run turns that secret into a seed, and HKDF splits the seed into
// the room id and the AES key under different labels. The relay sees only the
// room id, and walking back from it to the code costs a full PBKDF2 per guess:
// the same price as guessing the key itself.

const SEED_SALT = "softstack:sync:v2";
const ROOM_LABEL = "softstack:sync:room:v2";
const KEY_LABEL = "softstack:sync:key:v2";
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

export function toBase64Url(bytes) {
  return bufferToBase64Url(bytes);
}

export function fromBase64Url(value) {
  return base64UrlToBuffer(value);
}

/**
 * Generate a cryptographically secure 256-bit random key (base64url encoded).
 */
export function generateRandomSyncKey() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes);
}

/**
 * Derive the room id and its AES key from the room's secret.
 * @param {string} secret - pass code or secret string
 * @param {string} [prefix] - keeps apps sharing a relay out of each other's rooms (default 'zl_p')
 * @returns {Promise<{ roomId: string, key: CryptoKey }>}
 */
export async function deriveSyncRoom(secret, prefix = "zl_p") {
  const subtle = globalThis.crypto.subtle;
  const encoder = new TextEncoder();
  const material = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const seed = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(`${SEED_SALT}:${prefix}`),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    256,
  );
  const hkdf = await subtle.importKey("raw", seed, "HKDF", false, [
    "deriveBits",
    "deriveKey",
  ]);
  const expand = (label) => ({
    name: "HKDF",
    hash: "SHA-256",
    salt: new Uint8Array(0),
    info: encoder.encode(label),
  });
  const [roomBits, key] = await Promise.all([
    subtle.deriveBits(expand(ROOM_LABEL), hkdf, 128),
    subtle.deriveKey(
      expand(KEY_LABEL),
      hkdf,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
  ]);
  const hex = Array.from(new Uint8Array(roomBits), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return { roomId: `${prefix}${hex}`, key };
}

/**
 * Seal arbitrary data under a CryptoKey or raw key using AES-GCM-256.
 * @returns {Promise<{ iv: string, ct: string }>}
 */
export async function sealData(key, data) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const cryptoKey = typeof key === "string" ? await importRawKey(key) : key;
  const ct = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    plaintext,
  );
  return {
    iv: bufferToBase64Url(iv),
    ct: bufferToBase64Url(new Uint8Array(ct)),
  };
}

/**
 * Open sealed data under a CryptoKey or raw key.
 */
export async function openData(key, { iv, ct }) {
  const cryptoKey = typeof key === "string" ? await importRawKey(key) : key;
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBuffer(iv) },
    cryptoKey,
    base64UrlToBuffer(ct),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
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
 * @param {string | CryptoKey} keyOrPassphrase - 32-byte base64url key, CryptoKey, or a passphrase string
 * @param {string} [optionalSalt] - Salt string for passphrase derivation (optional for 32-byte raw keys)
 * @returns {Promise<{ v: number, iv: string, ct: string, salt?: string }>}
 */
export async function encryptSyncEnvelope(
  data,
  keyOrPassphrase,
  optionalSalt = null,
) {
  if (!keyOrPassphrase) {
    throw new Error("Missing encryption key or passphrase");
  }

  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  let key;
  let saltBase64 = null;

  if (typeof keyOrPassphrase === "object" && keyOrPassphrase !== null) {
    // Already a CryptoKey instance
    key = keyOrPassphrase;
  } else if (typeof keyOrPassphrase === "string") {
    // If 43 chars base64url (32 bytes), it's a raw 256-bit key
    let isRawKey = keyOrPassphrase.length === 43 && !optionalSalt;

    if (isRawKey) {
      try {
        key = await importRawKey(keyOrPassphrase);
      } catch {
        isRawKey = false;
      }
    }

    if (!isRawKey) {
      const saltBytes = new Uint8Array(16);
      if (optionalSalt) {
        if (typeof optionalSalt === "string") {
          const enc = new TextEncoder().encode(optionalSalt);
          if (enc.length >= 16) {
            saltBytes.set(enc.slice(0, 16));
          } else {
            const hash = await globalThis.crypto.subtle.digest("SHA-256", enc);
            saltBytes.set(new Uint8Array(hash).slice(0, 16));
          }
        } else if (optionalSalt instanceof Uint8Array) {
          saltBytes.set(optionalSalt.slice(0, 16));
        }
      } else {
        globalThis.crypto.getRandomValues(saltBytes);
      }
      saltBase64 = bufferToBase64Url(saltBytes);
      key = await deriveKeyFromPassphrase(keyOrPassphrase, saltBytes);
    }
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
 * @param {string | CryptoKey} keyOrPassphrase
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
  if (!keyOrPassphrase) {
    throw new Error("Missing decryption key or passphrase");
  }

  const iv = base64UrlToBuffer(envelope.iv);
  const ciphertext = base64UrlToBuffer(envelope.ct);

  let key;

  if (typeof keyOrPassphrase === "object" && keyOrPassphrase !== null) {
    key = keyOrPassphrase;
  } else if (typeof keyOrPassphrase === "string") {
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
