// ===================================================================
// HOOKS — security headers on every server-rendered response
// ===================================================================
// CONSOLIDATED 2026-07-31. There were briefly TWO hooks files here: this one
// and a hooks.server.ts. Vite resolves .js before .ts, so the .ts — which held
// the entire Content-Security-Policy — was silently dead code. The commit that
// added this .js was itself a security fix ("ZipList was serving only HSTS");
// it had no way to see a CSP already existed next door, and adding headers is
// what removed the most important one. Verified against ziplist.app at the
// time: no Content-Security-Policy header at all.
// Keep this as the ONLY hooks.server.* file. Which of two files wins comes
// down to file extension, and that is not a thing anyone should have to
// remember at 2am.
//
// Referrer-Policy matters more here than in most apps: a live room is
// authorised by knowing its URL (/live/<roomId>), so without this, clicking an
// outbound link from inside a room leaks the room id in the Referer header to
// whoever is on the other end — the whole auth model, handed over.
//
// CSP notes:
// - script-src allows 'unsafe-inline' because SvelteKit injects an inline
//   hydration bootstrap; tighten to nonces only if we move to kit.csp.
// - connect-src covers same-origin APIs plus PartyKit (wss/https) for live
//   lists. BOTH partykit.io and partykit.dev are listed: deployed workers live
//   on *.partykit.dev (ours is ziplist.pibulus.partykit.dev), so a .io-only
//   allowlist silently blocks every live-share WebSocket in the browser while
//   the server-side API still looks healthy. Dev additionally allows
//   ws://localhost:* so `npm run dev:party` and Vite HMR aren't blocked.
//   Square checkout is a window.location redirect, not a fetch, so it needs no
//   connect-src entry; Gemini is called from the server, never the browser.
//   The HuggingFace/jsdelivr origins and 'wasm-unsafe-eval' that briefly lived
//   here were for the offline Whisper fallback, removed 2026-07-31. If offline
//   transcription ever returns it needs BOTH the model origins in connect-src
//   AND 'wasm-unsafe-eval' in script-src; the connect-src half alone gets a
//   successful download that then dies at instantiation.
// - img-src allows data:/blob: for canvas confetti + generated avatars.
//
// HEADS UP: src/routes/+page.js sets `prerender = true`, so the homepage is
// built to static HTML and served straight off the CDN — this hook never runs
// for it. Header-based CSP therefore cannot cover the main page on its own;
// netlify.toml carries a matching [[headers]] block. Change one, change both.

import { dev } from "$app/environment";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://fleetcount.pibulus.deno.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  `connect-src 'self' https://fleetcount.pibulus.deno.net https://*.partykit.io wss://*.partykit.io https://*.partykit.dev wss://*.partykit.dev${dev ? " ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

/**
 * Apply baseline security headers to a response. Shared so that both the normal
 * resolve() chain and out-of-chain error responses get the same protection.
 * @param {Response} response
 */
function applySecurityHeaders(response) {
  // Don't clobber a stricter policy a route set for itself.
  if (!response.headers.has("Content-Security-Policy")) {
    response.headers.set("Content-Security-Policy", CSP);
  }
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "microphone=(self), camera=(), geolocation=(), payment=()",
  );
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const response = await resolve(event);

  applySecurityHeaders(response);

  if (
    event.url.pathname.startsWith("/import") ||
    event.url.pathname.startsWith("/live/") ||
    event.url.pathname.startsWith("/contributor/success")
  ) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return response;
}

/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError({ error, event }) {
  const details =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ""}`
      : String(error);

  process.stderr.write(
    `Server-side error on ${event.url.pathname}\n${details}\n`,
  );

  return {
    message: "Internal Server Error",
  };
}
