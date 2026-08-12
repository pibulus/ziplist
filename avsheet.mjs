import { createAvatar } from "@dicebear/core";
import { thumbs } from "@dicebear/collection";
import { writeFileSync } from "node:fs";

const PALETTE = process.argv[2].split(",");
const NAMES = [
  "Misty Fox",
  "Calm Eagle",
  "Brave Hare",
  "Lucky Panda",
  "Sly Dove",
  "Wise Swan",
  "Bold Lynx",
  "Kind Otter",
  "Neat Crane",
  "Warm Bear",
  "Quick Moth",
  "Soft Wren",
];
const S = 150,
  GAP = 18,
  COLS = 6;
const rows = Math.ceil(PALETTE.length / COLS);
const W = COLS * (S + GAP) + GAP,
  H = rows * (S + GAP + 26) + GAP;
let out = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  `<rect width="100%" height="100%" fill="#fdf6e8"/>`,
];
PALETTE.forEach((colour, i) => {
  const x = GAP + (i % COLS) * (S + GAP),
    y = GAP + Math.floor(i / COLS) * (S + GAP + 26);
  const svg = createAvatar(thumbs, {
    seed: NAMES[i % NAMES.length],
    radius: 50,
    scale: 92,
    backgroundType: ["solid"],
    backgroundColor: ["transparent"],
  })
    .toString()
    .replace(/<\?xml[^>]*\?>/, "")
    .replace(/<svg /, "<svg ");
  out.push(
    `<circle cx="${x + S / 2}" cy="${y + S / 2}" r="${S / 2}" fill="${colour}"/>`,
  );
  out.push(
    `<g transform="translate(${x},${y})">${svg.replace(/width="[^"]*"/, `width="${S}"`).replace(/height="[^"]*"/, `height="${S}"`)}</g>`,
  );
  out.push(
    `<text x="${x + S / 2}" y="${y + S + 18}" font-family="Helvetica" font-size="13" fill="#1e1714" text-anchor="middle">${colour}</text>`,
  );
});
out.push("</svg>");
writeFileSync(process.argv[3], out.join("\n"));
console.log("sheet written");
