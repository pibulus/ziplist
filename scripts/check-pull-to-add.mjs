// A pull must never be a scroll and never be a swipe. Run: node scripts/check-pull-to-add.mjs
import assert from "node:assert/strict";
import {
  resolvePull,
  pullTravel,
  PULL_THRESHOLD,
  PULL_MAX,
  PULL_SLOP,
  PULL_DIRECTION_BIAS,
} from "../src/lib/services/lists/pullToAdd.js";

const outcome = (dx, dy, locked = false) => resolvePull(dx, dy, locked).outcome;

// ── Inside the slop, nothing is decided ─────────────────────────────────
assert.equal(outcome(0, 0), "waiting", "a stationary finger decides nothing");
assert.equal(outcome(5, 5), "waiting");
assert.equal(outcome(-7, 7), "waiting", "slop is a box, not a radius");

// ── The three ways a gesture is NOT a pull ──────────────────────────────
assert.equal(outcome(0, -40), "release", "upward is a scroll, never a pull");
assert.equal(outcome(40, 4), "release", "horizontal belongs to the carousel");
assert.equal(outcome(-40, 4), "release", "…in both directions");
assert.equal(
  outcome(0, 40),
  "pulling",
  "straight down with the page at the top is the gesture",
);

// ── The wedge: swipe and pull must be mutually exclusive ────────────────
// The carousel takes a gesture when |x| > |y| * 1.1; this takes it when
// |y| > |x| * 1.1. Neither may claim a delta the other also claims, or a
// diagonal drags the deck sideways AND opens a draft row.
for (let angle = 0; angle <= 90; angle += 1) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * 200;
  const dy = Math.sin(rad) * 200;

  const pullTakesIt = outcome(dx, dy) === "pulling";
  const carouselTakesIt = Math.abs(dx) > Math.abs(dy) * PULL_DIRECTION_BIAS;

  assert.ok(
    !(pullTakesIt && carouselTakesIt),
    `both gestures claim ${angle}° — a diagonal would swipe and add at once`,
  );
}

// A 45° drag is the ambiguous case by construction: neither may take it.
assert.equal(outcome(100, 100), "release", "45° is nobody's gesture");

// ── Once locked, the gesture is ours ────────────────────────────────────
assert.equal(
  outcome(300, 40, true),
  "pulling",
  "a locked pull survives sideways wobble — fingers are not rulers",
);
assert.equal(
  outcome(0, -10, true),
  "pulling",
  "a locked pull does not re-litigate direction on every frame",
);

// ── Travel: monotonic, damped, bounded ──────────────────────────────────
assert.equal(pullTravel(0), 0);
assert.ok(pullTravel(10) < 10, "the row lags the finger — that IS the rubber");

let previous = -1;
for (let finger = 0; finger <= 1000; finger += 5) {
  const travel = pullTravel(finger);
  assert.ok(travel >= previous, `travel went backwards at ${finger}px`);
  previous = travel;
}
assert.ok(
  pullTravel(100000) <= PULL_MAX * 1.25,
  "an absurd drag still cannot grow the row without bound",
);

// ── The threshold has to be REACHABLE, and not by accident ──────────────
// Tuning that can never arm ships a dead gesture; tuning that arms inside
// the slop ships a gesture that fires when someone meant to tap.
const fingerToArm = (() => {
  for (let finger = 0; finger <= 2000; finger += 1) {
    if (pullTravel(finger) >= PULL_THRESHOLD) return finger;
  }
  return Infinity;
})();

assert.ok(
  Number.isFinite(fingerToArm),
  "the commit threshold is unreachable — the gesture can never fire",
);
assert.ok(
  fingerToArm > PULL_SLOP * 4,
  `arms after only ${fingerToArm}px — too close to a tap`,
);
assert.ok(
  fingerToArm < 220,
  `needs ${fingerToArm}px of finger — further than a thumb reaches`,
);

assert.equal(resolvePull(0, fingerToArm, true).armed, true);
assert.equal(resolvePull(0, fingerToArm - 2, true).armed, false);

console.log(
  `✓ pull-to-add: arms at ${fingerToArm}px of finger, and no angle is ever both a swipe and a pull`,
);
