import { createAvatar } from "@dicebear/core";
import { thumbs } from "@dicebear/collection";
const svg = createAvatar(thumbs, {
  seed: "Misty Fox",
  radius: 50,
  scale: 92,
  backgroundType: ["solid"],
  backgroundColor: ["transparent"],
  shapeColor: ["d6336c"],
}).toString();
const fills = [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
console.log("fills with shapeColor forced:", [...new Set(fills)].join("  "));
console.log("shapeColor honoured:", svg.includes("#d6336c") ? "YES" : "NO");
