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

// Called by the daily Netlify scheduled function, not by people. The secret is
// the only thing standing between this and anyone mailing every customer.
function authorised(event) {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given =
    event.request.headers.get("x-cron-secret") ||
    event.url.searchParams.get("key") ||
    "";
  return given === secret;
}

async function run(event) {
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

export async function GET(event) {
  return run(event);
}

export async function POST(event) {
  return run(event);
}
