import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import { enforceRateLimit } from "$lib/server/rateLimiter.js";
import { verifyContributorToken } from "$lib/server/contributor/licenseCrypto.js";
import {
  createLiveRoomMetadata,
  generateLiveRoomId,
  LIVE_ROOM_TIERS,
  sanitizeLiveListData,
  sanitizeLivePassword,
} from "$lib/services/realtime/liveListProtocol.js";

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
}

function getPartyKitHost(event) {
  if (dev && isLocalPartyKitHost(event.url.hostname)) {
    return `${event.url.hostname}:1999`;
  }

  const configuredHost =
    env.PARTYKIT_HOST?.trim() ||
    env.VITE_PARTYKIT_HOST?.trim() ||
    env.PUBLIC_PARTYKIT_HOST?.trim() ||
    "";

  if (configuredHost) return normalizePartyKitHost(configuredHost);
  return dev ? "localhost:1999" : "";
}

function normalizePartyKitHost(host) {
  return host.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function isLocalPartyKitHost(host) {
  const hostname = host.split(":")[0];
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function getPartyKitProtocol(host) {
  return isLocalPartyKitHost(host) ? "http" : "https";
}

function getPartyKitCreateSecret() {
  return env.PARTYKIT_CREATE_SECRET?.trim() || "";
}

export async function POST(event) {
  const rateResponse = enforceRateLimit(event);
  if (rateResponse) return rateResponse;

  // Live sharing is free for everyone (2026-07-21). Contributor gates
  // VOLUME (how many lists, how many live at once), never the feature
  // itself — the client enforces the concurrent-live cap. Rate limiting
  // above is what protects room creation from abuse, not payment status.
  // The token is still read: it sets the room TIER (supporter rooms get
  // the longer retention the PartyKit room server applies), it just no
  // longer decides whether a room may be created at all.
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

  const host = getPartyKitHost(event);
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
    const sanitizedListData = sanitizeLiveListData(listData);

    if (!sanitizedListData) {
      return json({ error: "Invalid list data." }, { status: 400 });
    }

    const roomId = generateLiveRoomId();
    const protocol = getPartyKitProtocol(host);
    const sanitizedPassword = sanitizeLivePassword(password);
    const roomMetadata = createLiveRoomMetadata({
      tier: tokenPayload ? LIVE_ROOM_TIERS.SUPPORTER : LIVE_ROOM_TIERS.FREE,
    });
    const query = sanitizedPassword
      ? `?pwd=${encodeURIComponent(sanitizedPassword)}`
      : "";
    const response = await fetch(
      `${protocol}://${host}/parties/main/${encodeURIComponent(roomId)}${query}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getPartyKitCreateSecret()
            ? { Authorization: `Bearer ${getPartyKitCreateSecret()}` }
            : {}),
        },
        body: JSON.stringify({
          listData: sanitizedListData,
          metadata: roomMetadata,
        }),
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(
        { error: payload.error || "Could not create live list." },
        { status: response.status },
      );
    }

    return json({
      ...payload,
      tier: roomMetadata.tier,
      expiresAt: roomMetadata.expiresAt,
    });
  } catch (error) {
    console.error("[LiveCreate] Failed to create live list:", error);
    return json(
      { error: "Live sharing needs one more try in a moment." },
      { status: 502 },
    );
  }
}
