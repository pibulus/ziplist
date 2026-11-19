import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";

const RATE_LIMIT_WINDOW_MS = Number(env.API_RATE_WINDOW_MS ?? "60000");
const RATE_LIMIT_MAX = Number(env.API_RATE_LIMIT ?? "30");

// Hard cap on tracked keys so a flood of unique IPs (e.g. spoofed
// X-Forwarded-For values) can't grow the Map without bound. When exceeded we
// evict the oldest entries (Map preserves insertion order).
const MAX_BUCKETS = Number(env.API_RATE_MAX_BUCKETS ?? "10000");

const buckets = new Map();

function getClientKey(event) {
  // On Netlify Edge (`ziplist.app`), `x-nf-client-connection-ip` is stamped by
  // Netlify and cannot be spoofed by clients, whereas `cf-connecting-ip` is NOT
  // stripped when Cloudflare does not sit in front. Only trust `cf-connecting-ip`
  // when explicitly running behind a Cloudflare Tunnel (`TRUST_CF_CONNECTING_IP=true`).
  const nfIp = event.request.headers.get("x-nf-client-connection-ip")?.trim();
  if (nfIp) return nfIp;

  if (env.TRUST_CF_CONNECTING_IP === "true") {
    const cfIp = event.request.headers.get("cf-connecting-ip")?.trim();
    if (cfIp) return cfIp;
  }

  if (event.getClientAddress) {
    try {
      const address = event.getClientAddress();
      if (address) return address;
    } catch {
      // adapter can throw once the underlying socket is gone
    }
  }

  const forwarded = event.request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return "unknown";
}

function clearExpired(now) {
  for (const [key, entry] of buckets.entries()) {
    const windowMs = entry.windowMs ?? RATE_LIMIT_WINDOW_MS;
    if (now - entry.windowStart > windowMs) {
      buckets.delete(key);
    }
  }
}

// Background sweep so stale entries are reclaimed even when the limited
// endpoint goes quiet (clearExpired alone only runs on incoming requests).
// `unref` keeps this timer from holding the process open. Guard for non-Node
// runtimes (e.g. edge) where setInterval/unref may be absent.
if (RATE_LIMIT_WINDOW_MS > 0 && typeof setInterval === "function") {
  const sweep = setInterval(
    () => clearExpired(Date.now()),
    RATE_LIMIT_WINDOW_MS,
  );
  if (typeof sweep?.unref === "function") sweep.unref();
}

// Evict oldest entries once the Map exceeds the cap.
function evictIfNeeded() {
  if (buckets.size <= MAX_BUCKETS) return;
  const overflow = buckets.size - MAX_BUCKETS;
  let removed = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (++removed >= overflow) break;
  }
}

export function enforceRateLimit(event, options = {}) {
  const windowMs = Number(options.windowMs ?? RATE_LIMIT_WINDOW_MS);
  const max = Number(options.max ?? RATE_LIMIT_MAX);
  const bucket = options.bucket || "global";

  if (max <= 0 || windowMs <= 0) {
    return null;
  }

  const now = Date.now();
  clearExpired(now);

  const key = `${bucket}:${getClientKey(event)}`;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now, windowMs });
    evictIfNeeded();
    return null;
  }

  existing.count += 1;
  buckets.set(key, existing);

  if (existing.count > max) {
    const retryAfterMs = Math.max(0, windowMs - (now - existing.windowStart));
    return json(
      {
        error: "Too many requests. Slow down a little.",
        retry_after_ms: retryAfterMs,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        },
      },
    );
  }

  return null;
}
