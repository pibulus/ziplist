/**
 * Ghost Asset Generator Vite Plugin
 *
 * This plugin generates static ghost SVG and PNG assets during the build process,
 * ensuring consistency between the component-based ghost and static assets.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { optimize } from "svgo";
import { fileURLToPath } from "url";

// Import ghost SVG generators
import {
  generateStaticGhostSvg,
  generateIconGhostSvg,
  generateGhostBackgroundSvg,
} from "../src/lib/components/ghost/exportable/index.js";

// Get current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Constants
const THEMES = ["peach", "mint", "bubblegum", "rainbow"];
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const STATIC_DIR = path.resolve(__dirname, "../static");
const ASSETS_DIR = path.resolve(STATIC_DIR, "assets");
const ICONS_DIR = path.resolve(STATIC_DIR, "icons");

// SVGO optimization configuration
const svgoConfig = {
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          // Customize optimization for our needs
          removeViewBox: false,
        },
      },
    },
    {
      name: "cleanupIds",
      active: false,
    },
    {
      name: "convertStyleToAttrs",
      active: true,
    },
    {
      name: "collapseGroups",
      active: true,
    },
  ],
};

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Optimize SVG content
 * @param {string} svgContent - SVG content to optimize
 * @returns {string} Optimized SVG
 */
function optimizeSvg(svgContent) {
  const result = optimize(svgContent, svgoConfig);
  return result.data;
}

/**
 * Save SVG to file
 * @param {string} filePath - Target file path
 * @param {string} svgContent - SVG content
 */
function saveSvg(filePath, svgContent) {
  ensureDirectoryExists(path.dirname(filePath));
  fs.writeFileSync(filePath, optimizeSvg(svgContent), "utf8");
}

/**
 * Generate PNG from SVG
 * @param {string} svgContent - SVG content
 * @param {string} outputPath - Output file path
 * @param {number} size - Size in pixels
 */
async function generatePng(svgContent, outputPath, size) {
  ensureDirectoryExists(path.dirname(outputPath));

  try {
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(outputPath);
  } catch (error) {
    console.error(`Error generating PNG: ${outputPath}`, error);
  }
}

/**
 * Generate all static ghost assets
 */
async function generateAllGhostAssets() {
  console.log("📦 Generating ghost static assets...");

  // Create required directories
  ensureDirectoryExists(STATIC_DIR);
  ensureDirectoryExists(ASSETS_DIR);
  ensureDirectoryExists(ICONS_DIR);

  // Generate theme-specific assets
  for (const theme of THEMES) {
    // Generate static SVGs
    const staticGhost = generateStaticGhostSvg(theme);
    const iconGhost = generateIconGhostSvg(theme);
    const backgroundGhost = generateGhostBackgroundSvg(theme);

    // Save theme-specific SVGs
    saveSvg(
      path.join(
        ASSETS_DIR,
        `talktype-icon-bg-gradient${theme === "peach" ? "" : "-" + theme}.svg`,
      ),
      backgroundGhost,
    );

    // Also save at root level (matching existing structure)
    saveSvg(
      path.join(
        STATIC_DIR,
        `talktype-icon-bg-gradient${theme === "peach" ? "" : "-" + theme}.svg`,
      ),
      backgroundGhost,
    );

    console.log(`✅ Generated theme SVGs for ${theme}`);
  }

  // Generate base assets
  const baseIconGhost = generateIconGhostSvg("peach");

  // Save to base icon SVG path
  saveSvg(
    path.join(STATIC_DIR, "ghost-template.svg"),
    generateStaticGhostSvg("peach"),
  );
  saveSvg(path.join(ASSETS_DIR, "talktype-icon-base.svg"), baseIconGhost);

  // Generate eye layer
  const eyeLayerSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <path fill="#000000" d="${import("../src/lib/components/ghost/exportable/paths.js").GHOST_EYE_LEFT_PATH}" />
  <path fill="#000000" d="${import("../src/lib/components/ghost/exportable/paths.js").GHOST_EYE_RIGHT_PATH}" />
</svg>`;

  saveSvg(path.join(ASSETS_DIR, "talktype-icon-eyes.svg"), eyeLayerSvg);

  // Generate outline layer
  const outlineSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <path fill="#000000" d="${import("../src/lib/components/ghost/exportable/paths.js").GHOST_BODY_PATH}" />
</svg>`;

  saveSvg(path.join(ASSETS_DIR, "talktype-icon-outline.svg"), outlineSvg);

  // Generate combined icon
  const combinedSvg = generateStaticGhostSvg("peach");
  saveSvg(path.join(STATIC_DIR, "combined-icon.svg"), combinedSvg);

  // Generate favicon and apple-touch-icon
  await generatePng(combinedSvg, path.join(STATIC_DIR, "favicon.png"), 32);
  await generatePng(
    combinedSvg,
    path.join(STATIC_DIR, "favicon-light.png"),
    32,
  );
  await generatePng(combinedSvg, path.join(STATIC_DIR, "favicon-dark.png"), 32);
  await generatePng(
    combinedSvg,
    path.join(STATIC_DIR, "apple-touch-icon.png"),
    180,
  );

  // Generate OG image with a simpler approach
  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#FFF6E6" />
  <g transform="translate(400, 30) scale(0.6)">
    <path fill="url(#peachGradient)" d="${import("../src/lib/components/ghost/exportable/paths.js").GHOST_BODY_PATH}" />
    <path fill="#000000" d="${import("../src/lib/components/ghost/exportable/paths.js").GHOST_BODY_PATH}" />
    <path fill="#000000" d="${import("../src/lib/components/ghost/exportable/paths.js").GHOST_EYE_LEFT_PATH}" />
    <path fill="#000000" d="${import("../src/lib/components/ghost/exportable/paths.js").GHOST_EYE_RIGHT_PATH}" />
  </g>
  <defs>
    <linearGradient id="peachGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ff60e0;stop-opacity:1" />
      <stop offset="35%" style="stop-color:#ff82ca;stop-opacity:1" />
      <stop offset="65%" style="stop-color:#ff9a85;stop-opacity:1" />
      <stop offset="85%" style="stop-color:#ffb060;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ffcf40;stop-opacity:1" />
    </linearGradient>
  </defs>
  <text x="600" y="500" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="#333">
    Ziplist - Voice to Lists
  </text>
</svg>`;

  await generatePng(ogSvg, path.join(STATIC_DIR, "og-image.png"), 1200);

  // Generate PWA icons
  for (const size of ICON_SIZES) {
    await generatePng(
      combinedSvg,
      path.join(ICONS_DIR, `icon-${size}x${size}.png`),
      size,
    );
  }

  // Generate maskable icons (512x512)
  await generatePng(
    combinedSvg,
    path.join(ICONS_DIR, "icon-maskable-512x512.png"),
    512,
  );

  // Generate dark/light theme icons
  const lightThemeSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <path fill="#000000" d="${import("../src/lib/components/ghost/exportable/paths.js").GHOST_BODY_PATH}" />
</svg>`;

  const darkThemeSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <path fill="#FFFFFF" d="${import("../src/lib/components/ghost/exportable/paths.js").GHOST_BODY_PATH}" />
</svg>`;

  await generatePng(
    lightThemeSvg,
    path.join(ICONS_DIR, "icon-maskable-light-512x512.png"),
    512,
  );
  await generatePng(
    darkThemeSvg,
    path.join(ICONS_DIR, "icon-maskable-dark-512x512.png"),
    512,
  );

  console.log("✅ Generated all ghost static assets");
}

// The Vite plugin definition
export default function ghostAssetGenerator() {
  return {
    name: "ghost-asset-generator",

    // Hook into the build process
    buildStart: {
      // Make this sequential to avoid race conditions
      sequential: true,
      handler: async () => {
        await generateAllGhostAssets();
      },
    },

    // Also provide manual generation command for development
    api: {
      generateAssets: generateAllGhostAssets,
    },
  };
}

// Export standalone functions for direct use in scripts
export { generateAllGhostAssets };
