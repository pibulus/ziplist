/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const response = await resolve(event);

  response.headers.set(
    "Permissions-Policy",
    "microphone=(self), camera=(), geolocation=(), payment=()",
  );

  if (
    event.url.pathname.startsWith("/import") ||
    event.url.pathname.startsWith("/live/")
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
