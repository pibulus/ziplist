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
