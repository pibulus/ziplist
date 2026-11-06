import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import { normalizeCode } from "$lib/softstack-passport/index.js";
import { enforceRateLimit } from "$lib/server/rateLimiter.js";
import {
  generateLicenseCode,
  generatePasskeyPhrase,
} from "$lib/server/contributor/licenseCrypto.js";
import {
  isContributorCodeValid,
  normalizeContributorCode,
  parseContributorCodes,
} from "$lib/server/contributorCodes.js";
import {
  clearPasskeyFailures,
  createVoucherLicense,
  findLicenseByCode,
  isLicenseExpired,
  isPasskeyLockedOut,
  issueTokenForLicense,
  recordPasskeyFailure,
  redeemLicenseByPasskey,
} from "$lib/server/contributor/licenseStore.js";

const REDEEM_RATE_WINDOW_MS = 15 * 60_000;
const REDEEM_RATE_LIMIT = 10;

function getManualCodes() {
  return parseContributorCodes(
    env.CONTRIBUTOR_UNLOCK_CODES,
    env.CONTRIBUTOR_UNLOCK_CODE,
  );
}

export async function POST(event) {
  const rateResponse = await enforceRateLimit(event, {
    bucket: "contributor-redeem",
    windowMs: REDEEM_RATE_WINDOW_MS,
    max: REDEEM_RATE_LIMIT,
  });
  if (rateResponse) return rateResponse;

  let body;
  try {
    body = await event.request.json();
  } catch {
    return json(
      { valid: false, error: "Enter a 4-word passkey to unlock." },
      { status: 400 },
    );
  }

  try {
    const rawCode = (body?.phrase ?? body?.code ?? "").toString().trim();
    const normalizedCode = normalizeContributorCode(rawCode);

    if (!rawCode || !normalizedCode) {
      return json(
        { valid: false, error: "Enter a 4-word passkey to unlock." },
        { status: 400 },
      );
    }

    // Bare SS-/ZL- display IDs are public identifiers, never credentials.
    if (normalizeCode(rawCode)) {
      return json(
        {
          valid: false,
          error:
            "Enter a 4-word passkey to unlock. The SS- display ID is not a passkey.",
        },
        { status: 400 },
      );
    }

    if (await isPasskeyLockedOut(rawCode)) {
      return json(
        {
          valid: false,
          error: "Too many attempts for this passkey. Try again in 15 minutes.",
        },
        { status: 429 },
      );
    }

    const license = await redeemLicenseByPasskey(rawCode);
    if (license) {
      await clearPasskeyFailures(rawCode);
      const canonicalPhrase = license.checkoutId
        ? generatePasskeyPhrase(license.checkoutId)
        : generatePasskeyPhrase(rawCode);
      const canonicalCode = license.checkoutId
        ? generateLicenseCode(license.checkoutId)
        : generateLicenseCode(canonicalPhrase);

      return json({
        valid: true,
        token: issueTokenForLicense(license),
        license,
        code: canonicalCode,
        phrase: canonicalPhrase,
      });
    }

    // A lapsed Passport is not a wrong code: say what happened and when.
    const lapsed = await findLicenseByCode(rawCode);
    if (lapsed && isLicenseExpired(lapsed)) {
      const when = new Date(lapsed.expiresAt).toISOString().slice(0, 10);
      return json(
        {
          valid: false,
          expired: true,
          error: `This Passport lapsed on ${when}. Renew it and the lists open again.`,
        },
        { status: 401 },
      );
    }

    const wordCount = rawCode.split(/[\s_-]+/).filter(Boolean).length;
    if (wordCount >= 2) {
      await recordPasskeyFailure(rawCode);
      return json(
        {
          valid: false,
          error: "Check the 4-word passkey and try once more.",
        },
        { status: 401 },
      );
    }

    const manualCodes = getManualCodes();
    if (manualCodes.length === 0) {
      return json(
        {
          valid: false,
          error:
            "Contributor codes need server setup before they can run here.",
        },
        { status: 503 },
      );
    }

    if (!isContributorCodeValid(normalizedCode, manualCodes)) {
      await recordPasskeyFailure(rawCode);
      return json(
        {
          valid: false,
          error: "Check the 4-word passkey and try once more.",
        },
        { status: 401 },
      );
    }

    // Shared unlock words mint a personal license per redemption so devices
    // don't land in one shared sync room.
    const voucher = await createVoucherLicense();
    return json({
      valid: true,
      token: issueTokenForLicense(voucher.license),
      license: voucher.license,
      code: voucher.code,
      phrase: voucher.phrase,
    });
  } catch (error) {
    if (error?.code === "VOUCHER_LIMIT") {
      return json(
        { valid: false, code: error.code, error: error.message },
        { status: 410 },
      );
    }
    console.error(
      "[ContributorRedeem] Failed to redeem contributor code:",
      error,
    );
    return json(
      { valid: false, error: "Code check needs one more try in a moment." },
      { status: 500 },
    );
  }
}
