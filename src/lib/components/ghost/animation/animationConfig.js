/**
 * Ghost Animation Configuration
 * Centralized configuration for ghost animation parameters
 */

// Import shared constants from animationConstants.js to prevent circular dependencies
import {
  ANIMATION_STATES,
  ANIMATION_TRANSITIONS,
  ANIMATION_BEHAVIORS,
  CSS_CLASSES,
  ANIMATION_TIMING,
  WOBBLE_CONFIG,
  BLINK_CONFIG,
  EYE_CONFIG,
  SPECIAL_CONFIG,
} from "./animationConstants";

// Re-export the constants
export {
  ANIMATION_STATES,
  ANIMATION_TRANSITIONS,
  ANIMATION_BEHAVIORS,
  CSS_CLASSES,
  ANIMATION_TIMING,
  WOBBLE_CONFIG,
  BLINK_CONFIG,
  EYE_CONFIG,
  SPECIAL_CONFIG,
};

export const PULSE_CONFIG = {
  DURATION: 600, // Duration of pulse animation (ms)
};

// Global animation parameters
export const ANIMATION_EFFECTS = {
  // Global parameters
  SHIMMER_OPACITY_MIN: 0.88,
  SHIMMER_OPACITY_MAX: 1.0,
  GRADIENT_SHIFT_MAGNITUDE: "4%",

  // Color pulse opacity ranges
  COLOR_PULSE_START_OPACITY_MIN: 0.9,
  COLOR_PULSE_START_OPACITY_MAX: 1.0,
  COLOR_PULSE_MID_OPACITY_MIN: 0.8,
  COLOR_PULSE_MID_OPACITY_MAX: 0.9,
  COLOR_PULSE_END_OPACITY_MIN: 0.85,
  COLOR_PULSE_END_OPACITY_MAX: 0.95,

  // Theme-specific animation parameters
  PEACH: {
    HUE_ROTATE_MIN: "-7deg",
    HUE_ROTATE_MAX: "9deg",
    SATURATE_MIN: 1.15,
    SATURATE_MAX: 1.4,
    BRIGHTNESS_MIN: 1,
    BRIGHTNESS_MAX: 1.07,
    SCALE_MIN: 1.0,
    SCALE_MID: 1.012,
    SCALE_STEPS: 1.005,
    TRANSFORM_Y_MIN: "0px",
    TRANSFORM_Y_MAX: "-2px",
    POSITION_SPEED: 0.1,
    POSITION_AMPLITUDE: "4%",
  },

  MINT: {
    HUE_ROTATE_MIN: "-2deg",
    HUE_ROTATE_MAX: "5deg",
    SATURATE_MIN: 1.2,
    SATURATE_MAX: 1.5,
    BRIGHTNESS_MIN: 1.05,
    BRIGHTNESS_MAX: 1.15,
    SCALE_MIN: 1.0,
    SCALE_MID: 1.015,
    SCALE_STEPS: 1.008,
    TRANSFORM_Y_MIN: "0px",
    TRANSFORM_Y_MAX: "-2px",
    POSITION_SPEED: 0.08,
    POSITION_AMPLITUDE: "4%",
  },

  BUBBLEGUM: {
    HUE_ROTATE_MIN: "-8deg",
    HUE_ROTATE_MAX: "8deg",
    SATURATE_MIN: 1.3,
    SATURATE_MAX: 1.7,
    BRIGHTNESS_MIN: 1.05,
    BRIGHTNESS_MAX: 1.15,
    SCALE_MIN: 1.0,
    SCALE_MID: 1.012,
    SCALE_STEPS: 1.006,
    TRANSFORM_Y_MIN: "0px",
    TRANSFORM_Y_MAX: "-2px",
    POSITION_SPEED: 0.06,
    POSITION_AMPLITUDE: "5%",
  },

  RAINBOW: {
    HUE_ROTATE_MIN: "0deg",
    HUE_ROTATE_MAX: "360deg",
    HUE_ROTATE_FULL_CYCLE: true,
    SATURATE_MIN: 1.4,
    SATURATE_MAX: 1.7,
    BRIGHTNESS_MIN: 1.15,
    BRIGHTNESS_MAX: 1.22,
    SCALE_MIN: 1.0,
    SCALE_MID: 1.012,
    SCALE_STEPS: 1.006,
    ROTATION_MIN: "0deg",
    ROTATION_MAX: "0.6deg",
    SHADOW_RADIUS_MIN: "8px",
    SHADOW_RADIUS_MAX: "20px",
    SHADOW_OPACITY_MIN: 0.35,
    SHADOW_OPACITY_MAX: 0.5,
    POSITION_SPEED: 0.12,
    POSITION_AMPLITUDE: "6%",
  },
};

/**
 * Animation Variable Injector
 *
 * This utility connects JavaScript animation configuration with CSS by
 * dynamically generating and injecting CSS variables from animationConfig
 */

/**
 * Generates CSS variables from animation config and returns CSS string
 */
export function generateAnimationCssVariables() {
  let cssVars = "";

  // Add animation timing variables
  cssVars += "/* Animation Timing Variables */\n";
  cssVars += `--ghost-transition: ${ANIMATION_TIMING.BASE_TRANSITION};\n`;
  cssVars += `--ghost-shimmer-duration: ${ANIMATION_TIMING.SHIMMER_DURATION};\n`;
  cssVars += `--ghost-shimmer-ease: ${ANIMATION_TIMING.SHIMMER_EASE};\n`;
  cssVars += `--ghost-gradientshift-duration: ${ANIMATION_TIMING.GRADIENT_SHIFT_DURATION};\n`;
  cssVars += `--ghost-colorpulse-duration: ${ANIMATION_TIMING.COLOR_PULSE_DURATION};\n`;
  cssVars += `--ghost-colorpulse-stagger: ${ANIMATION_TIMING.COLOR_PULSE_STAGGER};\n`;
  cssVars += `--ghost-eye-blink-transition: ${EYE_CONFIG.BLINK_TRANSITION};\n`;

  // Flow animation durations
  cssVars += `--ghost-peach-flow-duration: ${ANIMATION_TIMING.PEACH_FLOW_DURATION};\n`;
  cssVars += `--ghost-mint-flow-duration: ${ANIMATION_TIMING.MINT_FLOW_DURATION};\n`;
  cssVars += `--ghost-bubblegum-flow-duration: ${ANIMATION_TIMING.BUBBLEGUM_FLOW_DURATION};\n`;
  cssVars += `--ghost-rainbow-flow-duration: ${ANIMATION_TIMING.RAINBOW_FLOW_DURATION};\n`;

  // Flow animation easing
  cssVars += `--ghost-flow-ease: ${ANIMATION_TIMING.FLOW_EASE};\n`;

  // Add global animation parameters
  cssVars += "\n/* Global Animation Parameters */\n";
  cssVars += `--ghost-shimmer-opacity-min: ${ANIMATION_EFFECTS.SHIMMER_OPACITY_MIN};\n`;
  cssVars += `--ghost-shimmer-opacity-max: ${ANIMATION_EFFECTS.SHIMMER_OPACITY_MAX};\n`;
  cssVars += `--ghost-gradient-shift-magnitude: ${ANIMATION_EFFECTS.GRADIENT_SHIFT_MAGNITUDE};\n`;

  // Color pulse opacity ranges
  cssVars += `--ghost-colorpulse-start-opacity-min: ${ANIMATION_EFFECTS.COLOR_PULSE_START_OPACITY_MIN};\n`;
  cssVars += `--ghost-colorpulse-start-opacity-max: ${ANIMATION_EFFECTS.COLOR_PULSE_START_OPACITY_MAX};\n`;
  cssVars += `--ghost-colorpulse-mid-opacity-min: ${ANIMATION_EFFECTS.COLOR_PULSE_MID_OPACITY_MIN};\n`;
  cssVars += `--ghost-colorpulse-mid-opacity-max: ${ANIMATION_EFFECTS.COLOR_PULSE_MID_OPACITY_MAX};\n`;
  cssVars += `--ghost-colorpulse-end-opacity-min: ${ANIMATION_EFFECTS.COLOR_PULSE_END_OPACITY_MIN};\n`;
  cssVars += `--ghost-colorpulse-end-opacity-max: ${ANIMATION_EFFECTS.COLOR_PULSE_END_OPACITY_MAX};\n`;

  // Theme-specific parameters - Peach
  cssVars += "\n/* Peach Theme Animation Parameters */\n";
  Object.entries(ANIMATION_EFFECTS.PEACH).forEach(([key, value]) => {
    cssVars += `--ghost-peach-${key.toLowerCase()}: ${value};\n`;
  });

  // Theme-specific parameters - Mint
  cssVars += "\n/* Mint Theme Animation Parameters */\n";
  Object.entries(ANIMATION_EFFECTS.MINT).forEach(([key, value]) => {
    cssVars += `--ghost-mint-${key.toLowerCase()}: ${value};\n`;
  });

  // Theme-specific parameters - Bubblegum
  cssVars += "\n/* Bubblegum Theme Animation Parameters */\n";
  Object.entries(ANIMATION_EFFECTS.BUBBLEGUM).forEach(([key, value]) => {
    cssVars += `--ghost-bubblegum-${key.toLowerCase()}: ${value};\n`;
  });

  // Theme-specific parameters - Rainbow
  cssVars += "\n/* Rainbow Theme Animation Parameters */\n";
  Object.entries(ANIMATION_EFFECTS.RAINBOW).forEach(([key, value]) => {
    cssVars += `--ghost-rainbow-${key.toLowerCase()}: ${value};\n`;
  });

  return cssVars;
}

/**
 * Injects animation variables into the document
 */
export function injectAnimationVariables() {
  if (typeof document === "undefined") return;

  // Create or get a style element for our variables
  let styleElement = document.getElementById("ghost-animation-vars");
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = "ghost-animation-vars";
    document.head.appendChild(styleElement);
  }

  // Generate and inject CSS variables
  const cssVars = generateAnimationCssVariables();
  styleElement.textContent = `:root {\n  ${cssVars.replace(/\n/g, "\n  ")}\n}`;
}
