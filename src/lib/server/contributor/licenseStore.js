import { randomUUID } from "node:crypto";
import { env } from "$env/dynamic/private";
import { storage } from "../storage/index.js";
import { withStoreLock } from "../storage/storeLock.js";
import {
  generateLicenseCode,
  generatePasskeyPhrase,
  hashContributorCode,
  issueContributorToken,
  licenseIdForCheckout,
  normalizePasskeyPhrase,
} from "./licenseCrypto.js";

const STORE_KEY = "contributor-licenses";
const VOUCHER_MINTS_KEY = "voucher-mints";

function passkeyKey(phraseHash) {
  return `passkey:${phraseHash}`;
}

async function readStore() {
  const data = (await storage.get(STORE_KEY)) || {};
  return {
    licenses: Array.isArray(data.licenses) ? data.licenses : [],
    passkeys:
      data.passkeys && typeof data.passkeys === "object"
        ? { ...data.passkeys }
        : {},
  };
}

async function writeStore(data) {
  await storage.set(STORE_KEY, data);
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
  const normalizedPhrase = normalizePasskeyPhrase(clean);
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

export async function findLicenseByCode(code) {
  if (!code) return null;
  const store = await readStore();

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

  return withStoreLock(STORE_KEY, () => createLicenseLocked(checkout));
}

async function createLicenseLocked(checkout) {
  const store = await readStore();
  const existing = store.licenses.find(
    (license) =>
      license.codeHash === checkout.codeHash ||
      license.checkoutId === checkout.id ||
      (checkout.providerPaymentId &&
        license.providerPaymentId === checkout.providerPaymentId),
  );

  if (existing) {
    const canonicalSeed = existing.checkoutId || checkout.id;
    const code = generateLicenseCode(canonicalSeed);
    const phrase = generatePasskeyPhrase(canonicalSeed);
    const phraseHash = hashContributorCode(phrase);

    if (
      existing.phraseHash !== phraseHash ||
      store.passkeys[passkeyKey(phraseHash)] !== existing.codeHash
    ) {
      existing.phraseHash = phraseHash;
      store.passkeys[passkeyKey(phraseHash)] = existing.codeHash;
      await writeStore(store);
    }
    await indexPasskey(phraseHash, existing.codeHash);

    return {
      license: publicLicense(existing),
      code,
      phrase,
    };
  }

  const code = generateLicenseCode(checkout.id);
  const phrase = generatePasskeyPhrase(checkout.id);
  const phraseHash = hashContributorCode(phrase);
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
    redeemedAt: null,
    lastSeenAt: null,
  };

  store.licenses.push(license);
  store.passkeys[passkeyKey(phraseHash)] = checkout.codeHash;
  await writeStore(store);
  await indexPasskey(phraseHash, checkout.codeHash);

  return {
    license: publicLicense(license),
    code,
    phrase,
  };
}

export async function redeemStoredLicense(code) {
  if (!code) return null;

  return withStoreLock(STORE_KEY, async () => {
    const store = await readStore();
    let matchedLicense = null;

    for (const candidate of codeCandidates(code)) {
      const candidateHash = hashContributorCode(candidate);
      const candidateLicense = await lookupStoredLicenseByHash(
        candidateHash,
        store,
      );
      if (candidateLicense?.status === "active") {
        matchedLicense = candidateLicense;
        break;
      }
    }

    if (!matchedLicense) {
      return null;
    }

    const now = new Date().toISOString();
    matchedLicense.redeemedAt = matchedLicense.redeemedAt || now;
    matchedLicense.lastSeenAt = now;

    if (matchedLicense.checkoutId) {
      const phrase = generatePasskeyPhrase(matchedLicense.checkoutId);
      const phraseHash = hashContributorCode(phrase);
      matchedLicense.phraseHash = phraseHash;
      store.passkeys[passkeyKey(phraseHash)] = matchedLicense.codeHash;
      await indexPasskey(phraseHash, matchedLicense.codeHash);
    }

    await writeStore(store);
    return publicLicense(matchedLicense);
  });
}

export function issueTokenForLicense(license) {
  return issueContributorToken({
    sub: license.id,
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
  return withStoreLock(VOUCHER_MINTS_KEY, async () => {
    const data = (await storage.get(VOUCHER_MINTS_KEY)) || { count: 0 };
    const count = data?.count || 0;
    if (count >= max) return false;
    await storage.set(VOUCHER_MINTS_KEY, { count: count + 1 });
    return true;
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
