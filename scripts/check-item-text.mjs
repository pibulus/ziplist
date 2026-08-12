// Sentence-casing must tidy an entry without vandalising it. Blind
// charAt(0).toUpperCase() turned "iPhone charger" into "IPhone charger".
// Run: node scripts/check-item-text.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The function is module-private, so exercise the real source rather than a copy.
const src = readFileSync(
  new URL("../src/lib/services/lists/listsStore.js", import.meta.url),
  "utf8",
);
const body = src.slice(src.indexOf("function capitalizeFirstWord"));
const fn = new Function(
  `${body.slice(0, body.indexOf("\n}") + 2)}; return capitalizeFirstWord;`,
)();

// Ordinary entries get tidied.
for (const [input, want] of [
  ["milk", "Milk"],
  ["tent pegs", "Tent pegs"],
  ["a4 paper", "A4 paper"],
  ["  ", "  "],
]) {
  assert.equal(
    fn(input),
    want,
    `${JSON.stringify(input)} -> ${JSON.stringify(fn(input))}`,
  );
}

// Words that already know their own shape are left alone.
for (const s of [
  "iPhone charger",
  "eBay parcel",
  "pH strips",
  "iOS update",
  "macOS thing",
]) {
  assert.equal(fn(s), s, `must not touch: ${s} (got ${fn(s)})`);
}

// Already-capitalised input is untouched.
for (const s of ["Milk", "Tent pegs", "ABC"]) {
  assert.equal(fn(s), s);
}

console.log(
  "✓ item text: tidies plain entries, leaves iPhone/eBay/pH/iOS alone",
);
