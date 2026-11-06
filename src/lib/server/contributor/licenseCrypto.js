import crypto from "crypto";
import { env } from "$env/dynamic/private";
import {
  codeInput,
  formatCode,
  idInput,
  kdfInput,
  normalizeCode,
  normalizePassphrase,
  parseFourWordPasskey,
  phraseFromHash,
  phraseInput,
} from "$lib/softstack-passport/index.js";
import { normalizeContributorCode } from "../contributorCodes.js";
import { PRICING } from "$lib/config/pricing.js";

const TOKEN_ALG = "HS256";
const TOKEN_VERSION = 1;
// This app's stamp on a SoftStack passport. Verification only accepts it.
const PASSPORT_STAMP = "ziplist";

// Server-side token lifetime. Mirrors the client lifetime pass.
const TOKEN_TTL_SECONDS = PRICING.termDays * 24 * 60 * 60;

// Minimum signing-key length. 32 chars so the HMAC key carries real entropy
// and isn't a short shared value reused from elsewhere.
const MIN_SECRET_LENGTH = 32;

export function getContributorSecret() {
  // Only the dedicated secret — no fallback to unrelated cookie/auth secrets,
  // which would silently let one credential sign contributor licenses.
  // One shared passport secret across TalkType, ZipList, QRBuddy and ProMapper.
  const canonical = env.SOFTSTACK_PASSPORT_SECRET?.trim();
  if (canonical && canonical.length >= MIN_SECRET_LENGTH) {
    return canonical;
  }

  const isProd =
    (process.env.NODE_ENV === "production" || env.NETLIFY === "true") &&
    !process.env.VITEST;
  if (!isProd) {
    const legacy = env.CONTRIBUTOR_LICENSE_SECRET?.trim();
    if (legacy && legacy.length >= MIN_SECRET_LENGTH) {
      return legacy;
    }
  }

  throw new Error(
    `SOFTSTACK_PASSPORT_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`,
  );
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function hmacHex(value, secret = getContributorSecret()) {
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex")
    .toUpperCase();
}

export function generateClaimToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSensitiveValue(value, secret = getContributorSecret()) {
  return hmacHex(value, secret).toLowerCase();
}

export function normalizePasskeyPhrase(value) {
  return normalizePassphrase(value);
}

export function vaultHashForCode(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return "";
  return crypto.createHash("sha256").update(idInput(normalized)).digest("hex");
}

export function generatePasskeyPhrase(seed, secret = getContributorSecret()) {
  const cleanSeed = seed?.toString().trim() || "";
  if (!cleanSeed) {
    throw new Error("Passkey phrase seed is required");
  }
  const parsed = parseFourWordPasskey(cleanSeed);
  if (parsed) {
    return parsed.phrase;
  }
  const digest = hmacHex(phraseInput(cleanSeed), secret).toLowerCase();
  return phraseFromHash(digest);
}

export function generateLicenseCode(seed, secret = getContributorSecret()) {
  const cleanSeed = seed?.toString().trim() || "";
  if (!cleanSeed) {
    throw new Error("License code seed is required");
  }
  const parsed = parseFourWordPasskey(cleanSeed);
  const phrase = parsed
    ? parsed.phrase
    : generatePasskeyPhrase(cleanSeed, secret);
  const digest = hmacHex(codeInput(phrase), secret);
  return formatCode(digest.slice(0, 12));
}

export function hashPasskeyPhrase(phrase, secret = getContributorSecret()) {
  const normalized = normalizePassphrase(phrase);
  if (!normalized) return "";
  return crypto
    .pbkdf2Sync(kdfInput(normalized), secret, 100_000, 32, "sha256")
    .toString("hex");
}

export function licenseIdForCheckout(
  checkoutId,
  secret = getContributorSecret(),
) {
  const hex = hmacHex(`ziplist-license-id:${checkoutId}`, secret).toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function hashContributorCode(code, secret = getContributorSecret()) {
  const normalized = normalizeContributorCode(code)
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
  return hashSensitiveValue(normalized, secret);
}

export function issueContributorToken(
  payload,
  secret = getContributorSecret(),
) {
  const header = { alg: TOKEN_ALG, typ: "JWT" };
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    v: TOKEN_VERSION,
    iat: issuedAt,
    exp: Number.isFinite(payload.exp)
      ? payload.exp
      : issuedAt + TOKEN_TTL_SECONDS,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedBody = base64url(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export function verifyContributorToken(token, secret = getContributorSecret()) {
  const [encodedHeader, encodedBody, signature] = token?.split(".") || [];
  if (!encodedHeader || !encodedBody || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let body;
  try {
    body = JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  // Reject expired tokens. Tokens issued before exp was introduced have no exp
  // and stay valid until they age past the client soft-expiry and are reissued.
  if (
    typeof body?.exp === "number" &&
    body.exp <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  // Every app signs with the same shared passport secret, so the signature alone
  // would let one app's token open all four gates. Tokens carry a `stamps` claim
  // naming their app; any present `stamps` claim must be an array naming this
  // app. Legacy tokens with no `stamps` key stay valid.
  if (
    body?.stamps !== undefined &&
    (!Array.isArray(body.stamps) || !body.stamps.includes(PASSPORT_STAMP))
  ) {
    return null;
  }

  return body;
}
