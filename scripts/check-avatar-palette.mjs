// The avatar palette has two jobs: nobody looks like anybody else, and nobody's
// dot looks heavier than anybody else's. Both are measurable, so measure them.
// Run: node scripts/check-avatar-palette.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(
  new URL("../src/lib/services/realtime/avatarService.js", import.meta.url),
  "utf8",
);
const block = src.slice(src.indexOf("const AVATAR_COLORS = ["));
const hexes = [
  ...block.slice(0, block.indexOf("];")).matchAll(/#([0-9a-f]{6})/gi),
].map((m) => `#${m[1]}`);

assert.ok(hexes.length >= 10, `expected a decent spread, got ${hexes.length}`);

function hsl(hex) {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2;
  let h = 0;
  if (mx !== mn) {
    const d = mx - mn;
    h =
      mx === r
        ? ((g - b) / d) % 6
        : mx === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, l: l * 100 };
}

const parsed = hexes.map(hsl).sort((a, b) => a.h - b.h);

// Even weight: no avatar should read lighter or heavier than its neighbours.
const ls = parsed.map((p) => p.l);
const spread = Math.max(...ls) - Math.min(...ls);
assert.ok(
  spread <= 8,
  `lightness spread ${spread.toFixed(1)} pts — should be <= 8`,
);

// Distinguishable: two people in one room must never get near-twins.
for (let i = 1; i < parsed.length; i++) {
  const gap = parsed[i].h - parsed[i - 1].h;
  assert.ok(gap >= 20, `only ${gap.toFixed(0)}° between hues — need >= 20`);
}

// No absolute black or white ever, per the house law.
for (const h of hexes) {
  assert.ok(
    !/^#(fff(fff)?|000(000)?)$/i.test(h),
    `absolute colour banned: ${h}`,
  );
}

console.log(
  `✓ avatar palette: ${hexes.length} colours, lightness spread ${spread.toFixed(1)} pts, all >= 20° apart`,
);
