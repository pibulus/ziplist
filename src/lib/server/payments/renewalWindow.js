// Which paid Passports are close enough to lapsing to deserve a letter.
// Pure and dependency-light so it can be exercised without storage.

import { PRICING } from "$lib/config/pricing.js";

export const RENEWAL_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function expiryForPaidAt(paidAt) {
  const start = Date.parse(paidAt || "");
  if (!Number.isFinite(start)) return null;
  return new Date(start + PRICING.termDays * DAY_MS).toISOString();
}

export function isDueForRenewal(checkout, now = Date.now()) {
  if (!checkout || checkout.status !== "paid") return false;
  if (checkout.renewalReminderSentAt) return false;
  if (!checkout.buyerEmail) return false;

  const expiresAt = checkout.expiresAt || expiryForPaidAt(checkout.paidAt);
  const expiry = Date.parse(expiresAt || "");
  if (!Number.isFinite(expiry)) return false;

  // Lapsed but recent still deserves the letter; ancient ones are noise.
  return (
    expiry - now <= RENEWAL_WINDOW_DAYS * DAY_MS && now - expiry < 90 * DAY_MS
  );
}

export function dueForRenewal(checkouts, now = Date.now()) {
  return (checkouts || []).filter((checkout) => isDueForRenewal(checkout, now));
}
