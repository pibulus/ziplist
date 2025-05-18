/**
 * Ghost SVG Export Utilities
 *
 * This module provides functions for exporting ghost SVGs for static asset generation.
 * It is used primarily by the build process.
 */

import {
  GHOST_BODY_PATH,
  GHOST_EYE_LEFT_PATH,
  GHOST_EYE_RIGHT_PATH,
  GHOST_BACKGROUND_PATH,
  GHOST_MOUTH_TOP_PATH,
  GHOST_MOUTH_BOTTOM_PATH,
  GHOST_TICK_TOP_PATH,
  GHOST_TICK_BOTTOM_PATH,
  THEME_COLORS,
} from "./paths";

// Re-export path constants for use in components
export {
  GHOST_BODY_PATH,
  GHOST_EYE_LEFT_PATH,
  GHOST_EYE_RIGHT_PATH,
  GHOST_BACKGROUND_PATH,
  GHOST_MOUTH_TOP_PATH,
  GHOST_MOUTH_BOTTOM_PATH,
  GHOST_TICK_TOP_PATH,
  GHOST_TICK_BOTTOM_PATH,
  THEME_COLORS,
};

/**
 * Generate a complete ghost SVG for a specific theme
 * @param {string} theme - Theme name (peach, mint, bubblegum, rainbow)
 * @param {Object} options - SVG generation options
 * @returns {string} Complete SVG as a string
 */
export function generateGhostSvg(theme = "peach", options = {}) {
  const {
    width = 1024,
    height = 1024,
    withEyes = true,
    forStatic = false,
    simplified = false,
  } = options;

  // Use hardcoded colors for static SVGs to avoid CSS variable dependencies
  const colors = THEME_COLORS[theme] || THEME_COLORS.peach;

  // Create ID prefix based on context
  const idPrefix = forStatic ? "" : "ziplist-ghost-";

  // Start SVG
  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ${!forStatic ? 'class="ghost-svg theme-' + theme + '"' : ""}>`;

  // Add gradient definitions
  svg += `
  <defs>
    <linearGradient id="${idPrefix}${theme}Gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" ${forStatic ? 'style="stop-color:' + colors.start + ';stop-opacity:1"' : 'stop-color="var(--ghost-' + theme + "-start, " + colors.start + ')"'} />
      <stop offset="35%" ${forStatic ? 'style="stop-color:' + colors.mid1 + ';stop-opacity:1"' : 'stop-color="var(--ghost-' + theme + "-mid1, " + colors.mid1 + ')"'} />
      <stop offset="65%" ${forStatic ? 'style="stop-color:' + colors.mid2 + ';stop-opacity:1"' : 'stop-color="var(--ghost-' + theme + "-mid2, " + colors.mid2 + ')"'} />
      <stop offset="85%" ${forStatic ? 'style="stop-color:' + colors.mid3 + ';stop-opacity:1"' : 'stop-color="var(--ghost-' + theme + "-mid3, " + colors.mid3 + ')"'} />
      <stop offset="100%" ${forStatic ? 'style="stop-color:' + colors.end + ';stop-opacity:1"' : 'stop-color="var(--ghost-' + theme + "-end, " + colors.end + ')"'} />
    </linearGradient>
  </defs>`;

  // Background layer
  svg += `
  <g${!forStatic ? ' class="ghost-layer ghost-bg"' : ""}>
    <path${!forStatic ? ' class="ghost-shape" id="ghost-shape"' : ""} fill="url(#${idPrefix}${theme}Gradient)" d="${GHOST_BODY_PATH}" />
  </g>`;

  // Outline layer - only if not simplified
  if (!simplified) {
    svg += `
  <g${!forStatic ? ' class="ghost-layer ghost-outline"' : ""}>
    <path${!forStatic ? ' class="ghost-outline-path"' : ""} fill="#000000" opacity="1" d="${GHOST_BODY_PATH}" />
  </g>`;
  }

  // Eyes layer - only if withEyes is true
  if (withEyes) {
    svg += `
  <g${!forStatic ? ' class="ghost-layer ghost-eyes"' : ""}>
    <path${!forStatic ? ' class="ghost-eye ghost-eye-left"' : ""} fill="#000000" d="${GHOST_EYE_LEFT_PATH}" />
    <path${!forStatic ? ' class="ghost-eye ghost-eye-right"' : ""} fill="#000000" d="${GHOST_EYE_RIGHT_PATH}" />
  </g>`;
  }

  // Close SVG
  svg += `
</svg>`;

  return svg;
}

/**
 * Generate static ghost SVG for a specific theme
 * @param {string} theme - Theme name
 * @returns {string} SVG optimized for static use
 */
export function generateStaticGhostSvg(theme = "peach") {
  return generateGhostSvg(theme, {
    forStatic: true,
    simplified: false,
    withEyes: true,
  });
}

/**
 * Generate icon version of ghost SVG (simplified, for small sizes)
 * @param {string} theme - Theme name
 * @returns {string} SVG optimized for icon use
 */
export function generateIconGhostSvg(theme = "peach") {
  return generateGhostSvg(theme, {
    forStatic: true,
    simplified: true,
    withEyes: true,
  });
}

/**
 * Generate ghost SVG background only (for layered use)
 * @param {string} theme - Theme name
 * @returns {string} SVG with only the background layer
 */
export function generateGhostBackgroundSvg(theme = "peach") {
  return generateGhostSvg(theme, {
    forStatic: true,
    simplified: true,
    withEyes: false,
  });
}

export default {
  generateGhostSvg,
  generateStaticGhostSvg,
  generateIconGhostSvg,
  generateGhostBackgroundSvg,
};
