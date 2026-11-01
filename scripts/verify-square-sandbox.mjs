#!/usr/bin/env node

// End-to-end Square *sandbox* checkout verification. No real money, no email.
//
// Flow: create a real payment link through the app, pay that order with
// Square's sandbox test nonce, then deliver the real payment event to the
// webhook with a valid HMAC signature (Square cannot reach localhost, so the
// transport is the only simulated part) and assert the app issues a license.
// Replays the event once to prove idempotency.
//
// Requires the dev server to be running with SQUARE_ENVIRONMENT=sandbox and a
// matching SQUARE_WEBHOOK_SIGNATURE_KEY / SQUARE_WEBHOOK_NOTIFICATION_URL:
//   set -a; . ~/.config/fleet/keys.env; set +a
//   PUBLIC_APP_URL=http://localhost:3001 SQUARE_WEBHOOK_NOTIFICATION_URL=http://localhost:3001/api/square/webhook \
//     CONTRIBUTOR_LICENSE_SECRET=local-dev-secret-at-least-16 npm run dev
// Then: npm run smoke:square

import crypto from "node:crypto";
import { PRICING } from "../src/lib/config/pricing.js";

const APP_ORIGIN = (
  process.env.SQUARE_SMOKE_APP_ORIGIN || "http://localhost:3001"
).replace(/\/+$/, "");
const BASE =
  process.env.SQUARE_ENVIRONMENT === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
const TOKEN = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
const LOCATION = (process.env.SQUARE_LOCATION_ID || "").trim();
const VERSION = (process.env.SQUARE_API_VERSION || "2026-01-22").trim();
const SIGNATURE_KEY = (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "").trim();
const NOTIFICATION_URL = (
  process.env.SQUARE_WEBHOOK_NOTIFICATION_URL ||
  `${APP_ORIGIN}/api/square/webhook`
).trim();

const AMOUNT = Math.round(PRICING.currentPrice * 100);
const CURRENCY = PRICING.currency;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function requireSandboxConfig() {
  if (process.env.SQUARE_ENVIRONMENT !== "sandbox") {
    fail(
      "SQUARE_ENVIRONMENT must be 'sandbox' — refusing to touch production.",
    );
  }
  for (const [name, value] of Object.entries({
    SQUARE_ACCESS_TOKEN: TOKEN,
    SQUARE_LOCATION_ID: LOCATION,
    SQUARE_WEBHOOK_SIGNATURE_KEY: SIGNATURE_KEY,
  })) {
    if (!value) fail(`${name} is not set`);
  }
}

async function square(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Square-Version": VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Square ${path} ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`,
    );
  }
  return payload;
}

async function startCheckout() {
  const response = await fetch(`${APP_ORIGIN}/api/contributor/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_ORIGIN },
    body: JSON.stringify({}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.checkoutId || !payload.claimToken) {
    fail(
      `checkout creation failed ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`,
    );
  }
  return payload;
}

async function findCheckoutOrder(startedAt) {
  // A fresh payment link creates its order in DRAFT, sometimes a beat after the
  // link response. Poll briefly and pick the newest draft so an earlier run's
  // paid order can never be reused.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const payload = await square("/v2/orders/search", {
      method: "POST",
      body: JSON.stringify({
        location_ids: [LOCATION],
        query: {
          filter: {
            state_filter: { states: ["DRAFT"] },
            date_time_filter: {
              created_at: {
                start_at: new Date(Date.now() - 10 * 60_000).toISOString(),
              },
            },
          },
        },
        sort: { sort_field: "CREATED_AT", sort_order: "DESC" },
        limit: 10,
      }),
    });

    const order = (payload.orders || [])
      .filter((candidate) => candidate.total_money?.amount === AMOUNT)
      .filter((candidate) => candidate.created_at >= startedAt)
      .sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      )[0];

    if (order) return order;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return fail(`no draft ${CURRENCY} ${AMOUNT} order appeared in sandbox`);
}

// Payment links park their order in DRAFT until a buyer opens the hosted page.
// Opening it here is the headless equivalent of that page load, and keeps the
// order id the app already stored as providerOrderId.
async function openOrder(order) {
  if (order.state === "OPEN") return;
  const payload = await square(`/v2/orders/${order.id}`, {
    method: "PUT",
    body: JSON.stringify({
      order: { location_id: LOCATION, state: "OPEN", version: order.version },
    }),
  });
  if (payload.order?.state !== "OPEN") {
    fail(
      `could not open sandbox order: ${JSON.stringify(payload).slice(0, 200)}`,
    );
  }
}

async function payOrder(order) {
  const payment = await square("/v2/payments", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      source_id: "cnon:card-nonce-ok",
      amount_money: { amount: AMOUNT, currency: CURRENCY },
      order_id: order.id,
      location_id: LOCATION,
      autocomplete: true,
      buyer_email_address: "sandbox@ziplist.app",
    }),
  });
  if (payment.payment?.status !== "COMPLETED") {
    fail(`sandbox payment did not complete (${payment.payment?.status})`);
  }
  return payment.payment;
}

function sign(body) {
  return crypto
    .createHmac("sha256", SIGNATURE_KEY)
    .update(`${NOTIFICATION_URL}${body}`)
    .digest("base64");
}

async function deliver(payment) {
  const body = JSON.stringify({
    merchant_id: payment.merchant_id,
    type: "payment.updated",
    event_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    data: { type: "payment", id: payment.id, object: { payment } },
  });

  const response = await fetch(NOTIFICATION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-square-hmacsha256-signature": sign(body),
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(`webhook rejected ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function readCheckout(checkoutId, claimToken) {
  const response = await fetch(
    `${APP_ORIGIN}/api/contributor/checkout/${checkoutId}?claim_token=${encodeURIComponent(claimToken)}`,
    { headers: { Origin: APP_ORIGIN } },
  );
  return {
    status: response.status,
    payload: await response.json().catch(() => ({})),
  };
}

async function main() {
  requireSandboxConfig();
  console.log(`app=${APP_ORIGIN}`);
  console.log(`square=${BASE} location=${LOCATION.slice(0, 4)}…`);
  console.log(`webhook=${NOTIFICATION_URL}`);

  const startedAt = new Date().toISOString();
  const checkout = await startCheckout();
  console.log(`✓ payment link created (${checkout.checkoutId})`);

  const order = await findCheckoutOrder(startedAt);
  await openOrder(order);
  console.log(`✓ matched sandbox order ${order.id}`);

  const payment = await payOrder(order);
  console.log(`✓ sandbox payment COMPLETED (${payment.id})`);

  const first = await deliver(payment);
  if (first.ignored) fail("webhook ignored the payment (no matching checkout)");
  console.log("✓ signed webhook accepted");

  const paid = await readCheckout(checkout.checkoutId, checkout.claimToken);
  if (paid.payload.status !== "paid" || !paid.payload.code) {
    fail(
      `checkout not paid after webhook: ${JSON.stringify(paid.payload).slice(0, 200)}`,
    );
  }
  console.log(`✓ license issued (${paid.payload.code.slice(0, 7)}…)`);

  const second = await deliver(payment);
  if (second.ignored) fail("webhook replay was not received");
  const replay = await readCheckout(checkout.checkoutId, checkout.claimToken);
  if (replay.payload.code !== paid.payload.code) {
    fail("replay issued a different license code");
  }
  console.log("✓ webhook replay is idempotent (same code)");

  console.log("square sandbox checkout=ok");
}

main().catch((error) => fail(error.message));
