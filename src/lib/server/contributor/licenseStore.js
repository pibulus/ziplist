import crypto from "crypto";
import { storage } from "../storage/index.js";
import { withStoreLock } from "../storage/storeLock.js";
import {
  generateLicenseCode,
  hashContributorCode,
  issueContributorToken,
} from "./licenseCrypto.js";

const STORE_KEY = "contributor-licenses";

async function readStore() {
  const data = (await storage.get(STORE_KEY)) || {};
  return {
    licenses: Array.isArray(data.licenses) ? data.licenses : [],
  };
}

async function writeStore(data) {
  await storage.set(STORE_KEY, data);
}

function publicLicense(license) {
  if (!license) return null;
  const safeLicense = { ...license };
  delete safeLicense.codeHash;
  return safeLicense;
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
      license.checkoutId === checkout.id ||
      (checkout.providerPaymentId &&
        license.providerPaymentId === checkout.providerPaymentId),
  );

  if (existing) {
    return {
      license: publicLicense(existing),
      code: generateLicenseCode(checkout.id),
    };
  }

  const now = new Date().toISOString();
  const license = {
    id: crypto.randomUUID(),
    codeHash: checkout.codeHash,
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
  await writeStore(store);

  return {
    license: publicLicense(license),
    code: generateLicenseCode(checkout.id),
  };
}

export async function redeemStoredLicense(code) {
  const codeHash = hashContributorCode(code);

  return withStoreLock(STORE_KEY, async () => {
    const store = await readStore();
    const license = store.licenses.find(
      (candidate) =>
        candidate.codeHash === codeHash && candidate.status === "active",
    );

    if (!license) {
      return null;
    }

    const now = new Date().toISOString();
    license.redeemedAt = license.redeemedAt || now;
    license.lastSeenAt = now;
    await writeStore(store);

    return publicLicense(license);
  });
}

export function issueTokenForLicense(license) {
  return issueContributorToken({
    sub: license.id,
    tier: license.tier || "contributor",
    source: license.source || "license",
  });
}

export function issueManualContributorToken() {
  return issueContributorToken({
    sub: "manual-contributor-code",
    tier: "contributor",
    source: "manual-code",
  });
}
