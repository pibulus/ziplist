// scripts/check-bundle-roundtrip.mjs
import assert from "node:assert/strict";
import { generateRandomSyncKey } from "../src/lib/services/realtime/syncCrypto.js";
import { mergeCollections } from "../src/lib/services/lists/listMergeService.js";
import {
  encryptSyncEnvelope,
  decryptSyncEnvelope,
} from "../src/lib/services/realtime/syncCrypto.js";

async function run() {
  console.log(
    "Testing full collection bundle export, encryption, decryption, and merge...",
  );

  const key = generateRandomSyncKey();

  const now = Date.now();
  const deviceABundle = {
    version: 1,
    schema: "ziplist_collection_bundle",
    exportedAt: now - 3600000,
    lists: [
      {
        id: "list-groceries",
        name: "Groceries",
        color: "#c8b6ff",
        items: [
          {
            id: "item-1",
            text: "Oat milk",
            checked: false,
            updatedAt: now - 3000000,
          },
          {
            id: "item-2",
            text: "Apples",
            checked: true,
            completedAt: new Date(now - 3000000).toISOString(),
            updatedAt: now - 3000000,
          },
        ],
        deletedItemIds: {},
        updatedAt: new Date(now - 3000000).toISOString(),
      },
    ],
    deletedListIds: {},
  };

  // Encrypt envelope
  const envelope = await encryptSyncEnvelope(deviceABundle, key);
  assert.equal(envelope.v, 1);
  assert(envelope.iv);
  assert(envelope.ct);

  // Decrypt envelope on Device B
  const decryptedBundle = await decryptSyncEnvelope(envelope, key);
  assert.equal(decryptedBundle.schema, "ziplist_collection_bundle");
  assert.equal(decryptedBundle.lists.length, 1);
  assert.equal(decryptedBundle.lists[0].items[0].text, "Oat milk");

  // Device B has a local edit: Oat milk -> Barista Oat Milk (newer), plus added Bananas
  const deviceBLists = [
    {
      id: "list-groceries",
      name: "Groceries & Snacks", // Device B renamed list
      color: "#c8b6ff",
      items: [
        {
          id: "item-1",
          text: "Barista Oat Milk",
          checked: false,
          updatedAt: now - 1000000,
        },
        {
          id: "item-3",
          text: "Bananas",
          checked: false,
          updatedAt: now - 2000000,
        },
      ],
      deletedItemIds: { "item-2": now - 500000 }, // Device B cleared Apples 500s ago
      updatedAt: new Date(now - 500000).toISOString(),
    },
  ];

  const merged = mergeCollections({
    localLists: deviceBLists,
    incomingLists: decryptedBundle.lists,
    localDeletedListIds: {},
    incomingDeletedListIds: decryptedBundle.deletedListIds,
  });

  assert.equal(merged.lists.length, 1);
  const mergedGroceries = merged.lists[0];
  assert.equal(mergedGroceries.name, "Groceries & Snacks"); // newer name kept
  assert.equal(mergedGroceries.items.length, 2); // Barista Oat Milk and Bananas
  assert.equal(mergedGroceries.items[0].text, "Barista Oat Milk"); // LWW text edit won
  assert.equal(mergedGroceries.items[1].text, "Bananas");
  // Item 2 (Apples) is deleted because Device B had tombstone at now - 500000 > Device A updatedAt now - 3000000
  assert(!mergedGroceries.items.some((i) => i.id === "item-2"));
  assert.equal(mergedGroceries.deletedItemIds["item-2"], now - 500000);

  console.log(
    "✅ Collection bundle export, AES-GCM envelope, and two-way merge PASSED perfectly!",
  );
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
