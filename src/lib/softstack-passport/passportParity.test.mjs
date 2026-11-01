import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
const vectors = JSON.parse(
  readFileSync(new URL("./test-vectors.json", import.meta.url), "utf8"),
);
import { generateMemberIdentity } from "./identity.js";
import { codeInput, formatCode, idInput, normalizeCode } from "./code.js";

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

console.log("✓ SoftStack passport vector matches across apps");
