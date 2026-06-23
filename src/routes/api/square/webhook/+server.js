import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import {
  extractSquarePayment,
  isSquareWebhookConfigured,
  verifySquareWebhookSignature,
} from "$lib/server/payments/squareProvider.js";
import {
  getCheckoutByProviderOrderId,
  markCheckoutPaid,
} from "$lib/server/payments/paymentStore.js";
import { createLicenseForCheckout } from "$lib/server/contributor/licenseStore.js";

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

  const checkout = await getCheckoutByProviderOrderId(payment.order_id);
  if (!checkout) {
    console.warn(
      "[SquareWebhook] Payment did not match a ZipList checkout:",
      payment.order_id,
    );
    return json({ received: true, ignored: true });
  }

  const paidCheckout = await markCheckoutPaid(payment.order_id, payment);
  if (paidCheckout) {
    // Never let a license-creation failure surface as a 500 to Square: the
    // payment is already recorded as paid, so a thrown error here just causes
    // Square to retry forever while the customer silently has no license.
    // Log loudly instead so a paid-but-no-license checkout can be recovered.
    try {
      await createLicenseForCheckout(paidCheckout);
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
