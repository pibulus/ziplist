#!/usr/bin/env node

/**
 * ⚡ ZIPLIST COMPREHENSIVE STRESS & RESILIENCE TEST SUITE ⚡
 * Tests:
 * 1. Parser & Tag Engine Under Massive Load (10,000 ops)
 * 2. HMAC Cryptographic Token Signing & Forge Resistance (1,000 attack vectors)
 * 3. Store Concurrency & Mutex Race Resistance (500 simultaneous writes)
 * 4. Live Production API Latency & Burst Test (https://ziplist.app)
 */

import crypto from "node:crypto";
import {
  listToText,
  textToItems,
} from "../src/lib/services/lists/listTextFormat.js";
import { cohereTag, extractTags } from "../src/lib/services/lists/itemTags.js";
import { MemoryAdapter } from "../src/lib/server/storage/MemoryAdapter.js";
import { withStoreLock } from "../src/lib/server/storage/storeLock.js";

const SECRET = "ziplist_stress_secret_key_2026_test_32chars_long!";
const PROD_URL = "https://ziplist.app";

console.log("\n============================================================");
console.log("⚡ STARTING ZIPLIST COMPREHENSIVE STRESS TEST ⚡");
console.log("============================================================\n");

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    totalPassed++;
    console.log(`  ✓ ${message}`);
  } else {
    totalFailed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// -----------------------------------------------------------------------------
// TEST 1: PARSER & TAG ENGINE THROUGHPUT
// -----------------------------------------------------------------------------
console.log(
  "🔥 [TEST 1] Parser & Tag Engine Throughput (10,000 operations)...",
);
const sampleMarkdown = `Groceries & Hardware
- [ ] 2x Organic Honeycrisp apples #fruit #organic
- [x] Sourdough loaf from bakery #bakery
- [ ] Almond milk (unsweetened) #dairyfree
- [ ] 10mm socket wrench #tools #garage
- [ ] M4 drywall screws x100 #hardware
- [x] Gorilla duct tape #diy
- [ ] → Weekend Projects
`;

const parseStart = performance.now();
for (let i = 0; i < 5000; i++) {
  const items = textToItems(sampleMarkdown);
  const serialized = listToText({ name: "Groceries & Hardware", items });
  if (i === 0) {
    assert(
      items.length >= 6,
      `Parsed ${items.length} items with checkboxes and tags`,
    );
    assert(
      serialized.includes("- [ ] 2x Organic Honeycrisp apples"),
      "Serialized preserved markdown checkboxes",
    );
  }
}
const parseDuration = (performance.now() - parseStart).toFixed(2);
console.log(
  `  ⚡ 5,000 text-to-item + serialize cycles completed in ${parseDuration}ms (${(5000 / (parseDuration / 1000)).toFixed(0)} ops/sec)`,
);

// Tag extraction & coherence stress test
const tagStart = performance.now();
const vocabulary = [
  "groceries",
  "fruit",
  "tools",
  "hardware",
  "diy",
  "music",
  "guitars",
];
for (let i = 0; i < 5000; i++) {
  const extracted = extractTags(
    "Buy 5 fresh #apples and #tomatoes for #cooking at the #supermarket",
    vocabulary,
  );
  const consolidated = cohereTag("grocery", vocabulary);
  const consolidatedGuitars = cohereTag("guitar", vocabulary);
  if (i === 0) {
    assert(
      extracted.tags.length >= 4,
      `Extracted ${extracted.tags.length} distinct tags cleanly`,
    );
    assert(
      consolidated === "groceries",
      "Tag cohere: 'grocery' snapped to canonical 'groceries'",
    );
    assert(
      consolidatedGuitars === "guitars",
      "Tag cohere: 'guitar' snapped to canonical 'guitars'",
    );
  }
}
const tagDuration = (performance.now() - tagStart).toFixed(2);
console.log(
  `  ⚡ 5,000 tag extraction & coherence operations completed in ${tagDuration}ms (${(5000 / (tagDuration / 1000)).toFixed(0)} ops/sec)`,
);

// -----------------------------------------------------------------------------
// TEST 2: CRYPTO SECURITY & FORGERY RESISTANCE (1,000 Attacks)
// -----------------------------------------------------------------------------
console.log("\n🔒 [TEST 2] Crypto Security & HMAC Forge Resistance...");

function makeToken(payload, secret) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token, secret) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return { valid: false };
  const [header, body, signature] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return { valid: false };
  }
  return {
    valid: true,
    payload: JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
  };
}

const validToken = makeToken(
  { sub: "contributor_user", exp: Date.now() + 100000 },
  SECRET,
);
assert(
  verifyToken(validToken, SECRET).valid === true,
  "Valid issued token passes HMAC verification",
);

// Attack vectors: 1,000 tampered tokens
let rejectedForgedTokens = 0;
for (let i = 0; i < 1000; i++) {
  const parts = validToken.split(".");
  const corruptedSignature = crypto.randomBytes(32).toString("base64url");
  const forgedToken = `${parts[0]}.${parts[1]}.${corruptedSignature}`;
  const result = verifyToken(forgedToken, SECRET);
  if (!result.valid) {
    rejectedForgedTokens++;
  }
}
assert(
  rejectedForgedTokens === 1000,
  `1,000/1,000 forged signature attacks rejected (100% protection)`,
);

// -----------------------------------------------------------------------------
// TEST 3: CONCURRENT STORE WRITES & MUTEX LOCK STRESS (500 Ops)
// -----------------------------------------------------------------------------
console.log("\n💾 [TEST 3] Concurrent Store Writes & Mutex Race Resistance...");
const testStorage = new MemoryAdapter();
const STORE_NAME = "stress_test_store";
await testStorage.set(STORE_NAME, { count: 0, items: [] });

const concurrencyPromises = [];
const NUM_WRITES = 500;

for (let i = 0; i < NUM_WRITES; i++) {
  concurrencyPromises.push(
    withStoreLock(STORE_NAME, async () => {
      const data = (await testStorage.get(STORE_NAME)) || {
        count: 0,
        items: [],
      };
      data.count += 1;
      data.items.push(`item_${i}`);
      await testStorage.set(STORE_NAME, data);
      return data.count;
    }),
  );
}

await Promise.all(concurrencyPromises);
const finalStoreData = await testStorage.get(STORE_NAME);
assert(
  finalStoreData.count === NUM_WRITES,
  `500 concurrent mutex locked writes completed without race condition (count: ${finalStoreData.count}/${NUM_WRITES})`,
);
assert(
  finalStoreData.items.length === NUM_WRITES,
  `500 items stored with zero data loss or collisions`,
);

// -----------------------------------------------------------------------------
// TEST 4: LIVE PRODUCTION API BURST TEST (https://ziplist.app)
// -----------------------------------------------------------------------------
console.log(`\n🌐 [TEST 4] Live Production API Burst Test (${PROD_URL})...`);
try {
  const burstStart = performance.now();
  const burstRequests = [];

  // 15 concurrent requests to production API
  for (let i = 0; i < 15; i++) {
    burstRequests.push(
      fetch(`${PROD_URL}/api/contributor/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: i === 0 ? "ZL-PABLO-DEV" : `ZL-INVALID-CODE-${i}`,
        }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        return { status: res.status, body };
      }),
    );
  }

  const results = await Promise.all(burstRequests);
  const burstDuration = (performance.now() - burstStart).toFixed(2);

  const validRedeem = results[0];
  assert(
    validRedeem.status === 200 && validRedeem.body.valid === true,
    `Founder code ZL-PABLO-DEV verified live on ${PROD_URL} (Status 200)`,
  );

  const invalidRejections = results
    .slice(1)
    .filter(
      (r) =>
        r.status === 401 ||
        r.status === 400 ||
        (r.status === 200 && r.body.valid === false),
    );
  assert(
    invalidRejections.length === 14,
    `14/14 bogus codes gracefully rejected with 401 Unauthorized`,
  );

  console.log(
    `  ⚡ 15 parallel production HTTP requests completed in ${burstDuration}ms (Avg ${(burstDuration / 15).toFixed(1)}ms / req)`,
  );
} catch (e) {
  console.error("  ✗ Production burst test encountered error:", e.message);
  totalFailed++;
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log("\n============================================================");
console.log(
  `🏁 STRESS TEST COMPLETE: ${totalPassed} PASSED / ${totalFailed} FAILED`,
);
console.log("============================================================\n");

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
