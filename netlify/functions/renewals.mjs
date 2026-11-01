// Daily nudge for Passports that are about to lapse.
//
// This function is deliberately dumb: it is a clock, and the work lives in the
// app's own route so it can use the same storage and email code as everything
// else. Netlify's cron syntax is UTC; 21:00 UTC is 08:00 in Sydney.

export const config = { schedule: "0 21 * * *" };

export default async function handler() {
  const origin = (process.env.PUBLIC_APP_URL || "https://ziplist.app").replace(
    /\/+$/,
    "",
  );
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return new Response("CRON_SECRET is not set", { status: 500 });
  }

  const response = await fetch(`${origin}/api/cron/renewals`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  const body = await response.text();
  console.log("[renewals]", response.status, body);
  return new Response(body, { status: response.status });
}
