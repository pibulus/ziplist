// Self-check for the device-sync phrase. Run: node scripts/check-sync-phrase.mjs
// The one thing that MUST hold: the same words always derive the same room on
// any device, or a synced list silently lands in a room nobody else is in.
import assert from "node:assert/strict";
import {
  generateSyncPhrase,
  normalizeSyncPhrase,
  isValidSyncPhrase,
  deriveRoomIdFromPhrase,
  SYNC_ROOM_PATTERN,
  SYNC_PHRASE_COMBINATIONS,
} from "../src/lib/services/realtime/syncPhrase.js";

const phrase = generateSyncPhrase();
assert.equal(phrase.split("-").length, 4, "phrase should be four words");
assert.ok(isValidSyncPhrase(phrase), "generated phrase must validate");

// Determinism — the whole feature rests on this.
const a = await deriveRoomIdFromPhrase(phrase);
const b = await deriveRoomIdFromPhrase(phrase);
assert.equal(a, b, "same phrase must derive the same room id");
assert.ok(
  SYNC_ROOM_PATTERN.test(a),
  `room id must match the pattern, got ${a}`,
);

// People retype these by hand — case, spacing and punctuation must not matter.
const messy = `  ${phrase.replace(/-/g, " ").toUpperCase()}!  `;
assert.equal(
  normalizeSyncPhrase(messy),
  phrase,
  "normalize should be forgiving",
);
assert.equal(
  await deriveRoomIdFromPhrase(messy),
  a,
  "a messily-typed phrase must reach the same room",
);

// Different phrases must not collide.
const other = await deriveRoomIdFromPhrase("neon-turtle-drifts-uptown");
const third = await deriveRoomIdFromPhrase("neon-turtle-drifts-yonder");
assert.notEqual(other, third, "different phrases must derive different rooms");

// Junk in, nothing out — never a half-valid room id.
for (const junk of [
  "",
  "  ",
  "only-three-words",
  "way-too-many-words-here-friend",
]) {
  assert.equal(
    await deriveRoomIdFromPhrase(junk),
    "",
    `junk should derive nothing: ${junk}`,
  );
}

// Spread check: 400 phrases should be overwhelmingly distinct.
const seen = new Set();
for (let i = 0; i < 400; i++) seen.add(generateSyncPhrase());
assert.ok(
  seen.size > 395,
  `phrases should rarely repeat, got ${seen.size}/400`,
);

console.log("✓ sync phrase checks passed");
console.log(`  example: ${phrase}`);
console.log(`  room:    ${a}`);
console.log(
  `  space:   ${SYNC_PHRASE_COMBINATIONS.toLocaleString()} combinations (${Math.log2(SYNC_PHRASE_COMBINATIONS).toFixed(1)} bits)`,
);
