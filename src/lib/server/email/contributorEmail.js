// ═══════════════════════════════════════════════════════════════════════════
// contributorEmail — zero-storage Passport note with 4-word passkey & QR
// ═══════════════════════════════════════════════════════════════════════════

import { env } from "$env/dynamic/private";
import { generateMemberIdentity } from "$lib/cartridges/identityUtils.js";
import { vaultHashForCode } from "$lib/server/contributor/licenseCrypto.js";
import { ZIPLIST_EMAIL_PNG_BASE64 } from "./ziplistEmailImage.js";
import { renderPassportCardPng } from "./passportCard.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "ZipList <hello@ziplist.app>";
const QR_CONTENT_ID = "ziplist-passport-qr";
const ICON_CONTENT_ID = "ziplist-mark";
const CARD_CONTENT_ID = "ziplist-passport-card";
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
  hasCard = false,
}) {
  const derived = derivePassportIdentityFromCode(code);
  const cleanMemberName = memberName?.toString().trim() || "";
  const displayMemberName = cleanMemberName || derived.memberName;
  const resolvedPhrase = phrase?.toString().trim() || derived.phrase;
  const unlockKey = code || resolvedPhrase;
  const unlockUrl = buildUnlockLink(appOrigin, unlockKey);
  // Subjects appear on lock screens and mail previews. Keep the recovery key
  // inside the message, never in the notification-sized subject line.
  const subject = "ZipList Passport";

  const text = [
    "ZipList Passport is ready.",
    "Lists follow across linked devices.",
    "",
    displayMemberName ? `Passport identity: ${displayMemberName}` : null,
    hasCard
      ? "The passport card is attached: passkey and QR on the card."
      : null,
    hasQr && !hasCard ? "QR code attached." : null,
    `Link this device: ${unlockUrl}`,
    resolvedPhrase
      ? `4-word passkey: ${resolvedPhrase}`
      : `Passport passkey: ${code}`,
    "",
    "More room for lists, private sync, and shared lists that keep going.",
    "Free sharing stays free.",
    "",
    "One payment. No subscription, no renewal.",
    "Keep this email private. The passkey opens the lists.",
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
				<div style="display:inline-block;max-width:100%;box-sizing:border-box;padding:10px 6px;background:#fff1f2;border:2px solid #1e1714;border-radius:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:800;letter-spacing:-0.02em;overflow-wrap:anywhere;color:#1e1714;">${safePhrase}</div>
			</td></tr>`
    : `<tr><td align="center" style="padding:16px 0 0;">
				<div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;${muted};padding-bottom:6px;">Passport Passkey</div>
				<div style="display:inline-block;padding:12px 18px;background:#fffef7;border:2px solid #1e1714;border-radius:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:800;letter-spacing:0.06em;">${safeCode}</div>
			</td></tr>`;
  // The buyer's actual card, drawn from the same seeded skin they see in the
  // app. The HTML reproduction below is the fallback so a purchase never loses
  // its passkey.
  const passportCardImage = `<tr><td align="center" style="padding:34px 0 0;">
		<img src="cid:${CARD_CONTENT_ID}" width="496" alt="Your ZipList Passport card: 4-word passkey and QR code" style="display:block;width:100%;max-width:496px;height:auto;border:2px solid #1e1714;border-radius:20px;box-shadow:4px 4px 0 #1e1714;" />
	</td></tr>`;
  const cardNameRow = safeMemberName
    ? `<tr><td align="center" style="padding:20px 0 0;font-size:17px;font-weight:900;">${safeMemberName}</td></tr>`
    : "";
  const passportCard = hasCard
    ? `${passportCardImage}${cardNameRow}${passkeyBlock}`
    : `<tr><td align="center" style="padding:36px 0 0;">
		<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:410px;border:2px solid #1e1714;border-radius:22px;background:#fbf1e4;">
			<tr><td style="height:12px;background:#ffcc33;border-radius:20px 20px 0 0;font-size:1px;line-height:1px;">&nbsp;</td></tr>
			<tr><td align="center" style="padding:18px 12px 0;font-size:11px;font-weight:900;letter-spacing:0.16em;color:#ad2770;">PASSPORT</td></tr>
			${memberBadgeBlock}
			${qrBlock}
			${passkeyBlock}
			<tr><td style="height:26px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
		</table>
	</td></tr>`;

  const html = `<!doctype html>
<html>
	<body style="margin:0;padding:0;background:#fffef7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e1714;-webkit-font-smoothing:antialiased;">
		<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:540px;margin:0 auto;">
			<tr><td style="padding:48px 22px 60px;">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
					<tr><td align="center"><img src="cid:${ICON_CONTENT_ID}" width="76" height="76" alt="ZipList mascot" style="display:block;width:76px;height:76px;" /></td></tr>
					<tr><td align="center" style="font-size:12px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#db2777;">ZipList Passport</td></tr>
					<tr><td align="center" style="padding:18px 0 0;font-size:34px;line-height:1.12;font-weight:900;letter-spacing:-0.03em;">Passport ready.</td></tr>
					<tr><td align="center" style="padding:12px 0 0;font-size:16px;line-height:1.55;${muted}">Lists follow across linked devices.</td></tr>
					<tr><td align="center" style="padding:28px 0 0;">
						<a href="${safeUrl}" style="display:block;max-width:340px;padding:18px;background:#ff6ac2;color:#1e1714;text-decoration:none;text-align:center;font-weight:900;font-size:17px;border:2px solid #1e1714;border-radius:16px;box-shadow:4px 4px 0 #1e1714;">Link this device &rarr;</a>
					</td></tr>
					${passportCard}

					<tr><td align="center" style="padding:32px 0 0;font-size:15px;line-height:1.55;">More room for lists. Private sync.<br />Shared lists that keep going.</td></tr>
					<tr><td align="center" style="padding:18px 0 0;font-size:13px;line-height:1.5;${muted}">Free sharing stays free.<br />One payment. No subscription, no renewal.<br />Keep this email private: the passkey opens the lists.</td></tr>

					${rule}

					<tr><td style="padding:20px 0 0;font-size:12px;line-height:1.35;font-weight:900;color:#ad2770;text-align:center;">
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
  idempotencyKey,
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
    const resolvedPhrase = phrase || derived.phrase;
    const resolvedName = memberName || derived.memberName;
    const unlockUrl = buildUnlockLink(origin, code);

    // Their own card first; the standalone QR only stands in when the card
    // cannot be drawn, so the passkey and door always reach them.
    const cardPng = await renderPassportCardPng({
      code,
      phrase: resolvedPhrase,
      memberName: resolvedName,
      unlockUrl,
      appLabel: "ZipList Passport",
    }).catch((error) => {
      console.warn(
        "[ContributorEmail] Passport card render failed:",
        error?.message || error,
      );
      return null;
    });
    const qrPng = cardPng ? null : await renderPassportQr(unlockUrl);

    const message = buildContributorEmail({
      to,
      code,
      phrase: resolvedPhrase,
      memberName: resolvedName,
      appOrigin: origin,
      hasQr: Boolean(qrPng),
      hasCard: Boolean(cardPng),
    });

    const attachments = [
      {
        filename: "ziplist-mark.png",
        content: ZIPLIST_EMAIL_PNG_BASE64,
        content_type: "image/png",
        content_id: ICON_CONTENT_ID,
      },
    ];
    if (cardPng) {
      attachments.push({
        filename: "ziplist-passport.png",
        content: cardPng.toString("base64"),
        content_type: "image/png",
        content_id: CARD_CONTENT_ID,
      });
    }
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
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    };

    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...message, attachments }),
    });

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
