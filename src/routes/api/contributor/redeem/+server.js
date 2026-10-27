import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
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
  createVoucherLicense,
  issueTokenForLicense,
  redeemStoredLicense,
} from "$lib/server/contributor/licenseStore.js";

function getManualCodes() {
  return parseContributorCodes(
    env.CONTRIBUTOR_UNLOCK_CODES,
    env.CONTRIBUTOR_UNLOCK_CODE,
  );
}

export async function POST(event) {
  const rateResponse = await enforceRateLimit(event);
  if (rateResponse) return rateResponse;

  let body;
  try {
    body = await event.request.json();
  } catch {
    return json(
      { valid: false, error: "Enter a 4-word passkey or code to unlock." },
      { status: 400 },
    );
  }

  try {
    const rawCode = body?.code?.toString().trim() || "";
    const normalizedCode = normalizeContributorCode(rawCode);

    if (!normalizedCode) {
      return json(
        { valid: false, error: "Enter a 4-word passkey or code to unlock." },
        { status: 400 },
      );
    }

    const license = await redeemStoredLicense(rawCode);
    if (license) {
      const canonicalCode = license.checkoutId
        ? generateLicenseCode(license.checkoutId)
        : normalizedCode;
      const canonicalPhrase = license.checkoutId
        ? generatePasskeyPhrase(license.checkoutId)
        : generatePasskeyPhrase(canonicalCode);

      return json({
        valid: true,
        token: issueTokenForLicense(license),
        license,
        code: canonicalCode,
        phrase: canonicalPhrase,
      });
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
      return json(
        {
          valid: false,
          error: "Check the passkey or code and try once more.",
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
