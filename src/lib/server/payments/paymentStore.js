import { storage } from "../storage/index.js";
import { expiryForPaidAt } from "./renewalWindow.js";
import { mutateWithCas } from "../storage/storeLock.js";

const STORE_KEY = "contributor-checkouts";
const UNPAID_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function normalizeStore(data) {
  return {
    checkouts: Array.isArray(data?.checkouts) ? [...data.checkouts] : [],
  };
}

function pruneStalePending(checkouts, now = Date.now()) {
  return checkouts.filter((checkout) => {
    if (checkout?.status === "paid") return true;
    const stamp = Date.parse(checkout?.updatedAt || checkout?.createdAt || "");
    if (!Number.isFinite(stamp)) return true;
    return now - stamp < UNPAID_TTL_MS;
  });
}

async function readStore() {
  const data = (await storage.get(STORE_KEY)) || {};
  return normalizeStore(data);
}

export async function saveCheckout(checkout) {
  return mutateWithCas(storage, STORE_KEY, async (raw) => {
    const store = normalizeStore(raw);
    store.checkouts = pruneStalePending(store.checkouts);
    const existingIndex = store.checkouts.findIndex(
      (candidate) => candidate.id === checkout.id,
    );

    if (existingIndex >= 0) {
      store.checkouts[existingIndex] = {
        ...store.checkouts[existingIndex],
        ...checkout,
        updatedAt: new Date().toISOString(),
      };
    } else {
      store.checkouts.push({
        ...checkout,
        createdAt: checkout.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return { nextData: store, result: checkout };
  });
}

export async function listCheckouts() {
  const store = await readStore();
  return store.checkouts;
}

export async function markRenewalReminderSent(id) {
  return mutateWithCas(storage, STORE_KEY, async (raw) => {
    const store = normalizeStore(raw);
    const idx = store.checkouts.findIndex((candidate) => candidate.id === id);
    if (idx === -1 || store.checkouts[idx].renewalReminderSentAt) {
      return { skipWrite: true, result: false };
    }
    const stamp = new Date().toISOString();
    store.checkouts[idx] = {
      ...store.checkouts[idx],
      renewalReminderSentAt: stamp,
      updatedAt: stamp,
    };
    return { nextData: store, result: true };
  });
}

export async function getCheckoutById(id) {
  const store = await readStore();
  return store.checkouts.find((checkout) => checkout.id === id) || null;
}

export async function markCheckoutEmailSent(id) {
  return mutateWithCas(storage, STORE_KEY, async (raw) => {
    const store = normalizeStore(raw);
    const idx = store.checkouts.findIndex((candidate) => candidate.id === id);
    if (idx === -1 || store.checkouts[idx].codeEmailSentAt) {
      return { skipWrite: true, result: false };
    }
    const stamp = new Date().toISOString();
    store.checkouts[idx] = {
      ...store.checkouts[idx],
      codeEmailSentAt: stamp,
      updatedAt: stamp,
    };
    return { nextData: store, result: true };
  });
}

export async function getCheckoutByProviderOrderId(providerOrderId) {
  const store = await readStore();
  return (
    store.checkouts.find(
      (checkout) => checkout.providerOrderId === providerOrderId,
    ) || null
  );
}

async function markPaid(matcher, payment) {
  return mutateWithCas(storage, STORE_KEY, async (raw) => {
    const store = normalizeStore(raw);
    const idx = store.checkouts.findIndex(matcher);
    if (idx === -1) {
      return { skipWrite: true, result: null };
    }

    const existing = store.checkouts[idx];
    const nowIso = new Date().toISOString();
    const updated = {
      ...existing,
      status: "paid",
      buyerEmail: payment?.buyer_email_address || existing.buyerEmail || null,
      expiresAt: existing.expiresAt || expiryForPaidAt(nowIso),
      providerPaymentId: payment?.id || existing.providerPaymentId || null,
      providerOrderId: existing.providerOrderId || payment?.order_id || null,
      paidAt: existing.paidAt || nowIso,
      payment: {
        id: payment?.id || null,
        status: payment?.status || null,
        orderId: payment?.order_id || existing.providerOrderId,
        amountMoney: payment?.amount_money || null,
        receiptUrl: payment?.receipt_url || null,
      },
      updatedAt: nowIso,
    };
    store.checkouts[idx] = updated;
    return { nextData: store, result: updated };
  });
}

export async function markCheckoutPaid(providerOrderId, payment) {
  return markPaid(
    (candidate) => candidate.providerOrderId === providerOrderId,
    payment,
  );
}

export async function markCheckoutPaidById(checkoutId, payment) {
  return markPaid((candidate) => candidate.id === checkoutId, payment);
}
