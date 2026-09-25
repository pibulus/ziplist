/**
 * In-app browser detection.
 *
 * Sibling parity with TalkType: someone opening a ZipList link directly
 * from Discord, Threads, Messenger, Instagram, or TikTok often encounters an
 * embedded webview where getUserMedia is blocked.
 *
 * UA sniffing is used ONLY to make the error message specific and actionable:
 * "Discord's built-in browser blocks the mic. Tap the ••• menu and choose
 * 'Open in browser'."
 */

const IN_APP_BROWSERS = [
  { pattern: /FB_IAB\/MESSENGER|Messenger/i, name: "Messenger" },
  { pattern: /Instagram/i, name: "Instagram" },
  { pattern: /FBAN|FBAV|FB_IAB/i, name: "Facebook" },
  { pattern: /TikTok|musical_ly|BytedanceWebview/i, name: "TikTok" },
  { pattern: /LinkedInApp/i, name: "LinkedIn" },
  { pattern: /Snapchat/i, name: "Snapchat" },
  { pattern: /\bLine\//i, name: "LINE" },
  { pattern: /Twitter|TwitterAndroid/i, name: "X" },
  { pattern: /Threads|Barcelona/i, name: "Threads" },
  { pattern: /Discord/i, name: "Discord" },
  { pattern: /Pinterest/i, name: "Pinterest" },
  { pattern: /Reddit/i, name: "Reddit" },
];

/**
 * Name the in-app browser we appear to be running inside, if any.
 * @param {string} [userAgent] - override, for tests
 * @returns {string|null} e.g. "Discord", or null when not detected
 */
export function getInAppBrowserName(userAgent) {
  const ua =
    userAgent ??
    (typeof navigator === "undefined" ? "" : navigator.userAgent || "");
  if (!ua) return null;

  for (const { pattern, name } of IN_APP_BROWSERS) {
    if (pattern.test(ua)) return name;
  }
  return null;
}

/**
 * True when this environment cannot record, whatever the reason.
 * @returns {boolean}
 */
export function isRecordingUnsupported() {
  if (typeof navigator === "undefined") return false;
  return !navigator.mediaDevices?.getUserMedia;
}

/**
 * Actionable copy for an environment that cannot reach the microphone.
 * @param {string} [userAgent] - override, for tests
 * @returns {string}
 */
export function getUnsupportedBrowserMessage(userAgent) {
  const app = getInAppBrowserName(userAgent);
  return app
    ? `${app}'s built-in browser blocks the mic. Tap the ••• menu and choose "Open in browser".`
    : "This browser blocks mic access. Open the page in Safari or Chrome to record.";
}
