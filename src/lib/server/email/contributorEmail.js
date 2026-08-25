import { env } from "$env/dynamic/private";

/**
 * Sends a bespoke, warm "ZipList Contributor Passport" email with the user's
 * 4-word unlock code and a 1-tap magic unlock link.
 */
export async function sendContributorPassportEmail({
  to,
  code,
  appUrl = "https://ziplist.app",
}) {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey || !to) {
    return {
      sent: false,
      reason: !apiKey ? "no_resend_api_key" : "no_recipient_email",
    };
  }

  const magicLink = `${appUrl.replace(/\/$/, "")}?unlock=${encodeURIComponent(code)}`;
  const fromAddress =
    env.RESEND_FROM_EMAIL?.trim() || "ZipList <hello@ziplist.app>";

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your ZipList Contributor Pass</title>
  </head>
  <body style="margin:0; padding:24px; background:#fff6e6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e1714;">
    <div style="max-width:540px; margin:0 auto; background:#ffffff; border:3px solid #1e1714; border-radius:24px; box-shadow:8px 8px 0 #1e1714; padding:32px;">
      
      <div style="display:inline-block; background:#ffb000; color:#1e1714; border:2px solid #1e1714; border-radius:12px; font-weight:900; font-size:14px; padding:6px 14px; margin-bottom:20px;">
        ZIPLIST CONTRIBUTOR
      </div>

      <h1 style="margin:0 0 16px; font-size:24px; font-weight:900; color:#1e1714; letter-spacing:-0.5px;">
        You're officially unlocked! 🎟️
      </h1>

      <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#4a3f35;">
        Thanks for supporting ZipList! Your sovereign contributor pass is active. Here is your permanent unlock phrase:
      </p>

      <div style="background:#fffaf0; border:2px dashed #ff82c3; border-radius:16px; padding:20px; text-align:center; margin-bottom:24px;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; font-weight:800; color:#ff6ac2; margin-bottom:8px;">
          Your 4-Word Passcode
        </div>
        <div style="font-family:'Courier New', monospace; font-size:20px; font-weight:900; color:#1e1714; word-break:break-all;">
          ${code}
        </div>
      </div>

      <div style="text-align:center; margin-bottom:28px;">
        <a href="${magicLink}" style="display:inline-block; background:#ffb000; color:#1e1714; text-decoration:none; font-weight:900; font-size:16px; padding:14px 28px; border:2px solid #1e1714; border-radius:16px; box-shadow:4px 4px 0 #1e1714;">
          1-Tap Unlock on Any Device &rarr;
        </a>
      </div>

      <div style="border-top:2px solid rgba(30,23,20,0.08); padding-top:20px; font-size:13px; line-height:1.6; color:#6b5f54;">
        <p style="margin:0 0 8px; font-weight:800; color:#1e1714;">What this pass gives you:</p>
        <ul style="margin:0 0 16px; padding-left:20px;">
          <li>Up to 12 custom color lists (instead of 3)</li>
          <li>Unlimited live shared rooms with real-time sync</li>
          <li>No subscriptions, no accounts, and no data harvesting</li>
        </ul>
        <p style="margin:0; font-size:12px; color:#8c7e72;">
          Keep this email! You can use your 4-word code or the button above to restore your pass on any phone, laptop, or tablet.
        </p>
      </div>

      <div style="margin-top:28px; border-top:1px solid rgba(30,23,20,0.08); padding-top:16px; font-size:12px; color:#8c7e72; text-align:center;">
        Made with soul by <a href="https://madebypablo.app" style="color:#1e1714; font-weight:700;">Pablo</a> in Melbourne &bull; <a href="https://ziplist.app" style="color:#1e1714; font-weight:700;">ziplist.app</a>
      </div>

    </div>
  </body>
</html>`;

  const text = `Hey!

Thanks for supporting ZipList. Your sovereign contributor pass is officially unlocked!

Your 4-Word Passcode:
${code}

1-Tap Magic Unlock Link:
${magicLink}

What your pass unlocks:
- Up to 12 custom color lists
- Unlimited live shared rooms with real-time sync
- No subscriptions, no accounts, zero tracking

Keep this email to unlock ZipList on any phone, laptop, or tablet anytime.

Cheers,
Pablo • Melbourne
https://madebypablo.app`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject: "Your ZipList Contributor Pass 🎟️",
        html,
        text,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[ContributorEmail] Failed to send via Resend:", data);
      return { sent: false, error: data };
    }

    return { sent: true, id: data.id };
  } catch (err) {
    console.error("[ContributorEmail] Unexpected error sending email:", err);
    return { sent: false, error: err?.message };
  }
}
