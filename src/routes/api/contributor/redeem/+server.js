import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import { enforceRateLimit } from "$lib/server/rateLimiter.js";
import {
  isContributorCodeValid,
  normalizeContributorCode,
  parseContributorCodes,
} from "$lib/server/contributorCodes.js";
import {
  issueManualContributorToken,
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
  const rateResponse = enforceRateLimit(event);
  if (rateResponse) return rateResponse;

  try {
    const { code } = await event.request.json();
    const normalizedCode = normalizeContributorCode(code);

    if (!normalizedCode) {
      return json(
        { valid: false, error: "Enter your contributor code to unlock." },
        { status: 400 },
      );
    }

    const license = await redeemStoredLicense(normalizedCode);
    if (license) {
      return json({
        valid: true,
        token: issueTokenForLicense(license),
        license,
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
          error: "Check the contributor code and try once more.",
        },
        { status: 401 },
      );
    }

    return json({
      valid: true,
      token: issueManualContributorToken(),
      license: {
        id: "manual-contributor-code",
        tier: "contributor",
        source: "manual-code",
      },
    });
  } catch (error) {
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
