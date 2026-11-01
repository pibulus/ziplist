// The renewal letter. One job: say when the Passport runs out, what happens if
// it does, and how to keep it — without a countdown timer or a discount gun.

import { env } from "$env/dynamic/private";
import { PRICING } from "$lib/config/pricing.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function buildRenewalEmail({
  expiresAt,
  appUrl = "https://ziplist.app",
}) {
  const expiresOn = formatDate(expiresAt);
  const subject = expiresOn
    ? `Your Passport runs to ${expiresOn}`
    : "Your Passport is nearly up";
  const renewUrl = `${appUrl.replace(/\/+$/, "")}/`;

  const text = [
    "ZipList Passport",
    "",
    expiresOn
      ? `The Passport on this address runs to ${expiresOn}.`
      : "The Passport on this address is nearly up.",
    "After that the extra rooms and the shared lists step back to the free shape: three lists, one live list.",
    "",
    "Nothing renews on its own, and nothing lapses loudly. If the year earned another one:",
    renewUrl,
    "",
    `Otherwise, nothing happens. The lists stay on the device.`,
    "",
    "Sent because a Passport was bought with this address.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:32px 18px;background:#fffef7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e1714;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:460px;margin:0 auto;">
      <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#ad2770;">ZipList Passport</td></tr>
      <tr><td style="padding:14px 0 0;font-size:26px;line-height:1.2;font-weight:900;letter-spacing:-0.02em;">${
        expiresOn ? `Runs to ${expiresOn}.` : "Nearly up."
      }</td></tr>
      <tr><td style="padding:12px 0 0;font-size:15px;line-height:1.55;">
        After that, the extra rooms and the shared lists step back to the free shape: three lists, one live list at a time.
      </td></tr>
      <tr><td style="padding:10px 0 0;font-size:15px;line-height:1.55;">
        Nothing renews on its own. If the year earned another one, the same button is where it always was.
      </td></tr>
      <tr><td style="padding:22px 0 0;">
        <a href="${renewUrl}" style="display:inline-block;padding:14px 22px;background:#ff6ac2;color:#1e1714;text-decoration:none;font-weight:900;font-size:15px;border:2px solid #1e1714;border-radius:14px;box-shadow:3px 3px 0 #1e1714;">Passport — ${PRICING.displayPrice} a year</a>
      </td></tr>
      <tr><td style="padding:22px 0 0;font-size:12px;line-height:1.5;color:#525252;">
        Otherwise nothing happens. The lists stay on the device.<br />
        Sent because a Passport was bought with this address.
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html, expiresOn };
}

export async function sendRenewalEmail({
  to,
  expiresAt,
  appUrl,
  fetchImpl = fetch,
}) {
  if (!env.RESEND_API_KEY?.trim()) return { sent: false, reason: "no_key" };
  if (!to) return { sent: false, reason: "no_recipient" };

  const message = buildRenewalEmail({ expiresAt, appUrl });
  const from = env.RESEND_FROM_EMAIL?.trim() || "ZipList <hello@ziplist.app>";

  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[RenewalEmail] Resend rejected:", response.status, detail);
    return { sent: false, reason: `resend_${response.status}` };
  }

  return { sent: true };
}
