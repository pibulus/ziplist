// Sequential list colours must advance without repeating any active list colour,
// even when middle lists are deleted and re-added.
// Run: node scripts/check-list-colors.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(
  new URL("../src/lib/services/lists/listsStore.js", import.meta.url),
  "utf8",
);

const presetsStart = src.indexOf("export const LIST_COLOR_PRESETS = [");
const presetsEnd = src.indexOf("\n];", presetsStart) + 3;
const presetsCode = src
  .slice(presetsStart, presetsEnd)
  .replace("export const ", "const ");

const helperStart = src.indexOf("function findPresetIndexForList(list)");
const pickEnd =
  src.indexOf(
    "\n}",
    src.indexOf("export function pickNextListPalette(existingLists = [])"),
  ) + 2;
const helperCode = src
  .slice(helperStart, pickEnd)
  .replace("export function ", "function ");

const { LIST_COLOR_PRESETS, pickNextListPalette } = new Function(
  `${presetsCode}\n${helperCode}\nreturn { LIST_COLOR_PRESETS, pickNextListPalette };`,
)();

assert.equal(LIST_COLOR_PRESETS.length, 12, "expected 12 colour presets");

// First three anchor the brand palette: blue -> pink -> yellow.
assert.deepEqual(
  LIST_COLOR_PRESETS.slice(0, 3).map((p) => p.color),
  ["blue", "pink", "yellow"],
);

// Sequential creation across all 12 slots yields 12 unique colours in preset order.
const deck = [];
for (let i = 0; i < 12; i += 1) {
  const next = pickNextListPalette(deck);
  deck.push({
    id: `l-${i}`,
    color: next.color,
    primaryColor: next.primaryColor,
  });
}
assert.equal(
  new Set(deck.map((l) => l.color)).size,
  12,
  "12 sequential lists must have 12 distinct colours",
);

// Regression: [Blue, Pink, Yellow] -> delete Pink -> add new list must NOT repeat Yellow.
const afterDeleteMiddle = [deck[0], deck[2]]; // Blue, Yellow
const afterDeleteNext = pickNextListPalette(afterDeleteMiddle);
assert.notEqual(afterDeleteNext.color, "yellow");
assert.notEqual(afterDeleteNext.color, "blue");
assert.equal(afterDeleteNext.color, "sage");

// Deleting multiple lists and creating back up to 12 never produces duplicates.
const churned = [deck[0], deck[2], deck[5], deck[8]];
while (churned.length < 12) {
  const next = pickNextListPalette(churned);
  assert.ok(
    !churned.some((l) => l.color === next.color),
    `unexpected duplicate colour ${next.color}`,
  );
  churned.push({ id: `c-${churned.length}`, color: next.color });
}
assert.equal(new Set(churned.map((l) => l.color)).size, 12);

console.log("check-list-colors: ok");
