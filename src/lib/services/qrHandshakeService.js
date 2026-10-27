/**
 * Bridges Passport import links with trusted local QR rendering.
 */

import { normalizeSyncPhrase } from "./realtime/syncPhrase.js";

const DEFAULT_QR_SIZE = 256;

function normalizeQrSize(size) {
  const parsed = Number.parseInt(size || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_QR_SIZE;
  return Math.min(1024, Math.max(128, parsed));
}

function getZipListBaseUrl(baseUrl) {
  if (baseUrl) return baseUrl;
  if (typeof window !== "undefined" && window.location?.origin)
    return window.location.origin;
  return "https://ziplist.app";
}

export function buildPassportSyncUrl(codeOrOptions = {}, baseUrlArg = "") {
  const options =
    typeof codeOrOptions === "string"
      ? { code: codeOrOptions, baseUrl: baseUrlArg }
      : codeOrOptions || {};
  const { code, baseUrl = "", appBaseUrl = "" } = options;
  const normalizedCode = code?.toString().trim();
  if (!normalizedCode) return "";

  const url = new URL("/", getZipListBaseUrl(appBaseUrl || baseUrl));
  const fragment = new URLSearchParams();
  fragment.set("code", normalizedCode);
  url.hash = fragment.toString();
  return url.toString();
}

/**
 * Opening this on another device unlocks it with the pass code, which is all
 * it takes to join the same sync room; a private phrase rides along when one
 * is set. Both sit in the fragment, which browsers never send to a server, so
 * neither lands in an access log.
 */
export function buildDeviceSyncUrl(
  codeOrOptions = {},
  phraseArg = "",
  baseUrlArg = "",
) {
  const options =
    typeof codeOrOptions === "string"
      ? { code: codeOrOptions, phrase: phraseArg, baseUrl: baseUrlArg }
      : codeOrOptions || {};
  const { code, phrase = "", baseUrl = "", appBaseUrl = "" } = options;
  const normalizedCode = code?.toString().trim();
  if (!normalizedCode) return "";

  const url = new URL("/", getZipListBaseUrl(appBaseUrl || baseUrl));
  const fragment = new URLSearchParams();
  fragment.set("code", normalizedCode);
  const normalizedPhrase = normalizeSyncPhrase(phrase);
  if (normalizedPhrase) fragment.set("sync", normalizedPhrase);
  url.hash = fragment.toString();
  return url.toString();
}

export function buildUnlockUrl(codeOrOptions = {}, baseUrlArg = "") {
  const options =
    typeof codeOrOptions === "string"
      ? { code: codeOrOptions, baseUrl: baseUrlArg }
      : codeOrOptions || {};
  const { code, baseUrl = "", appBaseUrl = "" } = options;
  const normalizedCode = code?.toString().trim();
  if (!normalizedCode) return "";

  return new URL(
    `/u/${encodeURIComponent(normalizedCode)}`,
    getZipListBaseUrl(appBaseUrl || baseUrl),
  ).toString();
}

/**
 * Render the passport QR locally instead of round-tripping through
 * an external QR service. The passport sync payload contains the supporter code,
 * so it must never leave the device.
 */
export async function renderQrDataUrl(data, options = {}) {
  if (!data) return "";

  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(data, {
    width: normalizeQrSize(options.size),
    margin: 1,
    errorCorrectionLevel: "M",
    // Warm house ink on warm paper — never pure black/white.
    color: {
      dark: options.dark || "#1e1714",
      light: options.light || "#fffef7",
    },
  });
}
