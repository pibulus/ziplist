import crypto from "crypto";
import { env } from "$env/dynamic/private";
import { normalizeContributorCode } from "../contributorCodes.js";

const CODE_PREFIX = "ZL";
const TOKEN_ALG = "HS256";
const TOKEN_VERSION = 1;

export function getContributorSecret() {
  const secret =
    env.CONTRIBUTOR_LICENSE_SECRET?.trim() ||
    env.API_COOKIE_SECRET?.trim() ||
    env.API_AUTH_TOKEN?.trim();

  if (!secret || secret.length < 16) {
    throw new Error("Contributor license secret is not configured");
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
  const body = {
    ...payload,
    v: TOKEN_VERSION,
    iat: Math.floor(Date.now() / 1000),
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

  try {
    return JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
