import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { json } from "@sveltejs/kit";
import { enforceRateLimit } from "$lib/server/rateLimiter.js";
import { verifyContributorToken } from "$lib/server/contributor/licenseCrypto.js";

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
}

function getPartyKitHost() {
  const configuredHost =
    env.PARTYKIT_HOST?.trim() ||
    env.VITE_PARTYKIT_HOST?.trim() ||
    env.PUBLIC_PARTYKIT_HOST?.trim() ||
    "";

  if (configuredHost) return configuredHost;
  return dev ? "localhost:1999" : "";
}

function isDevContributorBypassEnabled() {
  return dev && publicEnv.PUBLIC_FORCE_CONTRIBUTOR_MODE === "true";
}

function getPartyKitCreateSecret() {
  return env.PARTYKIT_CREATE_SECRET?.trim() || "";
}

export async function POST(event) {
  const rateResponse = enforceRateLimit(event);
  if (rateResponse) return rateResponse;

  const token = getBearerToken(event.request);
  let tokenPayload = null;

  if (token) {
    try {
      tokenPayload = verifyContributorToken(token);
    } catch (error) {
      console.warn(
        "[LiveCreate] Contributor token could not be checked:",
        error,
      );
    }
  }

  if (!tokenPayload && !isDevContributorBypassEnabled()) {
    return json(
      {
        error: "Contributor unlock is needed to make a live shared list.",
      },
      { status: 402 },
    );
  }

  const host = getPartyKitHost();
  if (!host) {
    return json(
      {
        error: "Live collaboration is not configured for this deployment yet.",
      },
      { status: 503 },
    );
  }

  try {
    const { listData, password = null } = await event.request.json();
    if (!listData?.id || !Array.isArray(listData.items)) {
      return json({ error: "Invalid list data." }, { status: 400 });
    }

    const protocol = host.includes("localhost") ? "http" : "https";
    const query = password ? `?pwd=${encodeURIComponent(password)}` : "";
    const response = await fetch(
      `${protocol}://${host}/party/listRoom${query}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getPartyKitCreateSecret()
            ? { Authorization: `Bearer ${getPartyKitCreateSecret()}` }
            : {}),
        },
        body: JSON.stringify(listData),
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(
        { error: payload.error || "Could not create live list." },
        { status: response.status },
      );
    }

    return json(payload);
  } catch (error) {
    console.error("[LiveCreate] Failed to create live list:", error);
    return json(
      { error: "Live sharing needs one more try in a moment." },
      { status: 502 },
    );
  }
}
