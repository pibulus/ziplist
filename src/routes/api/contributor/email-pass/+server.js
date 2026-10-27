import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { json } from "@sveltejs/kit";
import { enforceRateLimit } from "$lib/server/rateLimiter.js";
import {
  generateLicenseCode,
  generatePasskeyPhrase,
  verifyContributorToken,
} from "$lib/server/contributor/licenseCrypto.js";
import {
  findLicenseByCode,
  redeemStoredLicense,
} from "$lib/server/contributor/licenseStore.js";
import {
  isContributorEmailConfigured,
  isValidEmailAddress,
  sendContributorPassportEmail,
} from "$lib/server/email/contributorEmail.js";
import { normalizeContributorCode } from "$lib/server/contributorCodes.js";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const EMAIL_RATE_WINDOW_MS = 60_000;
const EMAIL_RATE_LIMIT = 5;

function getAppOrigin(event) {
  return (
    publicEnv.PUBLIC_APP_URL?.trim() ||
    env.APP_URL?.trim() ||
    env.URL?.trim() ||
    event.url.origin
  );
}

export const _isValidEmailAddress = isValidEmailAddress;

export async function POST(event) {
  const rateResponse = await enforceRateLimit(event, {
    bucket: "contributor-email-pass",
    windowMs: EMAIL_RATE_WINDOW_MS,
    max: EMAIL_RATE_LIMIT,
  });
  if (rateResponse) return rateResponse;

  if (!isContributorEmailConfigured()) {
    return json(
      { sent: false, error: "Passport email needs server setup first." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  let body;
  try {
    body = await event.request.json();
  } catch {
    return json(
      { sent: false, error: "Enter an email address to receive the Passport." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!isValidEmailAddress(email)) {
    return json(
      { sent: false, error: "Enter a valid email address." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const rawToken =
      event.request.headers.get("x-ziplist-contributor-token") ||
      (typeof body?.token === "string" ? body.token.trim() : "");
    let tokenClaims = null;
    if (rawToken) {
      try {
        tokenClaims = verifyContributorToken(rawToken);
      } catch {
        tokenClaims = null;
      }
    }

    const rawCode = normalizeContributorCode(body?.code);
    let canonicalCode = "";
    let canonicalPhrase = "";

    if (tokenClaims?.tier === "contributor") {
      const matchedLicense = rawCode ? await findLicenseByCode(rawCode) : null;
      if (matchedLicense?.checkoutId) {
        canonicalCode = generateLicenseCode(matchedLicense.checkoutId);
        canonicalPhrase = generatePasskeyPhrase(matchedLicense.checkoutId);
      } else if (rawCode) {
        canonicalCode = rawCode;
        canonicalPhrase = generatePasskeyPhrase(rawCode);
      }
    } else if (rawCode) {
      const activeLicense = await redeemStoredLicense(rawCode);
      if (activeLicense?.checkoutId) {
        canonicalCode = generateLicenseCode(activeLicense.checkoutId);
        canonicalPhrase = generatePasskeyPhrase(activeLicense.checkoutId);
      }
    }

    if (!canonicalCode) {
      return json(
        { sent: false, error: "Unlock the Passport first before emailing it." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    // Zero-storage dispatch: the email address is used once in memory to send
    // the Resend payload and is never persisted to disk, KV, or logs.
    const result = await sendContributorPassportEmail({
      to: email,
      code: canonicalCode,
      phrase: canonicalPhrase,
      appOrigin: getAppOrigin(event),
    });

    if (!result?.sent) {
      return json(
        {
          sent: false,
          error: "Could not send the email right now. Try again in a moment.",
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    return json({ sent: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error(
      "[ContributorEmailPass] Failed to dispatch Passport email:",
      error?.message || error,
    );
    return json(
      {
        sent: false,
        error: "Could not send the email right now. Try again in a moment.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
