// Self-check for list text export/import. Run: node scripts/check-list-text.mjs
import assert from "node:assert/strict";
import {
  listToText,
  textToItems,
  splitPastedList,
} from "../src/lib/services/lists/listTextFormat.js";

const list = {
  name: "Shopping",
  items: [
    { text: "milk", checked: false },
    { text: "bread", checked: true },
  ],
};

// Round trip: what we write, we must be able to read back.
const text = listToText(list);
const back = splitPastedList(text);
assert.equal(back.name, "Shopping", "title should survive the round trip");
assert.deepEqual(
  back.items,
  [
    { text: "milk", checked: false },
    { text: "bread", checked: true },
  ],
  "items and their checked state should survive the round trip",
);

// Forgiving on whatever people actually paste.
const messy = `- eggs
* butter
• jam
1. tea
2) coffee
[x] paid rent
[ ] call mum
✓ washed up
   
plain line`;
const items = textToItems(messy);
assert.equal(items.length, 9, `expected 9 items, got ${items.length}`);
assert.deepEqual(
  items.map((i) => i.text),
  [
    "eggs",
    "butter",
    "jam",
    "tea",
    "coffee",
    "paid rent",
    "call mum",
    "washed up",
    "plain line",
  ],
  "every bullet style should strip cleanly",
);
assert.equal(items[5].checked, true, "[x] should read as done");
assert.equal(items[6].checked, false, "[ ] should read as not done");
assert.equal(items[7].checked, true, "✓ should read as done");

// A bare list with no title stays all items.
const bare = splitPastedList("- one\n- two");
assert.equal(bare.name, "", "no title when the first line is an item");
assert.equal(bare.items.length, 2);

// Junk in, empty out.
assert.deepEqual(textToItems(""), []);
assert.deepEqual(textToItems(null), []);
assert.deepEqual(textToItems("   \n  \n"), []);

console.log("✓ list text checks passed");
console.log(
  listToText(list)
    .trimEnd()
    .split("\n")
    .map((l) => "  " + l)
    .join("\n"),
);
