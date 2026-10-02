// ═══════════════════════════════════════════════════════════════════════════
// 🔀 listMergeService — Deterministic Two-Way Field Merge with 30d Tombstones
// ═══════════════════════════════════════════════════════════════════════════
// Standardized across ZipList and the fleet.
// Implements an LWW-Element-Set with field-level Last-Write-Wins and
// 30-day tombstones to permanently prevent zombie-item resurrections.

export const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Normalize an item's updated timestamp into epoch milliseconds.
 */
export function getItemTimestamp(item) {
  if (!item) return 0;
  if (typeof item.updatedAt === "number" && !Number.isNaN(item.updatedAt)) {
    return item.updatedAt;
  }
  const parsed = Date.parse(
    item.updatedAt || item.completedAt || item.addedAt || 0,
  );
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Normalize a list's updated timestamp into epoch milliseconds.
 */
export function getListTimestamp(list) {
  if (!list) return 0;
  if (typeof list.updatedAt === "number" && !Number.isNaN(list.updatedAt)) {
    return list.updatedAt;
  }
  const parsed = Date.parse(list.updatedAt || list.createdAt || 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Clean tombstones older than 30 days to keep local storage bounded.
 */
export function pruneStaleTombstones(tombstones = {}, now = Date.now()) {
  const result = {};
  if (!tombstones || typeof tombstones !== "object") return result;

  for (const [id, rawTime] of Object.entries(tombstones)) {
    const time = Number(rawTime) || 0;
    if (time > 0 && now - time <= TOMBSTONE_RETENTION_MS) {
      result[id] = time;
    }
  }
  return result;
}

/**
 * Combine two tombstone dictionaries, keeping the latest timestamp per ID.
 */
export function mergeTombstones(
  localTombstones = {},
  incomingTombstones = {},
  now = Date.now(),
) {
  const merged = {};
  const allIds = new Set([
    ...Object.keys(localTombstones || {}),
    ...Object.keys(incomingTombstones || {}),
  ]);

  for (const id of allIds) {
    const localTime = Number(localTombstones?.[id]) || 0;
    const incomingTime = Number(incomingTombstones?.[id]) || 0;
    const maxTime = Math.max(localTime, incomingTime);
    if (maxTime > 0 && now - maxTime <= TOMBSTONE_RETENTION_MS) {
      merged[id] = maxTime;
    }
  }
  return merged;
}

function getCheckTimestamp(item) {
  if (typeof item.checkedAt === "number") return item.checkedAt;
  return Date.parse(item.completedAt) || 0;
}

/**
 * Merge two single items with matching IDs using field-level LWW.
 * Checking off an item does NOT overwrite independent text edits made on another screen.
 */
export function mergeSingleItem(localItem, incomingItem) {
  if (!localItem) return incomingItem;
  if (!incomingItem) return localItem;

  const localTime = getItemTimestamp(localItem);
  const incomingTime = getItemTimestamp(incomingItem);

  // Field 1: Text & Tags (newer text edit wins)
  let text = localItem.text;
  let tags = localItem.tags;
  if (incomingTime > localTime) {
    text = incomingItem.text;
    tags = incomingItem.tags;
  }

  // Field 2: Checked & CompletedAt (independent timestamp comparison).
  // checkedAt covers unchecks too; completedAt is the fallback for items
  // toggled by builds that predate it.
  const localCompletedTime = getCheckTimestamp(localItem);
  const incomingCompletedTime = getCheckTimestamp(incomingItem);

  let checked = localItem.checked;
  let completedAt = localItem.completedAt;

  if (incomingCompletedTime > localCompletedTime) {
    checked = incomingItem.checked;
    completedAt = incomingItem.completedAt;
  } else if (localCompletedTime === 0 && incomingCompletedTime === 0) {
    // Neither has completedAt timestamp; follow higher updatedAt
    if (incomingTime > localTime) {
      checked = incomingItem.checked;
    }
  }

  return {
    ...localItem,
    ...incomingItem,
    text,
    tags,
    checked,
    completedAt,
    checkedAt: Math.max(localCompletedTime, incomingCompletedTime) || undefined,
    updatedAt: Math.max(localTime, incomingTime),
  };
}

/**
 * Merge items within a list, suppressing any deleted items.
 */
export function mergeListItems(
  localItems = [],
  incomingItems = [],
  deletedItemIds = {},
) {
  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const incomingMap = new Map(incomingItems.map((item) => [item.id, item]));
  const allItemIds = new Set([...localMap.keys(), ...incomingMap.keys()]);

  const resultItems = [];

  for (const itemId of allItemIds) {
    const local = localMap.get(itemId);
    const incoming = incomingMap.get(itemId);
    const deletedTime = deletedItemIds[itemId] || 0;

    const latestActiveTime = Math.max(
      local ? getItemTimestamp(local) : 0,
      incoming ? getItemTimestamp(incoming) : 0,
    );

    // If tombstone is newer than any active edit, the item stays deleted
    if (deletedTime > 0 && deletedTime >= latestActiveTime) {
      continue;
    }

    if (local && incoming) {
      resultItems.push(mergeSingleItem(local, incoming));
    } else if (local) {
      resultItems.push(local);
    } else if (incoming) {
      resultItems.push(incoming);
    }
  }

  // Order invariant: unchecked items first (in stable original order), then completed items
  const unchecked = resultItems.filter((i) => !i.checked);
  const completed = resultItems.filter((i) => i.checked);
  return [...unchecked, ...completed].map((item, index) => ({
    ...item,
    order: index,
  }));
}

/**
 * Merge two entire list collections with tombstones and cap enforcement.
 *
 * @param {object} params
 * @param {Array} params.localLists
 * @param {Array} params.incomingLists
 * @param {object} [params.localDeletedListIds]
 * @param {object} [params.incomingDeletedListIds]
 * @param {number} [params.maxLists]
 * @param {number} [params.now]
 * @returns {{ lists: Array, deletedListIds: object, overflowCount: number }}
 */
export function mergeCollections({
  localLists = [],
  incomingLists = [],
  localDeletedListIds = {},
  incomingDeletedListIds = {},
  maxLists = 12,
  now = Date.now(),
}) {
  const mergedDeletedListIds = mergeTombstones(
    localDeletedListIds,
    incomingDeletedListIds,
    now,
  );

  const localMap = new Map();
  for (const list of localLists) {
    if (!list?.id || list.id.startsWith("live_")) continue;
    localMap.set(list.id, list);
  }

  const incomingMap = new Map();
  for (const list of incomingLists) {
    if (!list?.id || list.id.startsWith("live_")) continue;
    incomingMap.set(list.id, list);
  }

  const allListIds = new Set([...localMap.keys(), ...incomingMap.keys()]);
  const reconciledLists = [];

  for (const listId of allListIds) {
    const local = localMap.get(listId);
    const incoming = incomingMap.get(listId);
    const deletedTime = mergedDeletedListIds[listId] || 0;

    const latestListTime = Math.max(
      local ? getListTimestamp(local) : 0,
      incoming ? getListTimestamp(incoming) : 0,
    );

    // If list was deleted newer than its last update, it stays deleted
    if (deletedTime > 0 && deletedTime >= latestListTime) {
      continue;
    }

    if (local && incoming) {
      const localTime = getListTimestamp(local);
      const incomingTime = getListTimestamp(incoming);

      // Metadata (name, color) follows higher timestamp
      const metadataSource = incomingTime > localTime ? incoming : local;

      // Merge item tombstones
      const mergedDeletedItems = mergeTombstones(
        local.deletedItemIds,
        incoming.deletedItemIds,
        now,
      );

      const mergedItems = mergeListItems(
        local.items,
        incoming.items,
        mergedDeletedItems,
      );

      reconciledLists.push({
        ...local,
        ...metadataSource,
        items: mergedItems,
        deletedItemIds: mergedDeletedItems,
        updatedAt: new Date(Math.max(localTime, incomingTime)).toISOString(),
      });
    } else if (local) {
      reconciledLists.push({
        ...local,
        deletedItemIds: pruneStaleTombstones(local.deletedItemIds, now),
      });
    } else if (incoming) {
      reconciledLists.push({
        ...incoming,
        deletedItemIds: pruneStaleTombstones(incoming.deletedItemIds, now),
      });
    }
  }

  // Preserve local order preference, append new incoming lists
  const localIdOrder = localLists.map((l) => l.id);
  reconciledLists.sort((a, b) => {
    const idxA = localIdOrder.indexOf(a.id);
    const idxB = localIdOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return getListTimestamp(b) - getListTimestamp(a);
  });

  // Enforce tier list cap
  let overflowCount = 0;
  let finalLists = reconciledLists;
  if (reconciledLists.length > maxLists) {
    overflowCount = reconciledLists.length - maxLists;
    finalLists = reconciledLists.slice(0, maxLists);
  }

  return {
    lists: finalLists,
    deletedListIds: mergedDeletedListIds,
    overflowCount,
  };
}
