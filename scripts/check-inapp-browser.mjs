import assert from "node:assert/strict";
import {
  getInAppBrowserName,
  getUnsupportedBrowserMessage,
} from "../src/lib/services/audio/inAppBrowser.js";

const UA = {
  safari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  threads:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 330.0.0.32.108",
  discord:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Discord/230.0",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 338.0.0.32.108",
  messenger:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/468.0.0.32.108]",
  tiktok:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_35.1.0",
  twitter:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter",
};

assert.equal(getInAppBrowserName(UA.safari), null);
assert.equal(getInAppBrowserName(UA.chrome), null);
assert.equal(getInAppBrowserName(UA.threads), "Threads");
assert.equal(getInAppBrowserName(UA.discord), "Discord");
assert.equal(getInAppBrowserName(UA.instagram), "Instagram");
assert.equal(getInAppBrowserName(UA.messenger), "Messenger");
assert.equal(getInAppBrowserName(UA.tiktok), "TikTok");
assert.equal(getInAppBrowserName(UA.twitter), "X");

const discordMsg = getUnsupportedBrowserMessage(UA.discord);
assert.ok(discordMsg.includes("Discord"));
assert.ok(discordMsg.includes("Open in browser"));

console.log(
  "✓ in-app browser detection checks passed (Threads, Discord, Instagram, Messenger, TikTok, X)",
);
