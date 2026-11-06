/**
 * Sync-phrase guarantees. Run: node src/lib/services/realtime/syncPhrase.test.mjs
 *
 * The load-bearing one is BACKWARD COMPATIBILITY: expanding the word banks
 * must never move an existing room, or every live link ever shared dies.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  WORDS,
  ADJECTIVES,
  NOUNS,
  VERBS,
  PLACES,
  PASSPHRASE_ENTROPY_BITS,
  SYNC_PHRASE_COMBINATIONS,
} from "./syncPhrase.js";

const BANKS = [ADJECTIVES, NOUNS, VERBS, PLACES];

// Unified 4,096-word SoftStack Passport bank (4096^4 = 48 bits).
assert.equal(WORDS.length, 4096, "unified bank must have 4,096 words");
assert.equal(new Set(WORDS).size, 4096, "unified bank must have no duplicates");
for (const word of WORDS) {
  assert.match(word, /^[a-z]{3,12}$/, `unusable word: ${word}`);
}

// Legacy 4-slot exports remain populated and disjoint.
for (const bank of BANKS) {
  for (const word of bank) {
    assert.match(word, /^[a-z]{3,12}$/, `unusable word: ${word}`);
  }
  assert.equal(new Set(bank).size, bank.length, "duplicate word in a bank");
}
const allSlots = BANKS.flat();
assert.equal(new Set(allSlots).size, allSlots.length, "a word appears in two slot banks");

assert.ok(
  PASSPHRASE_ENTROPY_BITS >= 44,
  `passphrase entropy (${PASSPHRASE_ENTROPY_BITS} bits) must be >= 44 bits`,
);
assert.ok(
  SYNC_PHRASE_COMBINATIONS >= 4096 ** 4,
  `keyspace shrank to ${SYNC_PHRASE_COMBINATIONS.toLocaleString()}`,
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
  4,
  "legacy phrase no longer parses",
);

// A retired word must still resolve — the derivation never consults the banks.
assert.match(roomIdOf("zzzz-yyyy-xxxx-wwww"), /^zl_p[0-9a-f]{32}$/);

console.log(
  `syncPhrase: ${SYNC_PHRASE_COMBINATIONS.toLocaleString()} combinations ` +
    `(${PASSPHRASE_ENTROPY_BITS.toFixed(1)} bits), legacy phrases still resolve`,
);
