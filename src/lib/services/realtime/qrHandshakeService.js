/**
 * Bridges Passport import links with trusted local QR rendering and pairing input parsing.
 */

import { normalizeSyncPhrase } from "./syncPhrase.js";

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

/**
 * Parses a pasted pairing link, /u/<code> URL, or bare 4-word passkey / code.
 * Rejects bare URLs without pairing parameters (e.g. "https://ziplist.app/")
 * so a homepage URL can never masquerade as a Passport credential.
 */
export function extractPairingInput(text) {
  const value = (text ?? "").toString().trim();
  if (!value) return null;

  const hashAt = value.indexOf("#");
  const queryAt = value.indexOf("?");

  let hashParams = new URLSearchParams();
  let queryParams = new URLSearchParams();

  if (hashAt !== -1) {
    hashParams = new URLSearchParams(value.slice(hashAt + 1));
  }
  if (queryAt !== -1) {
    const queryPart =
      hashAt !== -1 && hashAt > queryAt
        ? value.slice(queryAt + 1, hashAt)
        : value.slice(queryAt + 1);
    queryParams = new URLSearchParams(queryPart);
  }

  let code =
    hashParams.get("code") ||
    hashParams.get("unlock") ||
    hashParams.get("phrase") ||
    queryParams.get("code") ||
    queryParams.get("unlock") ||
    queryParams.get("phrase") ||
    "";
  const privatePhrase = hashParams.get("sync") || queryParams.get("sync") || "";

  if (!code) {
    const uMatch = value.match(/\/u\/([^/?#\s]+)/i);
    if (uMatch?.[1]) {
      try {
        code = decodeURIComponent(uMatch[1]);
      } catch {
        code = uMatch[1];
      }
    }
  }

  if (code || privatePhrase) {
    return {
      code: code.trim(),
      phrase: privatePhrase ? normalizeSyncPhrase(privatePhrase) : "",
    };
  }

  // Never treat a bare URL or path without code/unlock params as a Passport key.
  if (
    /^https?:\/\//i.test(value) ||
    value.includes("://") ||
    value.includes("/")
  ) {
    return null;
  }

  if (/^(ZL|SS)-/i.test(value) || value.length >= 8) {
    return {
      code: value.trim(),
      phrase: "",
    };
  }

  return null;
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

  const url = new URL("/", getZipListBaseUrl(appBaseUrl || baseUrl));
  const fragment = new URLSearchParams();
  fragment.set("unlock", normalizedCode);
  url.hash = fragment.toString();
  return url.toString();
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
