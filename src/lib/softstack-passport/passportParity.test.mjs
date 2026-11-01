import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
const vectors = JSON.parse(
  readFileSync(new URL("./test-vectors.json", import.meta.url), "utf8"),
);
const manifest = JSON.parse(
  readFileSync(new URL("./manifest.json", import.meta.url), "utf8"),
);
import { generateMemberIdentity } from "./identity.js";
import { codeInput, formatCode, idInput, normalizeCode } from "./code.js";
import { selectSkin } from "./skins.js";
import { renderMembershipCard } from "./card.html.js";

const digest = createHmac("sha256", vectors.secret)
  .update(codeInput(vectors.seed))
  .digest("hex")
  .toUpperCase();
assert.equal(formatCode(digest.slice(0, 12)), vectors.code);
assert.equal(normalizeCode(vectors.code.toLowerCase()), vectors.code);

const hash = createHash("sha256").update(idInput(vectors.code)).digest("hex");
const identity = generateMemberIdentity(hash, vectors.code);
assert.equal(identity.name, vectors.identity.name);
assert.equal(identity.phrase, vectors.identity.phrase);
assert.equal(identity.memberId, vectors.code);

const skin = selectSkin(hash);
assert.equal(skin.name, vectors.card.skin);
assert.equal(skin.palette.name, vectors.card.palette);
assert.deepEqual(skin.choices, vectors.card.choices);

const html = renderMembershipCard({ identity, skin, appName: "ZipList" });
assert.match(html, /data-passport-name="Glitch Walrus"/);
assert.match(html, /data-passport-phrase="glitch-walrus-ripples-harbourside"/);
assert.match(html, /data-member-id="SS-03D2-9722-1310"/);
assert.match(html, /data-palette="Grape Soda"/);
assert.match(html, /data-holo="prismatic"/);
assert.match(html, /data-frame="soft"/);
assert.match(html, /data-texture="halftone"/);
assert.match(html, /data-type="display"/);
assert.match(html, /data-avatar="adventurer"/);
assert.match(html, />Glitch Walrus<\/p>/);
assert.match(html, />glitch-walrus-ripples-harbourside<\/p>/);

for (const [file, expected] of Object.entries(manifest.files)) {
  const actual = createHash("sha256")
    .update(readFileSync(new URL(`./${file}`, import.meta.url)))
    .digest("hex");
  assert.equal(
    actual,
    expected,
    `${file} drifted from the canonical passport module`,
  );
}

console.log("✓ SoftStack passport vector, card and vendored hashes match");
