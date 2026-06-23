import crypto from "crypto";
import { env } from "$env/dynamic/private";
import { normalizeContributorCode } from "../contributorCodes.js";

const CODE_PREFIX = "ZL";
const TOKEN_ALG = "HS256";
const TOKEN_VERSION = 1;

// Server-side token lifetime. Mirrors the client soft-expiry so a leaked token
// can't outlive the secret — it stops verifying a year after it was issued.
const TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;

// Minimum signing-key length. 32 chars so the HMAC key carries real entropy
// and isn't a short shared value reused from elsewhere.
const MIN_SECRET_LENGTH = 32;

export function getContributorSecret() {
  // Only the dedicated secret — no fallback to unrelated cookie/auth secrets,
  // which would silently let one credential sign contributor licenses.
  const secret = env.CONTRIBUTOR_LICENSE_SECRET?.trim();

  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `CONTRIBUTOR_LICENSE_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`,
    );
  }

  return secret;
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

export function generateLicenseCode(seed, secret = getContributorSecret()) {
  const digest = hmacHex(`ziplist-contributor-license:${seed}`, secret);
  return `${CODE_PREFIX}-${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}`;
}

export function hashContributorCode(code, secret = getContributorSecret()) {
  return hashSensitiveValue(normalizeContributorCode(code), secret);
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
    exp: issuedAt + TOKEN_TTL_SECONDS,
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

  return body;
}
