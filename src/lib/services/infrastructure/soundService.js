import { Weightless } from "./weightless";
import { STORAGE_KEYS } from "$lib/constants";

/**
 * Ziplist Specific Voice Presets
 */
const ZIPLIST_VOICES = {
  tap: {
    type: "triangle",
    lowpass: 2800,
    attack: 0.006,
    partials: [{ ratio: 2.01, gain: 0.2, type: "sine" }],
  },
  bloom: {
    type: "sine",
    lowpass: 3800,
    attack: 0.01,
    partials: [{ ratio: 1.5, gain: 0.12, type: "triangle" }],
  },
  knock: {
    type: "sine",
    lowpass: 1400,
    attack: 0.005,
    bendCents: -60,
  },
  sparkle: {
    type: "sine",
    lowpass: 4300,
    attack: 0.004,
    partials: [{ ratio: 2, gain: 0.15, type: "sine" }],
  },
  warm: {
    type: "triangle",
    lowpass: 2200,
    attack: 0.008,
    partials: [{ ratio: 0.5, gain: 0.18, type: "sine" }],
  },
  warn: {
    type: "sine",
    lowpass: 1200,
    attack: 0.007,
    bendCents: -45,
  },
};

/**
 * Ziplist Specific Sound Cues
 */
const ZIPLIST_CUES = {
  select: {
    cooldownMs: 45,
    detuneCents: 7,
    gainJitter: 0.1,
    variants: [
      [{ frequency: 620, duration: 0.046, gain: 0.022, voice: "tap" }],
      [{ frequency: 700, duration: 0.04, gain: 0.019, voice: "bloom" }],
    ],
  },
  add: {
    cooldownMs: 90,
    detuneCents: 8,
    gainJitter: 0.1,
    variants: [
      [
        { frequency: 430, duration: 0.045, gain: 0.02, voice: "tap" },
        {
          frequency: 645,
          offset: 0.04,
          duration: 0.064,
          gain: 0.02,
          voice: "bloom",
        },
      ],
      [
        { frequency: 480, duration: 0.04, gain: 0.019, voice: "tap" },
        {
          frequency: 720,
          offset: 0.036,
          duration: 0.06,
          gain: 0.018,
          voice: "bloom",
        },
      ],
    ],
  },
  check: {
    cooldownMs: 70,
    detuneCents: 9,
    gainJitter: 0.12,
    variants: [
      [
        { frequency: 740, duration: 0.036, gain: 0.021, voice: "sparkle" },
        {
          frequency: 990,
          offset: 0.034,
          duration: 0.046,
          gain: 0.018,
          voice: "bloom",
        },
      ],
    ],
  },
  uncheck: {
    cooldownMs: 80,
    detuneCents: 5,
    variants: [
      [
        { frequency: 460, duration: 0.04, gain: 0.019, voice: "tap" },
        {
          frequency: 310,
          offset: 0.034,
          duration: 0.055,
          gain: 0.016,
          voice: "knock",
        },
      ],
    ],
  },
  complete: {
    cooldownMs: 260,
    detuneCents: 8,
    variants: [
      [
        { frequency: 520, duration: 0.045, gain: 0.022, voice: "tap" },
        {
          frequency: 780,
          offset: 0.045,
          duration: 0.055,
          gain: 0.02,
          voice: "bloom",
        },
        {
          frequency: 1170,
          offset: 0.094,
          duration: 0.075,
          gain: 0.018,
          voice: "sparkle",
        },
      ],
    ],
  },
  delete: {
    cooldownMs: 100,
    variants: [
      [
        { frequency: 330, duration: 0.045, gain: 0.018, voice: "knock" },
        {
          frequency: 240,
          offset: 0.038,
          duration: 0.06,
          gain: 0.014,
          voice: "warm",
        },
      ],
    ],
  },
  start: {
    cooldownMs: 120,
    variants: [
      [
        { frequency: 392, duration: 0.058, gain: 0.027, voice: "tap" },
        {
          frequency: 588,
          offset: 0.052,
          duration: 0.074,
          gain: 0.023,
          voice: "bloom",
        },
      ],
    ],
  },
  stop: {
    cooldownMs: 120,
    variants: [
      [
        { frequency: 620, duration: 0.046, gain: 0.024, voice: "tap" },
        {
          frequency: 370,
          offset: 0.044,
          duration: 0.08,
          gain: 0.022,
          voice: "knock",
        },
      ],
    ],
  },
  copy: {
    cooldownMs: 140,
    variants: [
      [
        { frequency: 740, duration: 0.038, gain: 0.021, voice: "sparkle" },
        {
          frequency: 932,
          offset: 0.038,
          duration: 0.044,
          gain: 0.019,
          voice: "bloom",
        },
      ],
    ],
  },
  locked: {
    cooldownMs: 120,
    variants: [
      [{ frequency: 260, duration: 0.072, gain: 0.022, voice: "knock" }],
    ],
  },
  error: {
    cooldownMs: 160,
    variants: [
      [
        { frequency: 250, duration: 0.06, gain: 0.02, voice: "warn" },
        {
          frequency: 210,
          offset: 0.058,
          duration: 0.09,
          gain: 0.018,
          voice: "warn",
        },
      ],
    ],
  },
  // Drag-reorder landing — a real thunk instead of the generic select
  // fallback (play() falls back to 'select' for unknown cues, so drops
  // used to sound like taps).
  drop: {
    cooldownMs: 90,
    detuneCents: 6,
    variants: [
      [
        { frequency: 300, duration: 0.05, gain: 0.024, voice: "knock" },
        {
          frequency: 210,
          offset: 0.04,
          duration: 0.07,
          gain: 0.018,
          voice: "warm",
        },
      ],
    ],
  },
  // Spin-mode ratchet — one soft tick per card flying past, the audio
  // half of the slot-machine haptic. Quiet and quick so a full-revolution
  // spin clicks like a bike wheel, never clatters.
  ratchet: {
    cooldownMs: 30,
    detuneCents: 14,
    gainJitter: 0.2,
    variants: [
      [{ frequency: 880, duration: 0.018, gain: 0.011, voice: "tap" }],
      [{ frequency: 830, duration: 0.02, gain: 0.01, voice: "sparkle" }],
    ],
  },
  open: {
    variants: [[{ frequency: 520, duration: 0.05, gain: 0.022, voice: "tap" }]],
  },
  close: {
    variants: [
      [{ frequency: 430, duration: 0.06, gain: 0.02, voice: "knock" }],
    ],
  },
};

function getStoredEnabled() {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(STORAGE_KEYS.SOUND_CUES) !== "false";
}

/**
 * The Ziplist Sound Service
 * Powered by 🪶 Weightless
 */
class ZiplistSoundService extends Weightless {
  constructor() {
    super({
      cues: ZIPLIST_CUES,
      voices: ZIPLIST_VOICES,
      enabled: getStoredEnabled(),
    });
  }

  // Handle aliases not covered by Proxy automatically if needed
  // (Proxy handles them if the cue name exists, but we want .success() to play 'copy')
  success(opts) {
    return this.play("copy", opts);
  }
  copySuccess(opts) {
    return this.play("copy", opts);
  }
  startRecording(opts) {
    return this.play("start", opts);
  }
  stopRecording(opts) {
    return this.play("stop", opts);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SOUND_CUES, enabled.toString());
    }
    if (!enabled && this.context) {
      this.context.suspend().catch(() => {});
    }
  }

  enable() {
    this.setEnabled(true);
  }
  disable() {
    this.setEnabled(false);
  }
  isEnabled() {
    return this.enabled;
  }
}

export const soundService = new ZiplistSoundService();
