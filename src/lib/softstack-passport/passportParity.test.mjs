import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  codeInput,
  deriveLegacyPhrase,
  formatCode,
  generateMemberIdentity,
  getSyncRoomId,
  idInput,
  normalizeCode,
  parseFourWordPasskey,
  PASSPHRASE_ENTROPY_BITS,
  phraseFromHash,
  phraseInput,
  renderMembershipCard,
  selectSkin,
  WORDS,
} from "./index.js";

const EXPECTED_MANIFEST_SHA256 = "d89419c336fcfa38118f1ba083df8a6f768f0f27708dfcfb50e5e35acbe5a748";

const vectors = JSON.parse(
  readFileSync(new URL("./test-vectors.json", import.meta.url), "utf8"),
);
const manifestBytes = readFileSync(
  new URL("./manifest.json", import.meta.url),
);
const manifest = JSON.parse(manifestBytes.toString("utf8"));

assert.equal(WORDS.length, 4096);
assert.equal(new Set(WORDS).size, 4096);
assert.ok(PASSPHRASE_ENTROPY_BITS >= 44, "Passphrase entropy below 44 bits");
assert.equal(PASSPHRASE_ENTROPY_BITS, 48);

const phraseDigest = createHmac("sha256", vectors.secret)
  .update(phraseInput(vectors.seed))
  .digest("hex");
const phrase = phraseFromHash(phraseDigest);
assert.equal(phrase, vectors.phrase);

const digest = createHmac("sha256", vectors.secret)
  .update(codeInput(phrase))
  .digest("hex")
  .toUpperCase();
assert.equal(formatCode(digest.slice(0, 12)), vectors.code);
assert.equal(normalizeCode(vectors.code.toLowerCase()), vectors.code);

const hash = createHash("sha256").update(idInput(vectors.code)).digest("hex");
assert.equal(hash, vectors.vaultHash);
const identity = generateMemberIdentity(hash, vectors.code, {
  phrase: vectors.phrase,
});
assert.equal(identity.name, vectors.identity.name);
assert.equal(identity.phrase, vectors.identity.phrase);
assert.equal(identity.memberId, vectors.code);
assert.equal(getSyncRoomId(vectors.phrase), vectors.syncRoomId);

// Legacy holder keeps their stored name and legacy phrase through migration
const legacyIdentity = generateMemberIdentity(
  vectors.legacy.vaultHash,
  vectors.legacy.code,
);
assert.equal(legacyIdentity.name, vectors.legacy.name);
assert.equal(
  deriveLegacyPhrase(vectors.legacy.vaultHash),
  vectors.legacy.phrase,
);

// One wrong word fails cleanly in < 50ms
const t0 = performance.now();
assert.equal(parseFourWordPasskey(vectors.phrase)?.phrase, vectors.phrase);
assert.equal(parseFourWordPasskey("umbra-scanner-amplify-notawordinbank"), null);
assert.ok(performance.now() - t0 < 50);

const skin = selectSkin(hash);
assert.equal(skin.name, vectors.card.skin);
assert.equal(skin.palette.name, vectors.card.palette);
assert.deepEqual(skin.choices, vectors.card.choices);

const resting = renderMembershipCard({
  identity,
  skin,
  appName: "ZipList",
  qrUrl: "https://ziplist.app/#sync=test",
  qrImageUrl: "data:image/png;base64,AAAA",
});
assert.match(resting, /data-passport-name="Quiet Tapir"/);
assert.match(resting, /data-passport-masked="true"/);
assert.ok(!resting.includes(vectors.phrase), "Resting card leaked passphrase");
assert.ok(!resting.includes("data:image/png;base64,AAAA"), "Resting card rendered QR");
assert.match(resting, />••••• ••••• ••••• •••••<\/p>/);

const html = renderMembershipCard({
  identity,
  skin,
  appName: "ZipList",
  revealed: true,
  showQr: true,
  qrUrl: "https://ziplist.app/#sync=test",
  qrImageUrl: "data:image/png;base64,AAAA",
});
assert.match(html, /data-passport-name="Quiet Tapir"/);
assert.match(html, /data-passport-phrase="umbra-scanner-amplify-cosmos"/);
assert.match(html, /data-member-id="SS-FA39-DE19-4608"/);
assert.match(html, />Quiet Tapir<\/p>/);
assert.match(html, />umbra-scanner-amplify-cosmos<\/p>/);

const actualManifestHash = createHash("sha256")
  .update(manifestBytes)
  .digest("hex");
assert.equal(
  actualManifestHash,
  EXPECTED_MANIFEST_SHA256,
  "manifest.json SHA-256 drifted from pinned canonical hash",
);

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
