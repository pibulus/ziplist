/**
 * Pull-down-to-add: the decision math, extracted from the touch handler.
 *
 * The DOM wiring (is the page at the top? is a row mid-drag?) stays in
 * SingleList.svelte where the DOM is. What lives here is the part that is
 * pure and therefore checkable: given a finger delta, is this a pull, a
 * scroll, or a swipe — and how far along is it?
 *
 * Covered by scripts/check-pull-to-add.mjs.
 */

/** finger px → row px, before the soft cap. */
export const PULL_RESISTANCE = 0.6;
/** row px that commits the draft (~93px of finger travel). */
export const PULL_THRESHOLD = 56;
/** row px where the rubber band goes stiff. */
export const PULL_MAX = 84;
/** Slop before the gesture commits to a direction — the carousel's number. */
export const PULL_SLOP = 8;
/**
 * How decisively vertical has to beat horizontal. Mirrors the carousel's
 * bias exactly, so a diagonal resolves to swipe OR pull and never both:
 * the carousel takes it when |x| > |y| * 1.1, this takes it when
 * |y| > |x| * 1.1, and the wedge between them belongs to neither.
 */
export const PULL_DIRECTION_BIAS = 1.1;

/**
 * Damped travel. 1:1-ish under the cap, then a stiff tail so a long drag
 * still reads as "further" without the row eating the viewport.
 */
export function pullTravel(diffY) {
  const raw = diffY * PULL_RESISTANCE;
  if (raw <= PULL_MAX) return Math.max(0, raw);
  return Math.min(PULL_MAX * 1.25, PULL_MAX + (raw - PULL_MAX) * 0.3);
}

/**
 * Resolve a finger delta into one of three outcomes:
 *
 *   "waiting"  — inside the slop, nothing decided yet, keep listening
 *   "release"  — this is a scroll, a swipe, or an upward drag; let go of it
 *   "pulling"  — a downward vertical pull, with travel + armed state
 *
 * `locked` is whether the direction was already decided on an earlier move;
 * once locked, the gesture is ours and only travel changes.
 */
export function resolvePull(diffX, diffY, locked = false) {
  if (!locked) {
    if (Math.abs(diffX) < PULL_SLOP && Math.abs(diffY) < PULL_SLOP) {
      return { outcome: "waiting", distance: 0, armed: false };
    }
    if (
      diffY <= 0 ||
      Math.abs(diffY) <= Math.abs(diffX) * PULL_DIRECTION_BIAS
    ) {
      return { outcome: "release", distance: 0, armed: false };
    }
  }

  const distance = pullTravel(diffY);
  return {
    outcome: "pulling",
    distance,
    armed: distance >= PULL_THRESHOLD,
  };
}
