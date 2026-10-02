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

console.log("✅ All syncCrypto tests passed successfully!");
