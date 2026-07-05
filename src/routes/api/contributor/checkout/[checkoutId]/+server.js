import { json } from "@sveltejs/kit";
import { enforceRateLimit } from "$lib/server/rateLimiter.js";
import { getCheckoutById } from "$lib/server/payments/paymentStore.js";
import { hashSensitiveValue } from "$lib/server/contributor/licenseCrypto.js";
import {
  createLicenseForCheckout,
  issueTokenForLicense,
} from "$lib/server/contributor/licenseStore.js";

export async function GET(event) {
  const rateResponse = enforceRateLimit(event);
  if (rateResponse) return rateResponse;

  const checkoutId = event.params.checkoutId;
  const claimToken = event.url.searchParams.get("claim_token") || "";
  const checkout = await getCheckoutById(checkoutId);

  if (!checkout) {
    return json(
      { error: "Open ZipList and start contributor checkout again." },
      { status: 404 },
    );
  }

  if (
    !claimToken ||
    checkout.claimTokenHash !== hashSensitiveValue(claimToken)
  ) {
    return json(
      { error: "Open this link in the same browser used for checkout." },
      { status: 403 },
    );
  }

  if (checkout.status !== "paid") {
    return json({ status: checkout.status || "pending" });
  }

  try {
    const { license, code } = await createLicenseForCheckout(checkout);
    const token = issueTokenForLicense(license);

    return json({
      status: "paid",
      code,
      token,
      license,
    });
  } catch (error) {
    // The customer HAS paid at this point. Never surface a terminal error —
    // the success page stops polling on non-OK responses. Report "processing"
    // so it keeps polling and the next attempt (or webhook retry) can succeed.
    console.error(
      "[ContributorCheckout] Paid checkout but license issue failed:",
      checkoutId,
      error,
    );
    return json({ status: "processing" });
  }
}
