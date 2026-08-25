import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import {
  extractSquarePayment,
  isSquareWebhookConfigured,
  verifySquareWebhookSignature,
} from "$lib/server/payments/squareProvider.js";
import {
  getCheckoutById,
  getCheckoutByProviderOrderId,
  markCheckoutPaidById,
} from "$lib/server/payments/paymentStore.js";
import { createLicenseForCheckout } from "$lib/server/contributor/licenseStore.js";
import { sendContributorPassportEmail } from "$lib/server/email/contributorEmail.js";

function getNotificationUrl(event) {
  return (
    env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim() ||
    `${event.url.origin}${event.url.pathname}`
  );
}

export async function POST(event) {
  if (!isSquareWebhookConfigured()) {
    console.error("[SquareWebhook] Missing SQUARE_WEBHOOK_SIGNATURE_KEY");
    return json(
      { error: "Square webhook is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await event.request.text();
  const signature =
    event.request.headers.get("x-square-hmacsha256-signature") || "";
  const notificationUrl = getNotificationUrl(event);

  if (!verifySquareWebhookSignature({ rawBody, signature, notificationUrl })) {
    console.warn("[SquareWebhook] Invalid signature");
    return json({ error: "Invalid signature." }, { status: 403 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payment = extractSquarePayment(payload);
  if (!payment || payment.status !== "COMPLETED") {
    return json({ received: true, ignored: true });
  }

  let checkout = await getCheckoutByProviderOrderId(payment.order_id);

  if (!checkout) {
    // Square doesn't always echo order_id when the payment link is created,
    // so the stored checkout may have providerOrderId=null. Fall back to the
    // checkoutId we embed in the payment note at link-creation time.
    const noteMatch = /ZipList contributor checkout ([0-9a-f-]{36})/i.exec(
      payment.note || "",
    );
    if (noteMatch) {
      checkout = await getCheckoutById(noteMatch[1]);
    }
  }

  if (!checkout) {
    // A COMPLETED payment we can't match means someone paid and gets nothing.
    // Log at error level so it's impossible to miss when scanning logs.
    console.error(
      "[SquareWebhook] COMPLETED payment did not match any ZipList checkout:",
      payment.id,
      payment.order_id,
    );
    return json({ received: true, ignored: true });
  }

  const paidCheckout = await markCheckoutPaidById(checkout.id, payment);
  if (paidCheckout) {
    // Never let a license-creation failure surface as a 500 to Square: the
    // payment is already recorded as paid, so a thrown error here just causes
    // Square to retry forever while the customer silently has no license.
    // Log loudly instead so a paid-but-no-license checkout can be recovered.
    try {
      const { code } = await createLicenseForCheckout(paidCheckout);
      if (payment.buyer_email_address && code) {
        const appUrl = env.PUBLIC_APP_URL?.trim() || "https://ziplist.app";
        try {
          await sendContributorPassportEmail({
            to: payment.buyer_email_address,
            code,
            appUrl,
          });
        } catch (emailErr) {
          console.error(
            "[SquareWebhook] Failed to send contributor passport email:",
            emailErr,
          );
        }
      }
    } catch (error) {
      console.error(
        "[SquareWebhook] Paid checkout but license creation failed:",
        paidCheckout.id,
        error,
      );
    }
  }

  return json({ received: true });
}
