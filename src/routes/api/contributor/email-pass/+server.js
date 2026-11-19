import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { json } from "@sveltejs/kit";
import {
  normalizeCode,
  parseFourWordPasskey,
} from "$lib/softstack-passport/index.js";
import { enforceRateLimit } from "$lib/server/rateLimiter.js";
import {
  generateLicenseCode,
  generatePasskeyPhrase,
  verifyContributorToken,
} from "$lib/server/contributor/licenseCrypto.js";
import {
  clearPasskeyFailures,
  findLicenseById,
  isLicenseExpired,
  isPasskeyLockedOut,
  recordPasskeyFailure,
  redeemLicenseByPasskey,
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

    const rawInput = (body?.phrase ?? body?.code ?? "").toString().trim();
    const normalizedCode = normalizeContributorCode(rawInput);
    let canonicalCode = "";
    let canonicalPhrase = "";
    let licenseExpiry = "";

    // 1. Authenticated Passport holder: resolve STRICTLY from tokenClaims.sub
    //    so one holder can never query or exfiltrate another holder's SS- ID.
    if (tokenClaims?.tier === "contributor" && tokenClaims?.sub) {
      const ownedLicense = await findLicenseById(tokenClaims.sub);
      if (
        ownedLicense?.checkoutId &&
        ownedLicense.status === "active" &&
        !isLicenseExpired(ownedLicense)
      ) {
        const expectedPhrase = generatePasskeyPhrase(ownedLicense.checkoutId);
        const expectedCode = generateLicenseCode(expectedPhrase);
        const suppliedPhrase = parseFourWordPasskey(rawInput)?.phrase || "";

        // If the client also sent a code/phrase, ensure it matches their own license
        const matchesOwner =
          !rawInput ||
          normalizedCode === expectedCode ||
          suppliedPhrase === expectedPhrase;

        if (matchesOwner) {
          licenseExpiry = ownedLicense.expiresAt || "";
          canonicalCode = expectedCode;
          canonicalPhrase = expectedPhrase;
        }
      }
    }

    // 2. Fallback: caller proves ownership with the secret 4-word passkey
    //    (bare SS-/ZL- display IDs are public handles and NEVER unlock email-pass).
    if (!canonicalCode && rawInput && !normalizeCode(rawInput)) {
      if (await isPasskeyLockedOut(rawInput)) {
        return json(
          {
            sent: false,
            error:
              "Too many attempts for this passkey. Try again in 15 minutes.",
          },
          { status: 429, headers: NO_STORE_HEADERS },
        );
      }

      const activeLicense = await redeemLicenseByPasskey(rawInput);
      if (activeLicense?.checkoutId) {
        await clearPasskeyFailures(rawInput);
        licenseExpiry = activeLicense.expiresAt || "";
        canonicalPhrase = generatePasskeyPhrase(activeLicense.checkoutId);
        canonicalCode = generateLicenseCode(canonicalPhrase);
      } else {
        await recordPasskeyFailure(rawInput);
      }
    }

    if (!canonicalCode) {
      return json(
        { sent: false, error: "Unlock the Passport first before emailing it." },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const result = await sendContributorPassportEmail({
      to: email,
      code: canonicalCode,
      phrase: canonicalPhrase,
      appOrigin: getAppOrigin(event),
      expiresAt: licenseExpiry,
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
