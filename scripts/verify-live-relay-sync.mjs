import {
  generateRandomSyncKey,
  encryptSyncEnvelope,
  decryptSyncEnvelope,
} from "../src/lib/services/realtime/syncCrypto.js";
import {
  generateSyncPhrase,
  deriveRoomIdFromPhrase,
} from "../src/lib/services/realtime/syncPhrase.js";
import { mergeCollections } from "../src/lib/services/lists/listMergeService.js";
import { PartySocket } from "partysocket";

const RELAY_HOST = "ziplist-rooms.pibulus.workers.dev";

async function testLiveRelaySync() {
  console.log("--- 🧪 Live Relay Sovereign E2EE Sync Verification ---");

  // 1. Generate pairing credentials
  const phrase = generateSyncPhrase();
  const keyString = generateRandomSyncKey();
  const roomId = await deriveRoomIdFromPhrase(phrase, "zl_sync_");

  console.log(`[Credentials] Phrase: ${phrase}`);
  console.log(`[Credentials] RoomId: ${roomId}`);
  console.log(`[Credentials] Key: ${keyString.slice(0, 16)}...`);

  // 2. Setup Device A local lists
  const now = Date.now();
  const deviceA_initialLists = [
    {
      id: "list-groceries",
      name: "Groceries",
      color: "#ff82ca",
      createdAt: now - 10000,
      updatedAt: now - 10000,
      deletedAt: null,
      items: [
        {
          id: "item-1",
          text: "Oat milk",
          checked: false,
          createdAt: now - 9000,
          updatedAt: now - 9000,
          completedAt: null,
          deletedAt: null,
        },
        {
          id: "item-2",
          text: "Sourdough bread",
          checked: true,
          createdAt: now - 8000,
          updatedAt: now - 8000,
          completedAt: new Date(now - 7000).toISOString(),
          checkedAt: now - 7000,
          deletedAt: null,
        },
      ],
    },
  ];

  // 3. Device A encrypts envelope
  const bundleA = {
    version: 1,
    exportedAt: now,
    lists: deviceA_initialLists,
  };
  const encryptedA = await encryptSyncEnvelope(bundleA, keyString);
  const envelopeA = {
    type: "sync_envelope",
    ...encryptedA,
    updatedAt: now,
  };
  console.log(
    `[Device A] Encrypted payload: ct=${envelopeA.ct.slice(0, 20)}... (length: ${envelopeA.ct.length})`,
  );

  // 4. Connect Device A to deployed Cloudflare worker
  const socketA = new PartySocket({
    host: RELAY_HOST,
    party: "room",
    room: roomId,
  });

  await new Promise((resolve, reject) => {
    socketA.addEventListener("open", resolve, { once: true });
    socketA.addEventListener("error", reject, { once: true });
    setTimeout(
      () => reject(new Error("Timeout connecting Device A to relay")),
      10000,
    );
  });
  console.log("[Device A] Connected to live Cloudflare DO relay!");

  // Send envelope
  socketA.send(JSON.stringify(envelopeA));
  console.log("[Device A] Broadcasted sync envelope to relay.");

  // 5. Connect Device B (late-joining device simulating laptop connecting after phone)
  const socketB = new PartySocket({
    host: RELAY_HOST,
    party: "room",
    room: roomId,
  });

  const receivedEnvelopeOnB = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(new Error("Timeout receiving catch-up envelope on Device B")),
      10000,
    );
    socketB.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "sync_envelope") {
        clearTimeout(timeout);
        resolve(msg);
      }
    });
  });

  console.log(
    "[Device B] Received catch-up envelope from Cloudflare DO SQLite storage!",
  );
  const decryptedBundleB = await decryptSyncEnvelope(
    receivedEnvelopeOnB,
    keyString,
  );
  console.log(
    `[Device B] Successfully decrypted ${decryptedBundleB.lists.length} list(s).`,
  );

  if (decryptedBundleB.lists[0].items.length !== 2) {
    throw new Error(
      `Device B expected 2 items, got ${decryptedBundleB.lists[0].items.length}`,
    );
  }

  // 6. Device B makes local mutations:
  // - Marks 'Oat milk' as checked
  // - Soft deletes 'Sourdough bread' (tombstone)
  // - Adds 'Avocado'
  const mutateTime = Date.now() + 1000;
  const localListsOnB = JSON.parse(JSON.stringify(decryptedBundleB.lists));
  const listB = localListsOnB[0];

  // Oat milk checked
  listB.items[0].checked = true;
  listB.items[0].completedAt = new Date(mutateTime).toISOString();
  listB.items[0].checkedAt = mutateTime;
  listB.items[0].updatedAt = mutateTime;

  // Sourdough bread deleted the way listsStore does it: drop + tombstone
  listB.items = listB.items.filter((i) => i.id !== "item-2");
  listB.deletedItemIds = { "item-2": mutateTime };

  // Add Avocado
  listB.items.push({
    id: "item-3",
    text: "Avocado",
    checked: false,
    createdAt: mutateTime,
    updatedAt: mutateTime,
    completedAt: null,
    deletedAt: null,
  });
  listB.updatedAt = mutateTime;

  // 7. Device B encrypts mutated bundle and broadcasts
  const bundleB = {
    version: 1,
    exportedAt: mutateTime,
    lists: localListsOnB,
  };
  const encryptedB = await encryptSyncEnvelope(bundleB, keyString);
  const envelopeB = {
    type: "sync_envelope",
    ...encryptedB,
    updatedAt: mutateTime,
  };

  // Setup listener on Device A to receive Device B's changes in real-time
  const receivedEnvelopeOnA = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timeout receiving live update on Device A")),
      10000,
    );
    socketA.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "sync_envelope") {
        clearTimeout(timeout);
        resolve(msg);
      }
    });
  });

  socketB.send(JSON.stringify(envelopeB));
  console.log("[Device B] Mutated envelope sent to relay.");

  const incomingOnA = await receivedEnvelopeOnA;
  console.log(
    "[Device A] Received real-time live sync envelope from Device B!",
  );

  const decryptedOnA = await decryptSyncEnvelope(incomingOnA, keyString);
  console.log("[Device A] Decrypted remote bundle successfully.");

  // 8. Device A runs deterministic merge
  const mergedA = mergeCollections({
    localLists: deviceA_initialLists,
    incomingLists: decryptedOnA.lists,
  });
  const mergedListA = mergedA.lists[0];

  console.log("[Device A] Merged results:");
  const activeItems = mergedListA.items;

  console.log(
    `  - Active items (${activeItems.length}): ${activeItems.map((i) => `${i.text} (checked: ${i.checked})`).join(", ")}`,
  );
  console.log(`  - Tombstones: ${JSON.stringify(mergedListA.deletedItemIds)}`);

  // Verify assertions:
  if (activeItems.length !== 2) {
    throw new Error(`Expected 2 active items, got ${activeItems.length}`);
  }
  const oatMilk = activeItems.find((i) => i.id === "item-1");
  if (!oatMilk || !oatMilk.checked) {
    throw new Error("Oat milk should be marked checked");
  }
  const avocado = activeItems.find((i) => i.id === "item-3");
  if (!avocado) {
    throw new Error("Avocado should be present");
  }
  if (activeItems.some((i) => i.id === "item-2")) {
    throw new Error("Sourdough bread resurrected on Device A");
  }
  if (!mergedListA.deletedItemIds?.["item-2"]) {
    throw new Error("Sourdough bread must carry a tombstone");
  }

  // Clean up sockets
  socketA.close();
  socketB.close();

  console.log("✅ LIVE E2EE RELAY SYNC TEST PASSED PERFECTLY!\n");
}

testLiveRelaySync().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
