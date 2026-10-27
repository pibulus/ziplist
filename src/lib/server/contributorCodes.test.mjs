import assert from "node:assert/strict";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

// Set up test environment before importing server modules
process.env.ZIPLIST_STORAGE_ADAPTER = "memory";
process.env.CONTRIBUTOR_LICENSE_SECRET =
  "test-contributor-license-secret-key-at-least-32-chars";

const libBaseUrl = pathToFileURL(
  path.resolve(process.cwd(), "src/lib") + "/",
).href;

// Register a minimal ESM resolve/load hook so SvelteKit virtual modules
// ($env/dynamic/private, $env/dynamic/public, $app/environment, $lib/*)
// resolve cleanly under bare `node`.
const loaderSource = `
const libBaseUrl = ${JSON.stringify(libBaseUrl)};
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "$env/dynamic/private" || specifier === "$env/dynamic/public") {
    return { url: "virtual:" + specifier, shortCircuit: true };
  }
  if (specifier === "$app/environment") {
    return { url: "virtual:$app/environment", shortCircuit: true };
  }
  if (specifier.startsWith("$lib/")) {
    const target = new URL(specifier.slice(5), libBaseUrl).href;
    return nextResolve(target, context);
  }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "virtual:$env/dynamic/private" || url === "virtual:$env/dynamic/public") {
    return {
      format: "module",
      shortCircuit: true,
      source: "export const env = process.env;",
    };
  }
  if (url === "virtual:$app/environment") {
    return {
      format: "module",
      shortCircuit: true,
      source: "export const browser = false; export const dev = true;",
    };
  }
  return nextLoad(url, context);
}
`;

register(
  `data:text/javascript;base64,${Buffer.from(loaderSource).toString("base64")}`,
);

const {
  normalizeContributorCode,
  parseContributorCodes,
  isContributorCodeValid,
} = await import("./contributorCodes.js");

const {
  generateLicenseCode,
  generatePasskeyPhrase,
  hashContributorCode,
  normalizePasskeyPhrase,
  vaultHashForCode,
} = await import("./contributor/licenseCrypto.js");

const {
  createLicenseForCheckout,
  createVoucherLicense,
  findLicenseByCode,
  lookupCodeHashByPasskey,
  redeemStoredLicense,
} = await import("./contributor/licenseStore.js");

const {
  buildContributorEmail,
  isValidEmailAddress,
  sendContributorPassportEmail,
} = await import("./email/contributorEmail.js");

const { POST: emailPassPost } =
  await import("../../routes/api/contributor/email-pass/+server.js");

const { isPersonalPassportCode, getVaultHash } =
  await import("../services/vaultHashStorage.js");

const { dealTips, ABOUT_TIPS } = await import("../config/aboutTips.js");

// 1. Contributor code normalization & validation
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

const validCodes = ["ZIP-PATRON-100", "ZIP-SUPPORTER-200", "ZL-ABCD-1234"];

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
  isContributorCodeValid("abcd 1234", validCodes),
  true,
  "stripped ZL prefix and spaces should still match",
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

// 2. 4-Word Passkey generation, normalization & client/server vaultHash parity
assert.equal(
  normalizePasskeyPhrase("  Velvet_Octopus   Drifts--Quietly! "),
  "velvet-octopus-drifts-quietly",
  "normalizePasskeyPhrase should normalize case, punctuation, and whitespace into hyphenated words",
);

const sampleCode = generateLicenseCode("checkout_test_001");
assert.match(
  sampleCode,
  /^ZL-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/,
  "generated license code must use ZL-XXXX-XXXX-XXXX format",
);

const serverVaultHash = vaultHashForCode(sampleCode);
const clientVaultHash = await getVaultHash(sampleCode);
assert.equal(
  serverVaultHash,
  clientVaultHash,
  "server vaultHashForCode and client getVaultHash must derive the exact same SHA-256 hash",
);

const samplePhrase = generatePasskeyPhrase("checkout_test_001");
const phraseFromCanonicalCode = generatePasskeyPhrase(sampleCode);
assert.equal(
  samplePhrase,
  phraseFromCanonicalCode,
  "generatePasskeyPhrase must derive identical 4-word phrase from checkout seed or canonical ZL code",
);
assert.equal(
  samplePhrase.split("-").length,
  4,
  "generated passkey phrase must be 4 hyphen-separated words",
);

// 3. License store: indexing & redeeming by either 4-word passkey or ZL code
const minted = await createLicenseForCheckout({
  id: "checkout_test_001",
  codeHash: hashContributorCode(sampleCode),
  provider: "square",
});
assert.equal(minted.code, sampleCode);
assert.equal(minted.phrase, samplePhrase);

const phraseHash = hashContributorCode(samplePhrase);
const indexedCodeHash = await lookupCodeHashByPasskey(phraseHash);
assert.equal(
  indexedCodeHash,
  hashContributorCode(sampleCode),
  "passkey index should map phraseHash back to license codeHash",
);

const foundByCode = await findLicenseByCode(sampleCode);
assert.ok(foundByCode, "findLicenseByCode should locate license by ZL code");

const foundByPasskey = await findLicenseByCode(
  `  ${samplePhrase.replace(/-/g, " ").toUpperCase()}  `,
);
assert.ok(
  foundByPasskey,
  "findLicenseByCode should locate license by messy 4-word passkey",
);
assert.equal(foundByPasskey.id, foundByCode.id);

const redeemedByPasskey = await redeemStoredLicense(
  samplePhrase.replace(/-/g, " "),
);
assert.ok(
  redeemedByPasskey,
  "redeemStoredLicense should succeed when given the 4-word passkey",
);
assert.equal(redeemedByPasskey.checkoutId, "checkout_test_001");

// Voucher slot cap test
process.env.CONTRIBUTOR_VOUCHER_LIMIT = "2";
const voucher1 = await createVoucherLicense();
const voucher2 = await createVoucherLicense();
assert.notEqual(
  voucher1.code,
  voucher2.code,
  "each voucher redemption must mint a unique personal Passport code",
);
await assert.rejects(
  () => createVoucherLicense(),
  (err) => err.code === "VOUCHER_LIMIT",
  "exceeding CONTRIBUTOR_VOUCHER_LIMIT should throw VOUCHER_LIMIT",
);

// 4. Zero-storage email validation & builder
assert.equal(isValidEmailAddress("pablo@example.com"), true);
assert.equal(isValidEmailAddress("not-an-email"), false);
assert.equal(isValidEmailAddress(""), false);
assert.equal(isValidEmailAddress("a@b"), false);

const builtEmail = buildContributorEmail({
  to: "pablo@example.com",
  code: sampleCode,
  phrase: samplePhrase,
  appOrigin: "https://ziplist.app",
  hasQr: true,
});
assert.ok(
  builtEmail.html.includes(samplePhrase),
  "Passport email HTML must include the 4-word passkey",
);
assert.ok(
  builtEmail.text.includes(samplePhrase),
  "Passport email plain text must include the 4-word passkey",
);
assert.ok(
  builtEmail.html.includes("/u/"),
  "Passport email HTML must include /u/ short unlock door",
);
assert.ok(
  builtEmail.html.includes("cid:ziplist-passport-qr"),
  "Passport email HTML must include inline cid:ziplist-passport-qr image",
);

// Test Resend 403 domain fallback & inline QR attachment in sendContributorPassportEmail
process.env.RESEND_API_KEY = "re_test_dummy_key";
const sentPayloads = [];
const fallbackResult = await sendContributorPassportEmail({
  to: "pablo@example.com",
  code: sampleCode,
  phrase: samplePhrase,
  appOrigin: "https://ziplist.app",
  fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    sentPayloads.push(body);
    if (sentPayloads.length === 1) {
      return new Response(
        JSON.stringify({ message: "The ziplist.app domain is not verified" }),
        { status: 403 },
      );
    }
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  },
});
assert.equal(fallbackResult.sent, true);
assert.equal(
  sentPayloads.length,
  2,
  "should retry once when primary domain is not verified",
);
assert.equal(
  sentPayloads[1].from,
  "ZipList <onboarding@resend.dev>",
  "retry should use onboarding@resend.dev sender fallback",
);
assert.equal(
  Array.isArray(sentPayloads[1].attachments) &&
    sentPayloads[1].attachments.length,
  1,
  "dispatched payload must attach inline QR PNG",
);
const badEmailRes = await emailPassPost({
  request: new Request("https://ziplist.app/api/contributor/email-pass", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "invalid-email", code: sampleCode }),
  }),
  url: new URL("https://ziplist.app/api/contributor/email-pass"),
  getClientAddress: () => "127.0.0.1",
});
assert.equal(
  badEmailRes.status,
  400,
  "email-pass should reject invalid email with 400",
);

const unauthRes = await emailPassPost({
  request: new Request("https://ziplist.app/api/contributor/email-pass", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "friend@example.com",
      code: "ZL-0000-0000-0000",
    }),
  }),
  url: new URL("https://ziplist.app/api/contributor/email-pass"),
  getClientAddress: () => "127.0.0.1",
});
assert.equal(
  unauthRes.status,
  401,
  "email-pass should reject unverified code/token with 401",
);

// 5. Personal Passport code detection & About tips dealer
assert.equal(isPersonalPassportCode(sampleCode), true);
assert.equal(isPersonalPassportCode("SHARED-VOUCHER"), false);

const deal1 = dealTips({ deck: [] });
assert.equal(deal1.hand.length, 3, "dealTips should deal 3 tips per open");
assert.equal(
  deal1.deck.length,
  ABOUT_TIPS.length - 3,
  "remaining deck should have total - 3 tips",
);

console.log(
  "✓ contributor codes, 4-word passkeys, license lookup, and email-pass tests passed",
);
