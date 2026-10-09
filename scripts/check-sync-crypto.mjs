import assert from "node:assert/strict";
import {
  generateRandomSyncKey,
  encryptSyncEnvelope,
  decryptSyncEnvelope,
  bufferToBase64Url,
  base64UrlToBuffer,
} from "../src/lib/services/realtime/syncCrypto.js";

console.log("▶ Testing syncCrypto Web Crypto implementation...");

// Test 1: Base64Url round-trip
{
  const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
  const encoded = bufferToBase64Url(original);
  assert.ok(!encoded.includes("+"), "Must not contain +");
  assert.ok(!encoded.includes("/"), "Must not contain /");
  assert.ok(!encoded.includes("="), "Must not contain =");
  const decoded = base64UrlToBuffer(encoded);
  assert.deepEqual(decoded, original, "Decoded buffer must match original");
  console.log("  ✓ Base64Url encoding round-trip");
}

// Test 2: Raw 256-bit Random Key Encryption & Decryption
{
  const key = generateRandomSyncKey();
  assert.equal(key.length, 43, "32-byte key base64url length is 43 characters");

  const testData = {
    lists: [
      {
        id: "l1",
        name: "Groceries",
        items: [{ id: "i1", text: "Oat Milk 🥛", checked: false }],
      },
      {
        id: "l2",
        name: "Chunky Vibes",
        items: [{ id: "i2", text: "Synthesizer 🎹", checked: true }],
      },
    ],
    timestamp: 1727856000000,
  };

  const envelope = await encryptSyncEnvelope(testData, key);
  assert.equal(envelope.v, 1);
  assert.ok(typeof envelope.iv === "string" && envelope.iv.length > 0);
  assert.ok(typeof envelope.ct === "string" && envelope.ct.length > 0);
  assert.equal(envelope.salt, undefined, "Raw key envelope does not need salt");

  const decrypted = await decryptSyncEnvelope(envelope, key);
  assert.deepEqual(
    decrypted,
    testData,
    "Decrypted object must match original object",
  );
  console.log("  ✓ Raw 256-bit AES-GCM-256 round-trip");

  // Wrong key fails
  const wrongKey = generateRandomSyncKey();
  await assert.rejects(
    async () => decryptSyncEnvelope(envelope, wrongKey),
    "Decrypting with wrong key must throw",
  );
  console.log("  ✓ Wrong key rejection");
}

// Test 3: Passphrase + Salt Derivation (Manual fallback entry)
{
  const phrase = "quiet-satchel-sighs-midair";
  const passCode = "ZL-TEST-CODE";

  const testPayload = { message: "Hello sovereign fleet", count: 42 };
  const envelope = await encryptSyncEnvelope(testPayload, phrase, passCode);
  assert.ok(envelope.salt, "Derived envelope must include salt");

  const decrypted = await decryptSyncEnvelope(envelope, phrase, passCode);
  assert.deepEqual(decrypted, testPayload);
  console.log("  ✓ Passphrase + Salt PBKDF2 derivation round-trip");

  // Wrong passphrase fails
  await assert.rejects(
    async () =>
      decryptSyncEnvelope(envelope, "wrong-phrase-goes-here", passCode),
    "Decrypting with wrong passphrase must throw",
  );
  console.log("  ✓ Wrong passphrase rejection");
}

// Test 4: deriveSyncRoom, sealData, and openData (SoftStack sync canon)
{
  const { deriveSyncRoom, sealData, openData } = await import(
    "../src/lib/services/realtime/syncCrypto.js"
  );
  const secret = "ZL-TEST-PASSPORT";
  const { roomId, key } = await deriveSyncRoom(secret, "zl_p");

  assert.ok(roomId.startsWith("zl_p"), "Room ID must have zl_p prefix");
  assert.equal(roomId.length, 4 + 32, "Room ID must be zl_p + 32 hex chars");
  assert.ok(key instanceof CryptoKey, "Key must be a CryptoKey");

  // Derive again: must be deterministic
  const again = await deriveSyncRoom(secret, "zl_p");
  assert.equal(again.roomId, roomId, "Room ID must be deterministic");

  const samplePayload = { lists: [{ id: "l1", name: "Groceries" }] };
  const sealed = await sealData(key, samplePayload);
  assert.ok(sealed.iv && sealed.ct, "Sealed payload must have iv and ct");

  const opened = await openData(again.key, sealed);
  assert.deepEqual(opened, samplePayload, "Opened data must match original payload");

  // Other secret fails
  const other = await deriveSyncRoom("ZL-DIFFERENT-PASSPORT", "zl_p");
  await assert.rejects(
    async () => openData(other.key, sealed),
    "Opening with different secret must throw",
  );
  console.log("  ✓ deriveSyncRoom, sealData, and openData deterministic round-trip");
}

console.log("✅ All syncCrypto tests passed successfully!");
