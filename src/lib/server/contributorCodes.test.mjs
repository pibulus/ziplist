import assert from "node:assert/strict";
import {
  normalizeContributorCode,
  parseContributorCodes,
  isContributorCodeValid,
} from "./contributorCodes.js";

// Normalization
assert.equal(
  normalizeContributorCode("  zip-patron-123  "),
  "ZIP-PATRON-123",
  "should trim and uppercase",
);
assert.equal(
  normalizeContributorCode(""),
  "",
  "empty string normalizes to empty",
);
assert.equal(normalizeContributorCode(null), "", "null normalizes to empty");
assert.equal(
  normalizeContributorCode(undefined),
  "",
  "undefined normalizes to empty",
);

// Parsing
const parsed = parseContributorCodes(
  "ZIP-AAA, zip-bbb",
  "ZIP-CCC",
  null,
  undefined,
  "",
);
assert.deepEqual(
  parsed,
  ["ZIP-AAA", "ZIP-BBB", "ZIP-CCC"],
  "should parse comma-delimited codes and filter empties",
);

// Validation
const validCodes = ["ZIP-PATRON-100", "ZIP-SUPPORTER-200"];

assert.equal(
  isContributorCodeValid("zip-patron-100", validCodes),
  true,
  "case-insensitive match should pass",
);
assert.equal(
  isContributorCodeValid("ZIP-SUPPORTER-200", validCodes),
  true,
  "exact match should pass",
);
assert.equal(
  isContributorCodeValid("ZIP-NOPE", validCodes),
  false,
  "unknown code should fail",
);
assert.equal(
  isContributorCodeValid("", validCodes),
  false,
  "empty code should fail",
);
assert.equal(
  isContributorCodeValid(null, validCodes),
  false,
  "null code should fail",
);
assert.equal(
  isContributorCodeValid(undefined, validCodes),
  false,
  "undefined code should fail",
);
assert.equal(
  isContributorCodeValid("ZIP-PATRON-100-EXTRA", validCodes),
  false,
  "prefix extension should fail",
);
assert.equal(
  isContributorCodeValid("🎸🔥💀", validCodes),
  false,
  "emojis should fail safely",
);

// Missing / empty sets
assert.equal(
  isContributorCodeValid("ZIP-PATRON-100", []),
  false,
  "empty allowlist should return false",
);
assert.equal(
  isContributorCodeValid("ZIP-PATRON-100", null),
  false,
  "null allowlist should return false without throwing",
);
assert.equal(
  isContributorCodeValid("ZIP-PATRON-100", undefined),
  false,
  "undefined allowlist should return false without throwing",
);

console.log("✓ contributor codes tests passed");
