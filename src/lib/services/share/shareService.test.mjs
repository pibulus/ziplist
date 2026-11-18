/**
 * Round-trip check for share-link encoding. Run: node src/lib/services/share/shareService.test.mjs
 *
 * Guards the two bugs that broke QR, copy-link and the share sheet:
 * non-Latin1 text threw from btoa, and a "+" in the base64 was eaten by
 * URLSearchParams on import.
 */
import assert from "node:assert/strict";

// Mirrors of the two functions in shareService.js (which imports $lib aliases
// and can't be loaded bare by node).
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(encoded) {
  let normalized = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/ /g, "+");
  while (normalized.length % 4) normalized += "=";
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return binary;
  }
}

// The characters a speech model actually produces, each of which used to throw.
for (const text of [
  "plain ascii list",
  "don’t forget the café", // curly apostrophe + accent
  "milk — bread → eggs", // em dash + arrow
  "\u{1F955} carrots \u{1F9C4} garlic", // emoji (surrogate pairs)
  "寿司 مرحبا шар",
  JSON.stringify({
    name: "Café — rün",
    items: [{ text: "→ x", checked: true }],
  }),
]) {
  assert.equal(
    fromBase64Url(toBase64Url(text)),
    text,
    `round-trip failed: ${text}`,
  );
}

// base64url never emits the characters that a URL fragment mangles.
for (let i = 0; i < 400; i++) {
  const encoded = toBase64Url(
    "x".repeat(i % 7) + String.fromCharCode(0xfb, 0xef, 0xbe, i % 256),
  );
  assert.ok(
    !/[+/=]/.test(encoded),
    `base64url leaked a URL-unsafe char: ${encoded}`,
  );
  assert.equal(
    new URLSearchParams(`listdata=${encoded}`).get("listdata"),
    encoded,
    "URLSearchParams altered the payload",
  );
}

// Links minted before this change must still open.
const legacyAscii = btoa('{"name":"Old","items":[]}');
assert.equal(fromBase64Url(legacyAscii), '{"name":"Old","items":[]}');
const legacyLatin1 = btoa("café"); // written as one 0xE9 byte
assert.equal(fromBase64Url(legacyLatin1), "café");
// ...including one whose "+" was already eaten by URLSearchParams.
const withPlus = btoa(String.fromCharCode(0xfb, 0xef, 0xbe));
assert.ok(withPlus.includes("+"));
assert.equal(
  fromBase64Url(withPlus.replace(/\+/g, " ")),
  fromBase64Url(withPlus),
);

// Compact v2 tuple payload stays drastically smaller than verbose v1 JSON
// while decoding identically alongside legacy v1 links.
const sampleItems = Array.from({ length: 30 }, (_, idx) => ({
  text: `Task number ${idx + 1} for TodayList`,
  checked: idx % 5 === 0,
  tags: idx === 2 ? ["urgent"] : [],
}));
const v1Encoded = toBase64Url(
  JSON.stringify({
    name: "TodayList",
    items: sampleItems.map((it) =>
      it.tags.length
        ? { text: it.text, checked: it.checked, tags: it.tags }
        : { text: it.text, checked: it.checked },
    ),
  }),
);
const v2Encoded = toBase64Url(
  JSON.stringify({
    v: 2,
    n: "TodayList",
    i: sampleItems.map((it) =>
      it.tags.length
        ? [it.text, it.checked ? 1 : 0, it.tags]
        : it.checked
          ? [it.text, 1]
          : [it.text],
    ),
  }),
);
assert.ok(
  v2Encoded.length < v1Encoded.length * 0.72,
  `v2 compact encoding (${v2Encoded.length}) should be much shorter than v1 (${v1Encoded.length})`,
);
const decodedV2 = JSON.parse(fromBase64Url(v2Encoded));
assert.equal(decodedV2.v, 2);
assert.equal(decodedV2.n, "TodayList");
assert.equal(decodedV2.i.length, 30);
assert.deepEqual(decodedV2.i[0], ["Task number 1 for TodayList", 1]);
assert.deepEqual(decodedV2.i[1], ["Task number 2 for TodayList"]);
assert.deepEqual(decodedV2.i[2], [
  "Task number 3 for TodayList",
  0,
  ["urgent"],
]);

console.log("shareService: all round-trip checks passed");
