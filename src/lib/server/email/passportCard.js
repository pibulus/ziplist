// ═══════════════════════════════════════════════════════════════════════════
// passportCard — the supporter's actual Passport, rendered for email
// ═══════════════════════════════════════════════════════════════════════════
//
// The in-app passport is a live Svelte card (holofoil CSS, pointer sheen,
// DiceBear avatar). Mail clients run none of that, so the same card face is
// rebuilt here as SVG from the SAME seeded inputs — identity, skin, palette,
// avatar — and rasterised to a PNG the email can carry as an attachment.
//
// This is a static render: it shows where the foil sits, not the pointer
// sweep. Everything a buyer needs (face, name, passkey, QR) is identical to
// what they see in the app, because it comes from the same pure functions.

import { generateMemberIdentity } from "$lib/cartridges/identityUtils.js";
import { selectSkin } from "$lib/cartridges/passportSkins.js";
import { buildPassportAvatar } from "$lib/cartridges/passportAvatar.js";
import { vaultHashForCode } from "$lib/server/contributor/licenseCrypto.js";
import {
  JETBRAINS_MONO_BASE64,
  POPPINS_BOLD_BASE64,
} from "./fonts/fontData.js";

// 342×216 CSS px (the card's own aspect) at 3× for a crisp retina email image.
const WIDTH = 1026;
const HEIGHT = 648;
const PAD = 60;
const RADIUS = 74;
const AVATAR = 168;
const QR_SIZE = 153;

const escapeXml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

/** Rough advance-width estimate so long passkeys shrink instead of clipping. */
const estimateWidth = (text, size, tracking = 0) =>
  [...String(text)].length * (size * 0.58 + tracking);

function fitSize(text, maxWidth, size, minSize, tracking = 0) {
  let current = size;
  while (
    current > minSize &&
    estimateWidth(text, current, tracking) > maxWidth
  ) {
    current -= 2;
  }
  return current;
}

/** Split a name into at most two lines that fit the card's text column. */
function wrapName(name, maxWidth, size) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && estimateWidth(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length > 2 ? [lines[0], lines.slice(1).join(" ")] : lines;
}

const initialsFor = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");

function spectralStops(skin) {
  const vars = skin?.vars || {};
  return [1, 2, 3, 4, 5, 6]
    .map((index) => vars[`--holo-c${index}`])
    .filter(Boolean);
}

/** resvg is happiest with plain hex; the skin axes store hsl() stops. */
function hslToHex(value) {
  const match = /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i.exec(
    String(value).trim(),
  );
  if (!match) return value;
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const hue = (p, q, t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channels = [h + 1 / 3, h, h - 1 / 3].map((t) =>
    Math.round(Math.max(0, Math.min(1, hue(p, q, t))) * 255)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${channels.join("")}`;
}

/**
 * Build the card face as SVG. Pure: same inputs in, same markup out.
 */
export function buildPassportCardSvg({
  appLabel = "ZipList Passport",
  memberName = "",
  passkey = "",
  initials = "",
  palette,
  skin,
  avatarDataUri = "",
  qrDataUri = "",
}) {
  const bg = palette?.bg || ["#f7c8e0", "#f9a8d4", "#c084fc"];
  const accent = palette?.accent || "#ff5ca8";
  const glow = palette?.glow || "#f472b6";
  // Terminal frames are dark substrate in the app; the card flips to light ink.
  const isDarkSubstrate = skin?.choices?.frame === "terminal";
  const ink = isDarkSubstrate ? "#e8fff0" : palette?.ink || "#231a2b";
  const inkSoft = isDarkSubstrate
    ? "rgba(232, 255, 240, 0.66)"
    : palette?.inkSoft || "rgba(35, 26, 43, 0.66)";
  const stops = spectralStops(skin).map(hslToHex);
  const spectral =
    stops.length === 6
      ? stops
      : ["#ff6ec7", "#ffb36b", "#ffe066", "#6bffb3", "#6bd5ff", "#b18cff"];
  const holoBlend = isDarkSubstrate ? "screen" : "multiply";
  const nameSize = 60;
  const nameLines = wrapName(memberName || "Passport Holder", 520, nameSize);
  const passkeySize = fitSize(passkey, 520, 34, 20, 1);
  const qrX = WIDTH - PAD - QR_SIZE;
  const qrY = HEIGHT - PAD - QR_SIZE;
  const idY = HEIGHT - PAD;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="${escapeXml(bg[0])}" />
			<stop offset="48%" stop-color="${escapeXml(bg[1])}" />
			<stop offset="100%" stop-color="${escapeXml(bg[2] || bg[1])}" />
		</linearGradient>
		<radialGradient id="bloom" cx="12%" cy="14%" r="60%">
			<stop offset="0%" stop-color="#ffffff" stop-opacity="0.32" />
			<stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
		</radialGradient>
		<linearGradient id="holo" x1="0" y1="0" x2="1" y2="0.35">
			${spectral.map((stop, index) => `<stop offset="${Math.round((index / (spectral.length - 1)) * 100)}%" stop-color="${escapeXml(stop)}" />`).join("")}
		</linearGradient>
		<radialGradient id="holoReveal" cx="58%" cy="34%" r="72%">
			<stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
			<stop offset="55%" stop-color="#ffffff" stop-opacity="0.45" />
			<stop offset="100%" stop-color="#ffffff" stop-opacity="0.12" />
		</radialGradient>
		<linearGradient id="holoBands" x1="0" y1="0" x2="1" y2="0.2">
			${spectral
        .map(
          (stop, index) =>
            `<stop offset="${Math.round((index / (spectral.length - 1)) * 100)}%" stop-color="${escapeXml(stop)}" />`,
        )
        .join("")}
		</linearGradient>
		<pattern id="scanlines" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
			<rect width="9" height="9" fill="none" />
			<rect width="9" height="3" fill="#ffffff" fill-opacity="0.5" />
		</pattern>
		<mask id="holoMask">
			<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#holoReveal)" />
		</mask>
		<linearGradient id="laminate" x1="0" y1="1" x2="1" y2="0">
			<stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
			<stop offset="18%" stop-color="#ffffff" stop-opacity="0.30" />
			<stop offset="34%" stop-color="#ffffff" stop-opacity="0" />
			<stop offset="66%" stop-color="#ffffff" stop-opacity="0.16" />
			<stop offset="84%" stop-color="#ffffff" stop-opacity="0" />
		</linearGradient>
		<radialGradient id="qrGlow" cx="50%" cy="50%" r="60%">
			<stop offset="0%" stop-color="${escapeXml(glow)}" stop-opacity="0.28" />
			<stop offset="100%" stop-color="${escapeXml(glow)}" stop-opacity="0" />
		</radialGradient>
		<clipPath id="cardClip">
			<rect width="${WIDTH}" height="${HEIGHT}" rx="${RADIUS}" ry="${RADIUS}" />
		</clipPath>
	</defs>

	<g clip-path="url(#cardClip)">
		<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
		<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bloom)" />
		${isDarkSubstrate ? `<rect width="${WIDTH}" height="${HEIGHT}" fill="#08150f" fill-opacity="0.94" />` : ""}
		<g mask="url(#holoMask)">
			<!-- Three offset spectral sweeps: bands, not a wash, so the foil
			     reads as foil and the palette still owns the card. -->
			<rect x="-260" y="-200" width="${WIDTH + 520}" height="${HEIGHT + 400}" fill="url(#holo)" transform="rotate(-16 512 324)" opacity="${isDarkSubstrate ? 0.85 : 0.7}" style="mix-blend-mode:${holoBlend}" />
			<rect x="-260" y="-200" width="${WIDTH + 520}" height="${HEIGHT + 400}" fill="url(#holoBands)" transform="rotate(28 512 324)" opacity="${isDarkSubstrate ? 0.7 : 0.62}" style="mix-blend-mode:${holoBlend}" />
			<rect x="-260" y="-200" width="${WIDTH + 520}" height="${HEIGHT + 400}" fill="url(#holo)" transform="rotate(72 512 324)" opacity="${isDarkSubstrate ? 0.55 : 0.45}" style="mix-blend-mode:${holoBlend}" />
		</g>
		<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#laminate)" opacity="0.55" />
		<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scanlines)" opacity="0.16" />
		<rect x="1.5" y="1.5" width="${WIDTH - 3}" height="${HEIGHT - 3}" rx="${RADIUS - 1.5}" ry="${RADIUS - 1.5}" fill="none" stroke="#ffffff" stroke-opacity="0.38" stroke-width="3" />
	</g>

	<!-- Kicker -->
	<text x="${PAD}" y="${PAD + 26}" font-family="Poppins" font-weight="700" font-size="30" letter-spacing="4" fill="${escapeXml(ink)}" fill-opacity="0.82">${escapeXml(
    appLabel.toUpperCase(),
  )}</text>

	<!-- Member name -->
	${nameLines
    .map(
      (line, index) =>
        `<text x="${PAD}" y="${PAD + 94 + index * 66}" font-family="Poppins" font-weight="700" font-size="${nameSize}" fill="${escapeXml(ink)}">${escapeXml(line)}</text>`,
    )
    .join("\n\t")}

	<!-- Avatar chip -->
	<g transform="translate(${WIDTH - PAD - AVATAR} ${PAD})">
		<rect width="${AVATAR}" height="${AVATAR}" rx="48" ry="48" fill="#ffffff" fill-opacity="0.22" stroke="#ffffff" stroke-opacity="0.72" stroke-width="6" />
		${
      avatarDataUri
        ? `<image href="${escapeXml(avatarDataUri)}" x="0" y="0" width="${AVATAR}" height="${AVATAR}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 48px)" />`
        : `<text x="${AVATAR / 2}" y="${AVATAR / 2 + 22}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="60" fill="${escapeXml(ink)}">${escapeXml(initials)}</text>`
    }
	</g>

	<!-- Passkey -->
	<text x="${PAD}" y="${idY - 52}" font-family="Poppins" font-weight="700" font-size="26" letter-spacing="3" fill="${escapeXml(ink)}" fill-opacity="0.68">4-WORD PASSKEY</text>
	<text x="${PAD}" y="${idY - 4}" font-family="JetBrains Mono" font-weight="700" font-size="${passkeySize}" letter-spacing="1" fill="${escapeXml(ink)}">${escapeXml(passkey)}</text>

	<!-- QR stamp -->
	<circle cx="${qrX + QR_SIZE / 2}" cy="${qrY + QR_SIZE / 2}" r="${QR_SIZE}" fill="url(#qrGlow)" />
	<g transform="rotate(-2 ${qrX + QR_SIZE / 2} ${qrY + QR_SIZE / 2})">
		<rect x="${qrX}" y="${qrY}" width="${QR_SIZE}" height="${QR_SIZE}" rx="38" ry="38" fill="#ffffff" fill-opacity="0.9" stroke="#ffffff" stroke-opacity="0.72" stroke-width="5" />
		${
      qrDataUri
        ? `<image href="${escapeXml(qrDataUri)}" x="${qrX + 12}" y="${qrY + 12}" width="${QR_SIZE - 24}" height="${QR_SIZE - 24}" />`
        : `<text x="${qrX + QR_SIZE / 2}" y="${qrY + QR_SIZE / 2 + 14}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="34" letter-spacing="2" fill="${escapeXml(ink)}" fill-opacity="0.7">PASS</text>`
    }
	</g>

	<!-- Corner accent keeps the ink readable if a palette runs pale -->
	<rect x="0" y="${HEIGHT - 8}" width="${WIDTH}" height="8" fill="${escapeXml(accent)}" fill-opacity="0.55" />
	<rect x="0" y="0" width="${WIDTH}" height="6" fill="${escapeXml(inkSoft)}" fill-opacity="0.08" />
</svg>`;
}

/**
 * Render the buyer's passport to a PNG buffer.
 * Returns null when the inputs can't produce an identity — callers fall back
 * to the plain HTML card rather than sending a half-drawn passport.
 */
export async function renderPassportCardPng({
  code,
  phrase,
  memberName,
  unlockUrl,
  appLabel = "ZipList Passport",
}) {
  const hash = vaultHashForCode(code);
  if (!hash) return null;

  const identity = generateMemberIdentity(hash, code);
  if (identity.isFallback) return null;

  const seed = identity.syncRoomId || hash;
  const skin = selectSkin(seed);
  const palette = skin?.palette;

  let avatarDataUri = "";
  try {
    avatarDataUri = buildPassportAvatar(seed || "talktype", skin.avatarStyle);
  } catch {
    avatarDataUri = "";
  }

  let qrDataUri = "";
  try {
    const { default: QRCode } = await import("qrcode");
    const buffer = await QRCode.toBuffer(unlockUrl, {
      type: "png",
      width: 512,
      margin: 0,
      errorCorrectionLevel: "M",
    });
    qrDataUri = `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    qrDataUri = "";
  }

  const svg = buildPassportCardSvg({
    appLabel,
    memberName: memberName || identity.name,
    passkey: phrase || identity.phrase || code,
    initials: initialsFor(memberName || identity.name),
    palette,
    skin,
    avatarDataUri,
    qrDataUri,
  });

  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: {
      fontBuffers: [
        Buffer.from(POPPINS_BOLD_BASE64, "base64"),
        Buffer.from(JETBRAINS_MONO_BASE64, "base64"),
      ],
      loadSystemFonts: false,
      defaultFontFamily: "Poppins",
    },
  });

  return Buffer.from(resvg.render().asPng());
}
