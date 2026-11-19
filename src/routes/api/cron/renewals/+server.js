import crypto from "node:crypto";
import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import {
  dueForRenewal,
  expiryForPaidAt,
} from "$lib/server/payments/renewalWindow.js";
import {
  listCheckouts,
  markRenewalReminderSent,
} from "$lib/server/payments/paymentStore.js";
import { sendRenewalEmail } from "$lib/server/email/renewalEmail.js";

function timingSafeSecretEqual(given, expected) {
  const digestA = crypto.createHash("sha256").update(String(given)).digest();
  const digestB = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function authorised(event) {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = event.request.headers.get("x-cron-secret")?.trim() || "";
  if (!given) return false;
  return timingSafeSecretEqual(given, secret);
}

export async function POST(event) {
  if (!authorised(event)) {
    return json({ error: "Not authorised." }, { status: 401 });
  }

  const appUrl = env.PUBLIC_APP_URL?.trim() || event.url.origin;
  const checkouts = await listCheckouts();
  const due = dueForRenewal(checkouts);

  let sent = 0;
  let failed = 0;

  for (const checkout of due) {
    const expiresAt = checkout.expiresAt || expiryForPaidAt(checkout.paidAt);
    const result = await sendRenewalEmail({
      to: checkout.buyerEmail,
      expiresAt,
      appUrl,
    }).catch((error) => {
      console.error("[RenewalCron] send threw:", error?.message || error);
      return { sent: false };
    });

    if (result.sent) {
      await markRenewalReminderSent(checkout.id);
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return json({ due: due.length, sent, failed });
}
