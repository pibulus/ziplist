/**
 * 🪶 WEIGHTLESS
 * The Gold Standard of Procedural Audio for Web Interfaces.
 * 0kb assets. 100% Soul.
 * 
 * Modular, independent, and organic.
 *
 * ⚠️ VENDORED — this is a verbatim copy of pibulus/weightless (v1.3.0).
 * Keep it app-agnostic and do NOT hand-edit it: ZipList overrides every
 * voice/cue via ZIPLIST_VOICES/ZIPLIST_CUES in soundService.js, which is
 * where app-specific sound belongs. Changes go upstream first, then get
 * copied down.
 *
 * It drifted once and cost real things: the fork was missing RESERVED_PROPS
 * (so `await soundService.x()` hung forever on the Proxy's fake .then()),
 * the `hover` cue, sequence(), phrase() and noteAt(). Re-synced 2026-08-24.

 */

const MASTER_LEVEL = 0.65;
const MIN_GAIN = 0.0001;

// Props the magic Proxy must never treat as cue names.
// Without this, `await sounds` calls the fake .then() and hangs forever.
const RESERVED_PROPS = new Set(["then", "catch", "finally", "toJSON"]);

// Utility: Convert cents to frequency ratio
const centsToRatio = (cents) => Math.pow(2, cents / 1200);

/**
 * Default Voice Presets
 */
export const WEIGHTLESS_VOICES = {
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
  warn: {
    type: "sine",
    lowpass: 1200,
    attack: 0.007,
    bendCents: -45,
  },
};

/**
 * Default Sound Cues
 */
export const WEIGHTLESS_CUES = {
  select: {
    cooldownMs: 45,
    detuneCents: 7,
    variants: [
      [{ frequency: 620, duration: 0.046, gain: 0.022, voice: "tap" }],
      [{ frequency: 700, duration: 0.04, gain: 0.019, voice: "bloom" }],
    ],
  },
  success: {
    cooldownMs: 200,
    detuneCents: 10,
    variants: [
      [
        { frequency: 523.25, duration: 0.07, gain: 0.03, voice: "tap" },
        {
          frequency: 659.25,
          offset: 0.06,
          duration: 0.08,
          gain: 0.025,
          voice: "bloom",
        },
        {
          frequency: 783.99,
          offset: 0.12,
          duration: 0.14,
          gain: 0.02,
          voice: "sparkle",
        },
      ],
    ],
  },
  error: {
    cooldownMs: 150,
    variants: [
      [
        { frequency: 220, duration: 0.12, gain: 0.03, voice: "warn" },
        {
          frequency: 180,
          offset: 0.08,
          duration: 0.15,
          gain: 0.025,
          voice: "warn",
        },
      ],
    ],
  },
  hover: {
    cooldownMs: 60,
    detuneCents: 4,
    variants: [
      [{ frequency: 950, duration: 0.03, gain: 0.004, voice: "sparkle" }],
    ],
  },
  toggleOn: {
    cooldownMs: 80,
    detuneCents: 5,
    variants: [
      [
        { frequency: 440, duration: 0.045, gain: 0.022, voice: "tap" },
        {
          frequency: 587.33,
          offset: 0.05,
          duration: 0.06,
          gain: 0.02,
          voice: "bloom",
        },
      ],
    ],
  },
  toggleOff: {
    cooldownMs: 80,
    detuneCents: 5,
    variants: [
      [
        { frequency: 587.33, duration: 0.045, gain: 0.022, voice: "tap" },
        {
          frequency: 392.0,
          offset: 0.05,
          duration: 0.06,
          gain: 0.018,
          voice: "knock",
        },
      ],
    ],
  },
  notify: {
    cooldownMs: 300,
    detuneCents: 6,
    variants: [
      [
        { frequency: 880, duration: 0.08, gain: 0.022, voice: "sparkle" },
        {
          frequency: 1174.66,
          offset: 0.09,
          duration: 0.12,
          gain: 0.018,
          voice: "bloom",
        },
      ],
    ],
  },
};

export class Weightless {
  constructor(options = {}) {
    this.context = null;
    this.masterGain = null;
    this.enabled = options.enabled ?? true;
    this.volume = options.volume ?? 0.8;
    this.sharedState = options.sharedState ?? true;

    // Shared SoftStack sound state: siblings like @softstack/juicy-sounds
    // write the same 'softstack:sound' key — one mute choice rules them all.
    if (this.sharedState) {
      try {
        const stored = JSON.parse(localStorage.getItem("softstack:sound"));
        if (stored && typeof stored === "object") {
          if (typeof stored.enabled === "boolean")
            this.enabled = stored.enabled;
          if (typeof stored.volume === "number") this.volume = stored.volume;
        }
      } catch (e) {
        /* SSR / privacy mode / bad JSON — use defaults */
      }
    }

    this.randomness = options.randomness ?? 1.0;
    this.masterLevel = options.masterLevel ?? MASTER_LEVEL;
    this.panWidth = options.panWidth ?? 0.15;
    this.humanize = (options.humanizeMs ?? 5) / 1000;
    this.compressor = options.compressor ?? true;
    this.cues = { ...WEIGHTLESS_CUES, ...options.cues };
    this.voices = { ...WEIGHTLESS_VOICES, ...options.voices };
    this.scale = options.scale || [
      392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66,
      1318.51,
    ];
    this.lastPlayed = new Map();

    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        if (typeof prop === "string" && !RESERVED_PROPS.has(prop)) {
          return (opts) => target.play(prop, opts);
        }
        return undefined;
      },
    });
  }

  async getContext() {
    if (typeof window === "undefined") return null;
    if (!this.context || this.context.state === "closed") {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.context = new AudioContext();
      this.masterGain = null; // old chain belongs to a dead context
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    return this.context;
  }

  ensureMasterChain(context) {
    if (this.masterGain && this.context === context) {
      this.masterGain.gain.setTargetAtTime(
        this.masterLevel * this.volume,
        context.currentTime,
        0.01,
      );
      return this.masterGain;
    }

    const masterGain = context.createGain();
    masterGain.gain.value = this.masterLevel * this.volume;

    if (this.compressor) {
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-20, context.currentTime);
      compressor.knee.setValueAtTime(18, context.currentTime);
      compressor.ratio.setValueAtTime(4, context.currentTime);
      compressor.attack.setValueAtTime(0.003, context.currentTime);
      compressor.release.setValueAtTime(0.08, context.currentTime);

      masterGain.connect(compressor);
      compressor.connect(context.destination);
    } else {
      masterGain.connect(context.destination);
    }

    this.masterGain = masterGain;
    this.context = context;
    return masterGain;
  }

  // Centered humanization: randomness 0 = exactly `center`, 1 = full ±spread
  jitter(center, spread) {
    return center + (Math.random() - 0.5) * 2 * spread * this.randomness;
  }

  play(cueName, options = {}) {
    if (!this.enabled) return false;

    const cue = this.cues[cueName] || this.cues.select;
    const now = Date.now();
    const lastTime = this.lastPlayed.get(cueName) || 0;

    if (now - lastTime < (cue.cooldownMs || 0) && !options.force) {
      return false;
    }

    this.lastPlayed.set(cueName, now);
    this._executePlay(cue, options);
    return true;
  }

  async _executePlay(cue, options = {}) {
    const context = await this.getContext();
    if (!context) return;

    const masterNode = this.ensureMasterChain(context);
    const variants = cue.variants || [];
    const variant =
      variants[Math.floor(Math.random() * variants.length)] || variants[0];
    if (!variant) return;

    variant.forEach((note) =>
      this.scheduleTone(context, cue, note, masterNode, options),
    );
  }

  scheduleTone(context, cue, note, masterNode, options = {}) {
    const voice = this.voices[note.voice] || this.voices.tap;
    const delay =
      (note.offset || 0) + (options.delay || 0) + this.jitter(0, this.humanize);
    const startAt = Math.max(context.currentTime, context.currentTime + delay);
    const duration = note.duration || 0.05;

    const detuneRatio = centsToRatio(this.jitter(0, cue.detuneCents || 0));
    const frequency =
      (options.frequency ?? note.frequency ?? 440) * detuneRatio;
    const gainValue = Math.max(
      MIN_GAIN,
      (options.gain ?? note.gain ?? 0.02) * this.jitter(1, 0.1),
    );

    const noteGain = context.createGain();
    const panner = context.createStereoPanner
      ? context.createStereoPanner()
      : null;

    let lastNode = noteGain;

    if (voice.lowpass) {
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(voice.lowpass, startAt);
      filter.Q.setValueAtTime(voice.q ?? 0.7, startAt);
      lastNode.connect(filter);
      lastNode = filter;
    }

    if (panner) {
      panner.pan.value = this.jitter(0, this.panWidth);
      lastNode.connect(panner);
      lastNode = panner;
    }

    lastNode.connect(masterNode);

    noteGain.gain.setValueAtTime(MIN_GAIN, startAt);
    noteGain.gain.exponentialRampToValueAtTime(
      gainValue,
      startAt + (voice.attack || 0.005),
    );
    noteGain.gain.exponentialRampToValueAtTime(MIN_GAIN, startAt + duration);

    const partials = [
      { ratio: 1, gain: 1, type: voice.type },
      ...(voice.partials || []),
    ];

    partials.forEach((partial) => {
      const osc = context.createOscillator();
      const pGain = context.createGain();

      osc.type = partial.type || "sine";
      osc.frequency.setValueAtTime(frequency * (partial.ratio || 1), startAt);

      if (voice.bendCents) {
        osc.frequency.exponentialRampToValueAtTime(
          frequency * centsToRatio(voice.bendCents),
          startAt + duration,
        );
      }

      pGain.gain.value = partial.gain || 1;
      osc.connect(pGain);
      pGain.connect(noteGain);

      osc.start(startAt);
      osc.stop(startAt + duration + 0.1);

      osc.onended = () => {
        osc.disconnect();
        pGain.disconnect();
      };
    });

    setTimeout(
      () => {
        noteGain.disconnect();
        try {
          lastNode.disconnect();
        } catch (e) {}
      },
      (delay + duration + 0.2) * 1000,
    );
  }

  getSparkleNote(offset = 0) {
    const index = Math.floor(Math.random() * this.scale.length);
    return this.scale[(index + offset + this.scale.length) % this.scale.length];
  }

  /**
   * The note for a POSITION rather than a random one.
   *
   * This is the audio half of a visual gradient. A list whose cards are
   * tinted `colours[i]` can be voiced `noteAt(i)`, and the pitch climbs in
   * step with the colour because both read the same index. That pairing is
   * the whole point — hover the third card, hear the third note.
   *
   * Two behaviours, picked by whether you know the run length:
   *   noteAt(i)             → one scale step per item, wrapping past the top
   *   noteAt(i, {total: n}) → spread n items across the whole scale, so a
   *                           3-item run and a 30-item run both sweep the
   *                           same range end to end
   *
   * @param {number} index - 0-based position in the run
   * @param {Object} [opts]
   * @param {number} [opts.total] - run length; enables spread mode
   * @param {number} [opts.offset=0] - shift the whole run up/down the scale
   * @returns {number|null} frequency in Hz
   */
  noteAt(index, { total, offset = 0 } = {}) {
    const len = this.scale.length;
    if (!len || !Number.isFinite(index)) return null;

    const degree =
      Number.isFinite(total) && total > 1
        ? Math.round(
            (Math.min(Math.max(index, 0), total - 1) / (total - 1)) * (len - 1),
          )
        : Math.floor(index);

    return this.scale[(((degree + offset) % len) + len) % len];
  }

  /**
   * Play a cue at a position's pitch. The one-liner for gradient hovers:
   *
   *   on:mouseenter={() => sounds.playAt('hover', i, { total: items.length })}
   *
   * @param {string} cueName
   * @param {number} index
   * @param {Object} [opts] - noteAt options plus anything play() accepts
   */
  playAt(cueName, index, opts = {}) {
    const { total, offset, ...playOpts } = opts;
    const frequency = this.noteAt(index, { total, offset });
    if (frequency === null) return;
    return this.play(cueName, { ...playOpts, frequency });
  }

  /**
   * Sequence a melody (frequencies in Hz, or {frequency, gain} objects)
   */
  async sequence(notes, interval = 0.15, cueName = "select") {
    const context = await this.getContext();
    if (!context) return;

    notes.forEach((note, i) => {
      const freq = typeof note === "number" ? note : note.frequency;
      this.play(cueName, {
        frequency: freq,
        gain: note.gain,
        delay: i * interval,
        force: true,
      });
    });
  }

  /**
   * Play a coherent arpeggio: one random root, then scale degrees relative to it.
   * phrase([0, 2, 4, 7]) always sounds musical — unlike stacking random notes.
   */
  phrase(degrees = [0, 2, 4, 7], interval = 0.12, cueName = "select") {
    const len = this.scale.length;
    const root = Math.floor(Math.random() * len);
    const notes = degrees.map(
      (d) => this.scale[(((root + d) % len) + len) % len],
    );
    return this.sequence(notes, interval, cueName);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.context) {
      this.context.suspend().catch(() => {});
    }
    this._saveSharedState();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(
        this.masterLevel * this.volume,
        this.context.currentTime,
        0.01,
      );
    }
    this._saveSharedState();
  }

  _saveSharedState() {
    if (!this.sharedState) return;
    try {
      localStorage.setItem(
        "softstack:sound",
        JSON.stringify({ enabled: this.enabled, volume: this.volume }),
      );
    } catch (e) {
      /* SSR / privacy mode — no persistence */
    }
  }

  panic() {
    if (this.context) {
      this.context.close().catch(() => {});
      this.context = null;
      this.masterGain = null;
    }
  }
}

export const weightless = new Weightless();
