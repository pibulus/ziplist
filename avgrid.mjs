import { createAvatar } from "@dicebear/core";
import { thumbs } from "@dicebear/collection";
import { writeFileSync, mkdirSync } from "node:fs";
const cols = process.argv[2].split(",");
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
];
mkdirSync(process.argv[3], { recursive: true });
cols.forEach((c, i) => {
  const svg = createAvatar(thumbs, {
    seed: NAMES[i % NAMES.length],
    radius: 50,
    scale: 92,
    backgroundType: ["solid"],
    backgroundColor: ["transparent"],
    shapeColor: [c.replace("#", "")],
  }).toString();
  writeFileSync(`${process.argv[3]}/a${String(i).padStart(2, "0")}.svg`, svg);
});
console.log("wrote", cols.length);
