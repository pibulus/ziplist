import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";

const RATE_LIMIT_WINDOW_MS = Number(env.API_RATE_WINDOW_MS ?? "60000");
const RATE_LIMIT_MAX = Number(env.API_RATE_LIMIT ?? "30");

const buckets = new Map();

function getClientKey(event) {
  if (event.getClientAddress) {
    const address = event.getClientAddress();
    if (address) return address;
  }

  const forwarded = event.request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return event.request.headers.get("cf-connecting-ip") ?? "unknown";
}

function clearExpired(now) {
  for (const [key, entry] of buckets.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

export function enforceRateLimit(event) {
  if (RATE_LIMIT_MAX <= 0 || RATE_LIMIT_WINDOW_MS <= 0) {
    return null;
  }

  const now = Date.now();
  clearExpired(now);

  const key = getClientKey(event);
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return null;
  }

  existing.count += 1;
  buckets.set(key, existing);

  if (existing.count > RATE_LIMIT_MAX) {
    return json(
      {
        error: "Too many requests. Slow down a little.",
        retry_after_ms: RATE_LIMIT_WINDOW_MS - (now - existing.windowStart),
      },
      { status: 429 },
    );
  }

  return null;
}
