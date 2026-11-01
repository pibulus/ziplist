import { storage } from "../storage/index.js";
import { withStoreLock } from "../storage/storeLock.js";

const STORE_KEY = "contributor-checkouts";

async function readStore() {
  const data = (await storage.get(STORE_KEY)) || {};
  return {
    checkouts: Array.isArray(data.checkouts) ? data.checkouts : [],
  };
}

async function writeStore(data) {
  const saved = await storage.set(STORE_KEY, data);
  if (saved === false)
    throw new Error("Contributor checkout store write failed");
}

export async function saveCheckout(checkout) {
  return withStoreLock(STORE_KEY, async () => {
    const store = await readStore();
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

    await writeStore(store);
    return checkout;
  });
}

export async function getCheckoutById(id) {
  const store = await readStore();
  return store.checkouts.find((checkout) => checkout.id === id) || null;
}

// Stamp only after Resend accepts the message. Its idempotency key covers
// concurrent webhook retries; this durable stamp covers deliveries after 24h.
export async function markCheckoutEmailSent(id) {
  return withStoreLock(STORE_KEY, async () => {
    const store = await readStore();
    const checkout = store.checkouts.find((candidate) => candidate.id === id);
    if (!checkout || checkout.codeEmailSentAt) return false;
    checkout.codeEmailSentAt = new Date().toISOString();
    checkout.updatedAt = checkout.codeEmailSentAt;
    await writeStore(store);
    return true;
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
  return withStoreLock(STORE_KEY, async () => {
    const store = await readStore();
    const checkout = store.checkouts.find(matcher);

    if (!checkout) return null;

    checkout.status = "paid";
    checkout.providerPaymentId =
      payment?.id || checkout.providerPaymentId || null;
    // Backfill the order id when Square didn't return it at create time, so
    // webhook retries can match this checkout by order id next time.
    checkout.providerOrderId =
      checkout.providerOrderId || payment?.order_id || null;
    checkout.paidAt = checkout.paidAt || new Date().toISOString();
    checkout.payment = {
      id: payment?.id || null,
      status: payment?.status || null,
      orderId: payment?.order_id || checkout.providerOrderId,
      amountMoney: payment?.amount_money || null,
      receiptUrl: payment?.receipt_url || null,
    };
    checkout.updatedAt = new Date().toISOString();

    await writeStore(store);
    return checkout;
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
