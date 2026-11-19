import crypto from "node:crypto";
import { json } from "@sveltejs/kit";
import { enforceRateLimit } from "$lib/server/rateLimiter.js";
import { getCheckoutById } from "$lib/server/payments/paymentStore.js";
import { hashSensitiveValue } from "$lib/server/contributor/licenseCrypto.js";
import {
  createLicenseForCheckout,
  issueTokenForLicense,
} from "$lib/server/contributor/licenseStore.js";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function timingSafeHexEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(event) {
  const rateResponse = await enforceRateLimit(event);
  if (rateResponse) return rateResponse;

  const checkoutId = event.params.checkoutId;
  const claimToken =
    event.request.headers.get("x-claim-token") ||
    event.url.searchParams.get("claim_token") ||
    "";
  const checkout = await getCheckoutById(checkoutId);

  if (!checkout) {
    return json(
      { error: "Open ZipList and start Passport checkout again." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  if (
    !claimToken ||
    !timingSafeHexEqual(checkout.claimTokenHash, hashSensitiveValue(claimToken))
  ) {
    return json(
      { error: "Open this link in the same browser used for checkout." },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  if (checkout.status !== "paid") {
    return json(
      { status: checkout.status || "pending" },
      { headers: NO_STORE_HEADERS },
    );
  }

  try {
    const { license, code, phrase } = await createLicenseForCheckout(checkout);
    const token = issueTokenForLicense(license);

    return json(
      {
        status: "paid",
        code,
        phrase,
        token,
        license,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error(
      "[ContributorCheckout] Paid checkout but license issue failed:",
      checkoutId,
      error,
    );
    return json({ status: "processing" }, { headers: NO_STORE_HEADERS });
  }
}
