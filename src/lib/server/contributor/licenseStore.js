import { createHash, randomUUID } from "node:crypto";
import { env } from "$env/dynamic/private";
import { storage } from "../storage/index.js";
import { mutateWithCas } from "../storage/storeLock.js";
import { parseFourWordPasskey } from "$lib/softstack-passport/identity.js";
import { PRICING } from "$lib/config/pricing.js";
import {
  generateLicenseCode,
  generatePasskeyPhrase,
  hashContributorCode,
  hashPasskeyPhrase,
  issueContributorToken,
  licenseIdForCheckout,
  normalizePasskeyPhrase,
} from "./licenseCrypto.js";

const STORE_KEY = "contributor-licenses";
const VOUCHER_MINTS_KEY = "voucher-mints";
const PASSKEY_LOCKOUT_WINDOW_MS = 15 * 60_000;
const PASSKEY_LOCKOUT_MAX = 5;

function passkeyKey(phraseHash) {
  return `passkey:${phraseHash}`;
}

function passkeyLockoutKey(rawPhrase) {
  const normalized = normalizePasskeyPhrase(rawPhrase);
  if (!normalized) return "";
  const digest = createHash("sha256")
    .update(`passkey-lockout:${normalized}`)
    .digest("hex");
  return `passkey-lockout:${digest}`;
}

export async function isPasskeyLockedOut(rawPhrase) {
  const key = passkeyLockoutKey(rawPhrase);
  if (!key) return false;
  const entry = await storage.get(key);
  if (!entry) return false;
  if (Date.now() - (entry.windowStart || 0) > PASSKEY_LOCKOUT_WINDOW_MS) {
    return false;
  }
  return (entry.count || 0) >= PASSKEY_LOCKOUT_MAX;
}

export async function recordPasskeyFailure(rawPhrase) {
  const key = passkeyLockoutKey(rawPhrase);
  if (!key) return null;
  return mutateWithCas(storage, key, async (data) => {
    const now = Date.now();
    const expired =
      !data || now - (data.windowStart || 0) > PASSKEY_LOCKOUT_WINDOW_MS;
    const next = expired
      ? { count: 1, windowStart: now }
      : { count: (data.count || 0) + 1, windowStart: data.windowStart };
    return { nextData: next, result: next };
  });
}

export async function clearPasskeyFailures(rawPhrase) {
  const key = passkeyLockoutKey(rawPhrase);
  if (!key) return;
  await mutateWithCas(storage, key, async (data) => {
    if (!data || data.count === 0) {
      return { skipWrite: true, result: null };
    }
    const next = { count: 0, windowStart: Date.now() };
    return { nextData: next, result: next };
  });
}

function normalizeLicenseStore(data) {
  return {
    licenses: Array.isArray(data?.licenses) ? [...data.licenses] : [],
    passkeys:
      data?.passkeys && typeof data.passkeys === "object"
        ? { ...data.passkeys }
        : {},
  };
}

async function readStore() {
  const data = (await storage.get(STORE_KEY)) || {};
  return normalizeLicenseStore(data);
}

function publicLicense(license) {
  if (!license) return null;
  const safeLicense = { ...license };
  delete safeLicense.codeHash;
  delete safeLicense.phraseHash;
  return safeLicense;
}

function codeCandidates(code) {
  if (!code) return [];
  const clean = code.toString().trim();
  const stripped = clean.replace(/^ZL[-_\s]?/i, "").replace(/[-\s_]/g, "");
  const normalizedPhrase =
    parseFourWordPasskey(clean)?.phrase || normalizePasskeyPhrase(clean);
  const candidates = [
    clean,
    normalizedPhrase,
    clean.replace(/[-\s_]/g, ""),
    clean.replace(/^ZL[-_\s]?/i, ""),
    `ZL-${clean.replace(/^ZL[-_\s]?/i, "")}`,
  ].filter(Boolean);
  if (stripped.length === 12) {
    candidates.push(
      `ZL-${stripped.slice(0, 4)}-${stripped.slice(4, 8)}-${stripped.slice(8, 12)}`,
    );
  }
  return [...new Set(candidates)];
}

export async function indexPasskey(phraseHash, codeHash) {
  if (!phraseHash || !codeHash) return null;
  const key = passkeyKey(phraseHash);
  await storage.set(key, { codeHash });
  return { codeHash };
}

export async function lookupCodeHashByPasskey(phraseHash) {
  if (!phraseHash) return null;
  const ref = await storage.get(passkeyKey(phraseHash));
  if (ref?.codeHash) return ref.codeHash;

  const store = await readStore();
  if (store.passkeys?.[passkeyKey(phraseHash)]) {
    return store.passkeys[passkeyKey(phraseHash)];
  }
  const matched = store.licenses.find(
    (candidate) => candidate.phraseHash === phraseHash,
  );
  return matched?.codeHash || null;
}

async function lookupStoredLicenseByHash(candidateHash, store) {
  const direct = store.licenses.find(
    (candidate) =>
      candidate.codeHash === candidateHash ||
      candidate.phraseHash === candidateHash,
  );
  if (direct) return direct;

  const linkedCodeHash =
    store.passkeys?.[passkeyKey(candidateHash)] ||
    (await storage.get(passkeyKey(candidateHash)))?.codeHash;
  if (linkedCodeHash) {
    const linked = store.licenses.find(
      (candidate) => candidate.codeHash === linkedCodeHash,
    );
    if (linked) return linked;
  }

  return null;
}

export async function findLicenseById(id) {
  if (!id || typeof id !== "string") return null;
  const store = await readStore();
  const matched = store.licenses.find((candidate) => candidate.id === id);
  return matched ? publicLicense(matched) : null;
}

export async function findLicenseByCode(code) {
  if (!code) return null;
  const store = await readStore();

  const parsed = parseFourWordPasskey(code);
  if (parsed) {
    const kdfMatched = await lookupStoredLicenseByHash(
      hashPasskeyPhrase(parsed.phrase),
      store,
    );
    if (kdfMatched) return publicLicense(kdfMatched);
    const legacyMatched = await lookupStoredLicenseByHash(
      hashContributorCode(parsed.phrase),
      store,
    );
    if (legacyMatched) return publicLicense(legacyMatched);
    return null;
  }

  for (const candidate of codeCandidates(code)) {
    const candidateHash = hashContributorCode(candidate);
    const matched = await lookupStoredLicenseByHash(candidateHash, store);
    if (matched) return publicLicense(matched);
  }

  return null;
}

export async function createLicenseForCheckout(checkout) {
  if (!checkout?.id || !checkout?.codeHash) {
    throw new Error("Checkout is missing license data");
  }

  let indexTarget = null;
  const result = await mutateWithCas(storage, STORE_KEY, async (raw) => {
    const store = normalizeLicenseStore(raw);
    const existingIdx = store.licenses.findIndex(
      (license) =>
        license.codeHash === checkout.codeHash ||
        license.checkoutId === checkout.id ||
        (checkout.providerPaymentId &&
          license.providerPaymentId === checkout.providerPaymentId),
    );

    if (existingIdx >= 0) {
      const existing = { ...store.licenses[existingIdx] };
      const canonicalSeed = existing.checkoutId || checkout.id;
      const phrase = generatePasskeyPhrase(canonicalSeed);
      const code = generateLicenseCode(phrase);
      const phraseHash = hashPasskeyPhrase(phrase);
      indexTarget = { phraseHash, codeHash: existing.codeHash };

      if (
        existing.phraseHash !== phraseHash ||
        store.passkeys[passkeyKey(phraseHash)] !== existing.codeHash
      ) {
        existing.phraseHash = phraseHash;
        store.licenses[existingIdx] = existing;
        store.passkeys[passkeyKey(phraseHash)] = existing.codeHash;
        return {
          nextData: store,
          result: { license: publicLicense(existing), code, phrase },
        };
      }

      return {
        skipWrite: true,
        result: { license: publicLicense(existing), code, phrase },
      };
    }

    const phrase = generatePasskeyPhrase(checkout.id);
    const code = generateLicenseCode(phrase);
    const phraseHash = hashPasskeyPhrase(phrase);
    const now = new Date().toISOString();
    const license = {
      id: licenseIdForCheckout(checkout.id),
      codeHash: checkout.codeHash,
      phraseHash,
      tier: "contributor",
      status: "active",
      source: checkout.provider || "unknown",
      checkoutId: checkout.id,
      providerPaymentId: checkout.providerPaymentId || null,
      providerOrderId: checkout.providerOrderId || null,
      amount: checkout.amount || null,
      currency: checkout.currency || null,
      createdAt: now,
      expiresAt: new Date(
        Date.parse(now) + PRICING.termDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      redeemedAt: null,
      lastSeenAt: null,
    };

    store.licenses.push(license);
    store.passkeys[passkeyKey(phraseHash)] = checkout.codeHash;
    indexTarget = { phraseHash, codeHash: checkout.codeHash };

    return {
      nextData: store,
      result: { license: publicLicense(license), code, phrase },
    };
  });

  if (indexTarget) {
    await indexPasskey(indexTarget.phraseHash, indexTarget.codeHash);
  }
  return result;
}

export function licenseExpiresAt(license) {
  return license?.expiresAt ? Date.parse(license.expiresAt) : null;
}

export function isLicenseExpired(license, now = Date.now()) {
  const expiry = licenseExpiresAt(license);
  return expiry !== null && Number.isFinite(expiry) && expiry <= now;
}

export async function redeemStoredLicense(code) {
  if (!code) return null;

  let indexTarget = null;
  const redeemed = await mutateWithCas(storage, STORE_KEY, async (raw) => {
    const store = normalizeLicenseStore(raw);
    let matchedLicense = null;

    const parsed = parseFourWordPasskey(code);
    if (parsed) {
      const kdfCandidate = await lookupStoredLicenseByHash(
        hashPasskeyPhrase(parsed.phrase),
        store,
      );
      if (
        kdfCandidate?.status === "active" &&
        !isLicenseExpired(kdfCandidate)
      ) {
        matchedLicense = kdfCandidate;
      } else {
        const legacyCandidate = await lookupStoredLicenseByHash(
          hashContributorCode(parsed.phrase),
          store,
        );
        if (
          legacyCandidate?.status === "active" &&
          !isLicenseExpired(legacyCandidate)
        ) {
          matchedLicense = legacyCandidate;
        }
      }
    } else {
      for (const candidate of codeCandidates(code)) {
        const candidateHash = hashContributorCode(candidate);
        const candidateLicense = await lookupStoredLicenseByHash(
          candidateHash,
          store,
        );
        if (
          candidateLicense?.status === "active" &&
          !isLicenseExpired(candidateLicense)
        ) {
          matchedLicense = candidateLicense;
          break;
        }
      }
    }

    if (!matchedLicense) {
      return { skipWrite: true, result: null };
    }

    const idx = store.licenses.findIndex(
      (item) => item.id === matchedLicense.id,
    );
    const updated = { ...matchedLicense };
    const now = new Date().toISOString();
    updated.redeemedAt = updated.redeemedAt || now;
    updated.lastSeenAt = now;

    if (updated.checkoutId) {
      const phrase = generatePasskeyPhrase(updated.checkoutId);
      const phraseHash = hashPasskeyPhrase(phrase);
      updated.phraseHash = phraseHash;
      store.passkeys[passkeyKey(phraseHash)] = updated.codeHash;
      indexTarget = { phraseHash, codeHash: updated.codeHash };
    }

    if (idx >= 0) store.licenses[idx] = updated;
    return { nextData: store, result: publicLicense(updated) };
  });

  if (redeemed && indexTarget) {
    await indexPasskey(indexTarget.phraseHash, indexTarget.codeHash);
  }
  return redeemed;
}

export async function redeemLicenseByPasskey(rawPhrase) {
  const parsed = parseFourWordPasskey(rawPhrase);
  if (!parsed) return null;
  return redeemStoredLicense(parsed.phrase);
}

export function issueTokenForLicense(license) {
  return issueContributorToken({
    sub: license.id,
    stamps: ["ziplist"],
    app: "ziplist",
    tier: license.tier || "contributor",
    source: license.source || "license",
  });
}

// A shared unlock word is a voucher, not a passport. The passport code is the
// Device Sync room, so everyone who typed the same word would share one room
// if we derived a deterministic license from the word. Each redeem mints a
// personal license up to CONTRIBUTOR_VOUCHER_LIMIT (default 25).
async function claimVoucherSlot() {
  const raw = Number(env.CONTRIBUTOR_VOUCHER_LIMIT);
  const max = Number.isFinite(raw) && raw >= 0 ? raw : 25;
  return mutateWithCas(storage, VOUCHER_MINTS_KEY, async (data) => {
    const count = data?.count || 0;
    if (count >= max) {
      return { skipWrite: true, result: false };
    }
    return { nextData: { count: count + 1 }, result: true };
  });
}

export async function createVoucherLicense() {
  if (!(await claimVoucherSlot())) {
    const error = new Error("This unlock word has been fully claimed.");
    error.code = "VOUCHER_LIMIT";
    throw error;
  }
  const id = `voucher_${randomUUID()}`;
  const code = generateLicenseCode(id);
  const codeHash = hashContributorCode(code);
  return createLicenseForCheckout({
    id,
    codeHash,
    provider: "voucher",
  });
}

export function issueManualContributorToken() {
  return issueContributorToken({
    sub: "manual-contributor-code",
    tier: "contributor",
    source: "manual-code",
  });
}
