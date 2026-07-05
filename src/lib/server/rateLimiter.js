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
  // Production sits behind a Cloudflare tunnel, so the socket peer that
  // getClientAddress() reports is the tunnel itself — every visitor would
  // collapse into ONE shared bucket and a single heavy user could 429 the
  // whole site. Cloudflare stamps cf-connecting-ip on every proxied request
  // (a client-sent value is overwritten at the edge), so prefer it. Direct
  // origin hits could spoof it, but the tunnel is the only public path and
  // MAX_BUCKETS bounds the damage of spoofed-key floods.
  const cfIp = event.request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

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
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
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
    evictIfNeeded();
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
