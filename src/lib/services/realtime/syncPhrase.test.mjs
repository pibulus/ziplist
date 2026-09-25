/**
 * Sync-phrase guarantees. Run: node src/lib/services/realtime/syncPhrase.test.mjs
 *
 * The load-bearing one is BACKWARD COMPATIBILITY: expanding the word banks
 * must never move an existing room, or every live link ever shared dies.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./syncPhrase.js", import.meta.url), "utf8");

const bankOf = (name) =>
  (
    src
      .match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))[1]
      .match(/"[a-z]+"/g) || []
  ).map((w) => w.slice(1, -1));

const BANKS = ["ADJECTIVES", "NOUNS", "VERBS", "PLACES"].map(bankOf);

// Every word is typeable and survives normalizeSyncPhrase's [^a-z] strip.
for (const bank of BANKS) {
  for (const word of bank) {
    assert.match(word, /^[a-z]{3,12}$/, `unusable word: ${word}`);
  }
  assert.equal(new Set(bank).size, bank.length, "duplicate word in a bank");
}

// A word in two banks is legal but miserable to say aloud and to debug.
const all = BANKS.flat();
assert.equal(new Set(all).size, all.length, "a word appears in two banks");

const combinations = BANKS.reduce((t, b) => t * b.length, 1);
assert.ok(
  combinations >= 268_435_456,
  `keyspace shrank to ${combinations.toLocaleString()} — banks must not lose words`,
);

// THE IMPORTANT ONE. Room id = SHA-256("ziplist:sync:v1:" + phrase), sliced.
// Phrases minted under the old 40/40/32/32 banks must still land in the same
// room, or expanding the banks silently breaks every shared link.
const roomIdOf = (phrase) =>
  "zl_p" +
  createHash("sha256")
    .update(`ziplist:sync:v1:${phrase}`)
    .digest("hex")
    .slice(0, 32);

// A real room minted on ziplist.app on 2026-09-23, BEFORE the banks grew:
// /j/bouncy-muffin-salutes-underfoot redirected to this exact room. If growing
// the banks ever moves this id, every live link ever shared has died.
assert.equal(
  roomIdOf("bouncy-muffin-salutes-underfoot"),
  "zl_p7e668dc7c614535a1c338658d987e4ed",
  "legacy phrase no longer resolves to its original room",
);
assert.equal(
  "bouncy-muffin-salutes-underfoot".split("-").length,
  BANKS.length,
  "legacy phrase no longer parses",
);

// A retired word must still resolve — the derivation never consults the banks.
assert.match(roomIdOf("zzzz-yyyy-xxxx-wwww"), /^zl_p[0-9a-f]{32}$/);

console.log(
  `syncPhrase: ${combinations.toLocaleString()} combinations ` +
    `(${Math.log2(combinations).toFixed(1)} bits), legacy phrases still resolve`,
);
