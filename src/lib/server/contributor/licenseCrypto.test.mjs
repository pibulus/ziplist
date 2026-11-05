import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

// The verifier is stamp-scoped: a passport token stamped for another app must not
// open ZipList's gates, while unstamped legacy tokens keep working.

const libBaseUrl = pathToFileURL(
  path.resolve(process.cwd(), "src/lib") + "/",
).href;

// Minimal ESM resolve/load hook so SvelteKit virtual modules ($env/dynamic/private,
// $lib/*) resolve cleanly under bare `node`.
const loaderSource = `
const libBaseUrl = ${JSON.stringify(libBaseUrl)};
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "$env/dynamic/private" || specifier === "$env/dynamic/public") {
    return { url: "virtual:" + specifier, shortCircuit: true };
  }
  if (specifier.startsWith("$lib/")) {
    const target = new URL(specifier.slice(5), libBaseUrl).href;
    return nextResolve(target, context);
  }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "virtual:$env/dynamic/private" || url === "virtual:$env/dynamic/public") {
    return {
      format: "module",
      shortCircuit: true,
      source: "export const env = process.env;",
    };
  }
  return nextLoad(url, context);
}
`;

register(
  `data:text/javascript;base64,${Buffer.from(loaderSource).toString("base64")}`,
);

const { verifyContributorToken } = await import("./licenseCrypto.js");

// Same fixture secret the other apps' stamp tests use: all four apps sign with
// the shared passport secret, so only the stamp claim separates them.
const STAMP_SECRET = "softstack-test-secret-32-chars-min!!";
const nowSec = Math.floor(Date.now() / 1000);

const signToken = (body) => {
  const b64 = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const head = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64(body);
  const sig = createHmac("sha256", STAMP_SECRET)
    .update(`${head}.${payload}`)
    .digest("base64url");
  return `${head}.${payload}.${sig}`;
};

// A token stamped for another app is rejected, even though its signature is
// valid under the shared passport secret.
const foreignStamp = signToken({
  sub: "talktype-license",
  tier: "supporter",
  stamps: ["talktype"],
  v: 1,
  iat: nowSec,
  exp: nowSec + 3600,
});
assert.equal(verifyContributorToken(foreignStamp, STAMP_SECRET), null);

// Its own stamp is accepted.
const ownStamp = signToken({
  sub: "ziplist-license",
  tier: "supporter",
  stamps: ["ziplist"],
  v: 1,
  iat: nowSec,
  exp: nowSec + 3600,
});
assert.equal(
  verifyContributorToken(ownStamp, STAMP_SECRET)?.sub,
  "ziplist-license",
);

// Legacy tokens sold before stamps existed carry none and stay valid.
const legacy = signToken({
  sub: "legacy-license",
  tier: "supporter",
  v: 1,
  iat: nowSec,
  exp: nowSec + 3600,
});
assert.equal(
  verifyContributorToken(legacy, STAMP_SECRET)?.sub,
  "legacy-license",
);

// Expiry still wins over a correct stamp.
const expired = signToken({
  sub: "expired-license",
  tier: "supporter",
  stamps: ["ziplist"],
  v: 1,
  iat: nowSec - 3600,
  exp: nowSec - 10,
});
assert.equal(verifyContributorToken(expired, STAMP_SECRET), null);

console.log("contributor licenseCrypto: stamp scoping ok");
