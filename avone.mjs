import { createAvatar } from "@dicebear/core";
import { thumbs } from "@dicebear/collection";
import { writeFileSync } from "node:fs";
const svg = createAvatar(thumbs, {
  seed: process.argv[2] || "Misty Fox",
  radius: 50,
  scale: 92,
  backgroundType: ["solid"],
  backgroundColor: ["transparent"],
}).toString();
writeFileSync(process.argv[3], svg);
// what colours does it actually paint?
const fills = [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
console.log("fills used:", [...new Set(fills)].join("  "));
