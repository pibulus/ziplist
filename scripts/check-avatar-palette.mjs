// The avatar palette has one job that can silently break: DiceBear "thumbs"
// draws WHITE eyes and a white mouth on this colour. Too light and the features
// vanish and you get a blank blob with a face you can't see.
//
// NOTE the constraint that is deliberately NOT here: even lightness. Equal
// contrast against white REQUIRES unequal lightness, because green reads far
// brighter than blue at the same L. An earlier version of this file asserted a
// tight lightness band and had to be deleted — it was enforcing the opposite of
// what the palette is for.
//
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

assert.ok(hexes.length >= 8, `expected a decent spread, got ${hexes.length}`);

function contrastVsWhite(hex) {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return 1.05 / (L + 0.05);
}

function hue(hex) {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  const d = mx - mn;
  let h =
    mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

// 1. The face must have a visible face.
for (const h of hexes) {
  const c = contrastVsWhite(h);
  assert.ok(
    c >= 3.0,
    `${h} is only ${c.toFixed(2)}:1 against white — the eyes won't read`,
  );
}

// 2. Two people in one room must never get near-twins.
const hues = hexes.map(hue).sort((a, b) => a - b);
for (let i = 1; i < hues.length; i++) {
  const gap = hues[i] - hues[i - 1];
  assert.ok(
    gap >= 15,
    `only ${gap.toFixed(0)}° between two faces — need >= 15`,
  );
}

// 3. House law.
for (const h of hexes) {
  assert.ok(
    !/^#(f{3}|f{6}|0{3}|0{6})$/i.test(h),
    `absolute colour banned: ${h}`,
  );
}

const worst = Math.min(...hexes.map(contrastVsWhite));
console.log(
  `✓ avatar palette: ${hexes.length} faces, worst white contrast ${worst.toFixed(2)}:1, all >= 15° apart`,
);
