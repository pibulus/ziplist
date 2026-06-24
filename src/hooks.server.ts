// Content-Security-Policy for ZipList.
// - script-src allows 'unsafe-inline' because SvelteKit injects an inline
//   hydration bootstrap; tighten to nonces only if we move to kit.csp.
// - connect-src covers same-origin APIs plus PartyKit (wss/https) for live lists.
// - img-src allows data:/blob: for canvas confetti + generated avatars.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.partykit.io wss://*.partykit.io",
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
  response.headers.set("Content-Security-Policy", CSP);
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
