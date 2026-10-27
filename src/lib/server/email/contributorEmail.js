// ═══════════════════════════════════════════════════════════════════════════
// contributorEmail — zero-storage Passport note with 4-word passkey & QR
// ═══════════════════════════════════════════════════════════════════════════

import { env } from "$env/dynamic/private";
import { generateMemberIdentity } from "$lib/cartridges/identityUtils.js";
import { vaultHashForCode } from "$lib/server/contributor/licenseCrypto.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "ZipList <hello@ziplist.app>";
const RESEND_ONBOARDING_FROM = "ZipList <onboarding@resend.dev>";
const QR_CONTENT_ID = "ziplist-passport-qr";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254 || /[\r\n]/.test(trimmed)) return false;
  return EMAIL_PATTERN.test(trimmed);
}

export function isContributorEmailConfigured() {
  return Boolean(env.RESEND_API_KEY?.trim());
}

export function getContributorEmailFrom() {
  return (
    env.RESEND_FROM_EMAIL?.trim() ||
    env.CONTRIBUTOR_EMAIL_FROM?.trim() ||
    DEFAULT_FROM
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildUnlockLink(appOrigin, code) {
  const origin = (appOrigin || "https://ziplist.app").replace(/\/+$/, "");
  return `${origin}/u/${encodeURIComponent(code)}`;
}

export function derivePassportIdentityFromCode(code) {
  const hash = vaultHashForCode(code);
  if (!hash) return { memberName: "", phrase: "" };
  const identity = generateMemberIdentity(hash);
  return {
    memberName: identity.isFallback ? "" : identity.name,
    phrase: identity.isFallback ? "" : identity.phrase,
  };
}

/**
 * Pure builder so the copy is testable without a network.
 */
export function buildContributorEmail({
  to,
  code,
  phrase,
  memberName,
  appOrigin = "https://ziplist.app",
  hasQr = false,
}) {
  const derived = derivePassportIdentityFromCode(code);
  const cleanMemberName = memberName?.toString().trim() || "";
  const displayMemberName = cleanMemberName || derived.memberName;
  const resolvedPhrase = phrase?.toString().trim() || derived.phrase;
  const unlockKey = code || resolvedPhrase;
  const unlockUrl = buildUnlockLink(appOrigin, unlockKey);
  const subject = `ZipList Passport 🎟️ (${displayMemberName || resolvedPhrase || code})`;

  const text = [
    "Full Passport unlocked.",
    "One pass unlocks everything. No subscriptions.",
    "",
    displayMemberName ? `Passport identity: ${displayMemberName}` : null,
    hasQr ? "QR code attached." : null,
    `Unlock this device: ${unlockUrl}`,
    resolvedPhrase
      ? `4-word passkey: ${resolvedPhrase}`
      : `Passport passkey: ${code}`,
    "",
    "12 colour lists, live shared rooms, and device sync.",
    "Speak a list in one breath, share a live room to tick boxes together, or link phones and laptops with the Passport QR.",
    "",
    "Paid once, kept for good. Zero tracking.",
    "",
    "Zip up a list, lickety-split.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const safeCode = escapeHtml(code);
  const safeUrl = escapeHtml(unlockUrl);
  const safeMemberName = displayMemberName ? escapeHtml(displayMemberName) : "";
  const safePhrase = resolvedPhrase ? escapeHtml(resolvedPhrase) : "";
  const muted = "color:#525252;";
  const rule = `<tr><td style="padding:24px 0 0;"><div style="height:2px;background:#efe3c8;border-radius:2px;"></div></td></tr>`;
  const memberBadgeBlock = safeMemberName
    ? `<tr><td align="center" style="padding:12px 0 0;">
				<div style="display:inline-block;padding:6px 14px;background:#fce7f3;border:2px solid #1e1714;border-radius:999px;font-size:13px;font-weight:900;color:#1e1714;">Passport: ${safeMemberName}</div>
			</td></tr>`
    : "";
  const qrBlock = hasQr
    ? `<tr><td align="center" style="padding:22px 0 0;">
				<img src="cid:${QR_CONTENT_ID}" width="128" height="128" alt="QR code: scan to unlock" style="display:block;border:2px solid #1e1714;border-radius:14px;background:#fffef7;" />
			</td></tr>`
    : "";
  const passkeyBlock = safePhrase
    ? `<tr><td align="center" style="padding:16px 0 0;">
				<div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;${muted};padding-bottom:6px;">4-Word Passkey</div>
				<div style="display:inline-block;padding:12px 18px;background:#fff1f2;border:2px solid #1e1714;border-radius:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:17px;font-weight:800;color:#1e1714;">${safePhrase}</div>
			</td></tr>`
    : `<tr><td align="center" style="padding:16px 0 0;">
				<div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;${muted};padding-bottom:6px;">Passport Passkey</div>
				<div style="display:inline-block;padding:12px 18px;background:#fffef7;border:2px solid #1e1714;border-radius:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:800;letter-spacing:0.06em;">${safeCode}</div>
			</td></tr>`;

  const html = `<!doctype html>
<html>
	<body style="margin:0;padding:32px 16px;background:#fbf0d9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e1714;-webkit-font-smoothing:antialiased;">
		<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:420px;margin:0 auto;">
			<tr><td style="background:#fffaef;border:2px solid #1e1714;border-radius:24px;padding:34px 28px 24px;box-shadow:4px 4px 0 #1e1714;">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
					<tr><td align="center" style="font-size:12px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#db2777;">ZipList Passport</td></tr>
					<tr><td align="center" style="padding:10px 0 0;font-size:28px;line-height:1.1;font-weight:900;letter-spacing:-0.02em;">Full Passport unlocked.</td></tr>
					<tr><td align="center" style="padding:8px 0 0;font-size:14px;line-height:1.5;${muted}">One pass unlocks everything. No subscriptions.</td></tr>
					${memberBadgeBlock}

					${rule}

					${qrBlock}
					<tr><td align="center" style="padding:16px 0 0;">
						<a href="${safeUrl}" style="display:inline-block;padding:13px 24px;background:#ffb000;color:#1e1714;text-decoration:none;font-weight:900;font-size:15px;border:2px solid #1e1714;border-radius:16px;box-shadow:3px 3px 0 #1e1714;">Unlock this device</a>
					</td></tr>
					${passkeyBlock}

					${rule}

					<tr><td style="padding:22px 0 0;font-size:15px;font-weight:900;color:#db2777;">12 colour lists, live rooms, device sync.</td></tr>
					<tr><td style="padding:8px 0 0;font-size:14px;line-height:1.55;">Speak a list in one breath, share a live room to tick boxes together, or scan the Passport QR to link phones and laptops.</td></tr>
					<tr><td style="padding:14px 0 0;font-size:13px;line-height:1.5;${muted}">Paid once, kept for good. Zero tracking.</td></tr>

					${rule}

					<tr><td style="padding:20px 0 0;font-size:14px;line-height:1.35;font-weight:900;color:#db2777;text-align:center;">
						Zip up a list, lickety-split.
					</td></tr>
				</table>
			</td></tr>
		</table>
	</body>
</html>`;

  return {
    from: getContributorEmailFrom(),
    to: [to],
    subject,
    text,
    html,
  };
}

async function renderPassportQr(unlockUrl) {
  try {
    const { default: QRCode } = await import("qrcode");
    return await QRCode.toBuffer(unlockUrl, {
      type: "png",
      width: 360,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1e1714", light: "#fffef7" },
    });
  } catch (error) {
    console.warn(
      "[ContributorEmail] QR render failed, sending without it:",
      error?.message || error,
    );
    return null;
  }
}

/**
 * Sends a bespoke, warm "ZipList Passport" email with the 4-word passkey,
 * 1-tap unlock link, and inline Passport QR PNG.
 */
export async function sendContributorPassportEmail({
  to,
  code,
  phrase,
  memberName,
  appOrigin,
  appUrl,
  fetchImpl = fetch,
}) {
  if (!isContributorEmailConfigured()) {
    return { sent: false, reason: "no_resend_api_key" };
  }
  if (!to || !code) {
    return { sent: false, reason: !to ? "no_recipient_email" : "no_code" };
  }

  const origin = (appOrigin || appUrl || "https://ziplist.app").replace(
    /\/+$/,
    "",
  );

  try {
    const derived = derivePassportIdentityFromCode(code);
    const unlockUrl = buildUnlockLink(origin, code);
    const qrPng = await renderPassportQr(unlockUrl);
    const message = buildContributorEmail({
      to,
      code,
      phrase: phrase || derived.phrase,
      memberName: memberName || derived.memberName,
      appOrigin: origin,
      hasQr: Boolean(qrPng),
    });

    const attachments = [];
    if (qrPng) {
      attachments.push({
        filename: "ziplist-passport-qr.png",
        content: qrPng.toString("base64"),
        content_type: "image/png",
        content_id: QR_CONTENT_ID,
      });
    }

    const headers = {
      Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
      "Content-Type": "application/json",
    };

    const payloadBody = attachments.length
      ? { ...message, attachments }
      : { ...message };

    let response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payloadBody),
    });

    if (
      !response.ok &&
      response.status === 403 &&
      message.from !== RESEND_ONBOARDING_FROM
    ) {
      const firstDetail = await response.text().catch(() => "");
      if (firstDetail.includes("domain is not verified")) {
        console.warn(
          "[ContributorEmail] Custom sender domain not verified yet; retrying via onboarding@resend.dev",
        );
        response = await fetchImpl(RESEND_ENDPOINT, {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...payloadBody,
            from: RESEND_ONBOARDING_FROM,
          }),
        });
      } else {
        console.error(
          "[ContributorEmail] Resend rejected the email:",
          response.status,
          firstDetail,
        );
        return { sent: false, error: firstDetail };
      }
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        "[ContributorEmail] Resend rejected the email:",
        response.status,
        detail,
      );
      return { sent: false, error: detail };
    }

    const data = await response.json().catch(() => ({}));
    return { sent: true, id: data?.id };
  } catch (err) {
    console.error(
      "[ContributorEmail] Unexpected error sending email:",
      err?.message || err,
    );
    return { sent: false, error: err?.message };
  }
}

export async function sendContributorCodeEmail(options) {
  const result = await sendContributorPassportEmail(options);
  return Boolean(result?.sent);
}
