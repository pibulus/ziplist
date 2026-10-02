import assert from "node:assert/strict";
import {
  mergeCollections,
  mergeSingleItem,
  mergeTombstones,
  stampItemChanges,
} from "../src/lib/services/lists/listMergeService.js";

console.log("▶ Testing listMergeService LWW-Element-Set merge engine...");

// Test 1: Non-conflicting additions on two devices
{
  const deviceA = {
    localLists: [
      {
        id: "l1",
        name: "Groceries",
        updatedAt: 1000,
        items: [
          { id: "i1", text: "Oat Milk", checked: false, updatedAt: 1000 },
        ],
      },
    ],
  };

  const deviceB = {
    incomingLists: [
      {
        id: "l1",
        name: "Groceries",
        updatedAt: 1100,
        items: [{ id: "i2", text: "Apples", checked: false, updatedAt: 1100 }],
      },
    ],
  };

  const result = mergeCollections({ ...deviceA, ...deviceB });
  assert.equal(result.lists.length, 1);
  const items = result.lists[0].items;
  assert.equal(items.length, 2, "Both items must be merged into the list");
  assert.ok(items.some((i) => i.id === "i1" && i.text === "Oat Milk"));
  assert.ok(items.some((i) => i.id === "i2" && i.text === "Apples"));
  console.log("  ✓ Non-conflicting item additions merged cleanly");
}

// Test 2: Field-level LWW (Independent text edit vs checked status)
{
  // Device B checks item off at t=2100 while keeping old text
  const itemB = {
    id: "i1",
    text: "Oat Milk",
    checked: true,
    completedAt: new Date(2100).toISOString(),
    updatedAt: 2100,
  };

  // Test when text was edited at 2500 and checked at 2100:
  const itemAEditedLater = {
    id: "i1",
    text: "Oat Milk (Barista Edition)",
    checked: false,
    completedAt: null,
    updatedAt: 2500,
  };
  const merged2 = mergeSingleItem(itemAEditedLater, itemB);
  assert.equal(
    merged2.text,
    "Oat Milk (Barista Edition)",
    "Newer text edit must win",
  );
  assert.equal(merged2.checked, true, "Checked status must be preserved");
  console.log(
    "  ✓ Field-level LWW preserves checkmark without wiping text edit",
  );
}

// Test 3: The Zombie Item Prevention (Tombstones suppress deleted items)
{
  const now = 5000;
  // Device A deleted item i1 at t=3000
  const deviceA = {
    localLists: [
      {
        id: "l1",
        name: "Groceries",
        updatedAt: 3000,
        items: [],
        deletedItemIds: { i1: 3000 },
      },
    ],
  };

  // Device B was offline, still has item i1 with updatedAt=2000
  const deviceB = {
    incomingLists: [
      {
        id: "l1",
        name: "Groceries",
        updatedAt: 2000,
        items: [
          { id: "i1", text: "Oat Milk", checked: false, updatedAt: 2000 },
        ],
        deletedItemIds: {},
      },
    ],
  };

  const result = mergeCollections({ ...deviceA, ...deviceB, now });
  assert.equal(
    result.lists[0].items.length,
    0,
    "Deleted item must NOT resurrect as a zombie!",
  );
  assert.equal(
    result.lists[0].deletedItemIds.i1,
    3000,
    "Tombstone must be preserved",
  );
  console.log("  ✓ Tombstone suppresses zombie-item resurrection");
}

// Test 4: List Deletion Tombstone
{
  const now = 5000;
  // Device A deleted list l2 at t=4000
  const deviceA = {
    localLists: [{ id: "l1", name: "Groceries", updatedAt: 1000, items: [] }],
    localDeletedListIds: { l2: 4000 },
  };

  // Device B still has list l2 (updatedAt=3000)
  const deviceB = {
    incomingLists: [
      { id: "l1", name: "Groceries", updatedAt: 1000, items: [] },
      { id: "l2", name: "Old Secret List", updatedAt: 3000, items: [] },
    ],
    incomingDeletedListIds: {},
  };

  const result = mergeCollections({ ...deviceA, ...deviceB, now });
  assert.equal(result.lists.length, 1, "Deleted list must NOT be resurrected");
  assert.equal(result.lists[0].id, "l1");
  assert.equal(
    result.deletedListIds.l2,
    4000,
    "List tombstone must be preserved",
  );
  console.log(
    "  ✓ List deletion tombstone suppresses zombie-list resurrection",
  );
}

// Test 5: 30-Day Tombstone Pruning
{
  const now = 1727856000000;
  const freshTombstone = now - 5 * 86400 * 1000; // 5 days old
  const expiredTombstone = now - 35 * 86400 * 1000; // 35 days old

  const merged = mergeTombstones(
    { fresh: freshTombstone },
    { expired: expiredTombstone },
    now,
  );

  assert.equal(merged.fresh, freshTombstone, "Fresh tombstone must be kept");
  assert.equal(
    merged.expired,
    undefined,
    "Expired tombstone (>30d) must be pruned",
  );
  console.log("  ✓ Tombstones older than 30 days are cleanly pruned");
}

// Test 6: Commutative Convergence (merge(A, B) === merge(B, A))
{
  const listA = {
    localLists: [
      {
        id: "l1",
        name: "Groceries",
        updatedAt: 1000,
        items: [
          { id: "i1", text: "Oat Milk", checked: false, updatedAt: 1000 },
        ],
        deletedItemIds: { iOld: 500 },
      },
    ],
    localDeletedListIds: { lDead: 800 },
  };

  const listB = {
    incomingLists: [
      {
        id: "l1",
        name: "Groceries",
        updatedAt: 1200,
        items: [
          {
            id: "i2",
            text: "Bananas",
            checked: true,
            completedAt: new Date(1200).toISOString(),
            updatedAt: 1200,
          },
        ],
        deletedItemIds: {},
      },
      {
        id: "l2",
        name: "Chores",
        updatedAt: 900,
        items: [],
      },
    ],
    incomingDeletedListIds: {},
  };

  const res1 = mergeCollections({ ...listA, ...listB, now: 2000 });
  const res2 = mergeCollections({
    localLists: listB.incomingLists,
    incomingLists: listA.localLists,
    localDeletedListIds: listB.incomingDeletedListIds,
    incomingDeletedListIds: listA.localDeletedListIds,
    now: 2000,
  });

  assert.equal(res1.lists.length, res2.lists.length);
  assert.equal(res1.lists[0].items.length, res2.lists[0].items.length);
  assert.deepEqual(res1.deletedListIds, res2.deletedListIds);
  console.log(
    "  ✓ Commutative convergence verified: order of merging does not matter",
  );
}

// Test: An uncheck on one device beats an older tick on the other. toggleItem
// clears completedAt on uncheck, so only checkedAt carries the time.
{
  const ticked = {
    id: "i1",
    text: "Oat Milk",
    checked: true,
    completedAt: new Date(3000).toISOString(),
    checkedAt: 3000,
    updatedAt: 3000,
  };
  const unticked = {
    id: "i1",
    text: "Oat Milk",
    checked: false,
    completedAt: undefined,
    checkedAt: 4000,
    updatedAt: 4000,
  };
  assert.equal(mergeSingleItem(ticked, unticked).checked, false);
  assert.equal(mergeSingleItem(unticked, ticked).checked, false);
  assert.equal(mergeSingleItem(ticked, unticked).checkedAt, 4000);
  console.log("  ✓ Newer uncheck wins in both merge directions");
}

// Test: whole-array replacements (SingleList → upsertList) keep sync honest.
// Each case merges against the OTHER device's untouched copy, because that
// is where a missing stamp turns into a zombie or a reverted edit.
{
  const ticked = (id, text, t) => ({
    id,
    text,
    checked: true,
    completedAt: new Date(t).toISOString(),
    checkedAt: t,
    updatedAt: t,
  });
  const before = {
    id: "l1",
    updatedAt: 1000,
    items: [
      { id: "a", text: "Oat milk", checked: false, updatedAt: 1000 },
      ticked("b", "Bread", 1000),
    ],
    deletedItemIds: {},
  };
  const otherDevice = structuredClone(before);
  const mergeWithOther = (list) =>
    mergeCollections({
      localLists: [{ ...list, updatedAt: 9000 }],
      incomingLists: [otherDevice],
      now: 9000,
    }).lists[0].items;

  // Clear done: Bread vanishes, so it must leave a tombstone behind.
  const cleared = stampItemChanges(before, [before.items[0]], 5000);
  assert.equal(cleared.deletedItemIds.b, 5000);
  assert.deepEqual(
    mergeWithOther({ ...before, ...cleared }).map((i) => i.id),
    ["a"],
    "Cleared item must not come back from the other device",
  );

  // Undo: Bread returns and must outrank its own tombstone, even after the
  // other device has already seen that tombstone.
  const afterClear = { ...before, ...cleared };
  const undone = stampItemChanges(afterClear, before.items, 6000);
  assert.equal(undone.deletedItemIds.b, undefined);
  const undoneMerged = mergeCollections({
    localLists: [{ ...before, ...undone, updatedAt: 9000 }],
    incomingLists: [{ ...otherDevice, deletedItemIds: { b: 5000 } }],
    now: 9000,
  }).lists[0].items;
  assert.ok(
    undoneMerged.some((i) => i.id === "b"),
    "Undo must survive sync",
  );

  // Uncheck all: no completedAt left, so checkedAt has to carry the time.
  const unchecked = stampItemChanges(
    before,
    before.items.map((i) => ({ ...i, checked: false, completedAt: undefined })),
    7000,
  );
  assert.equal(unchecked.items[1].checkedAt, 7000);
  assert.equal(
    mergeWithOther({ ...before, ...unchecked }).find((i) => i.id === "b")
      .checked,
    false,
  );

  // Undoing the uncheck restores an OLDER checkedAt — still a new decision.
  const afterUncheck = { ...before, ...unchecked };
  const recheck = stampItemChanges(afterUncheck, before.items, 8000);
  assert.equal(recheck.items[1].checkedAt, 8000);

  // Tag/text edits through upsertList get a fresh updatedAt.
  const retagged = stampItemChanges(
    before,
    [{ ...before.items[0], text: "Oat milk #dairy", tags: ["dairy"] }],
    7500,
  );
  assert.equal(retagged.items[0].updatedAt, 7500);
  assert.equal(
    mergeWithOther({ ...before, ...retagged }).find((i) => i.id === "a").text,
    "Oat milk #dairy",
  );
  console.log("  ✓ upsertList bookkeeping: clear, undo, uncheck, retag sync");
}

console.log("✅ All listMergeService tests passed successfully!");
