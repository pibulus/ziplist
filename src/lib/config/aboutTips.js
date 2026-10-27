// Shuffled pro-tips for Passport holders in AboutModal.
// Every open deals 3 fresh tips from a persistent deck so every tip comes
// round once before any repeats. Written in Sovereign Voice (no "you/your").

export const ABOUT_TIPS = [
  {
    id: "breath-categories",
    icon: "🎙️",
    text: "Speak a whole shopping run in one breath — items split onto clean rows automatically.",
  },
  {
    id: "inline-tags",
    icon: "🏷️",
    text: "Type #produce or #urgent inline to tag and group items on the fly.",
  },
  {
    id: "pull-to-add",
    icon: "⬇️",
    text: "Pull down at the top of any list to pop open a fresh item row.",
  },
  {
    id: "live-wave",
    icon: "👋",
    text: "In a live shared room, tap a peer's avatar at the top to send a quick wave.",
  },
  {
    id: "peer-bloom",
    icon: "🌸",
    text: "Ticked rows in live rooms bloom in the colour of the person who checked them off.",
  },
  {
    id: "four-word-sync",
    icon: "🔗",
    text: "Four words or one QR scan link a phone and laptop with end-to-end encryption.",
  },
  {
    id: "swipe-lists",
    icon: "👆",
    text: "Swipe left or right across the list card to hop between up to 12 colour lists.",
  },
  {
    id: "walkie-talkie",
    icon: "📻",
    text: "Tap the mic to start and stop, or hold it down like a walkie-talkie.",
  },
  {
    id: "holo-skins",
    icon: "🪩",
    text: "Tap the Passport card to shuffle holo skins, or tap the avatar to set a custom photo.",
  },
];

export const ABOUT_TIPS_PER_OPEN = 3;

/** Fisher–Yates shuffle with injectable random source for tests. */
function shuffle(items, random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Deal the next hand of tips.
 *
 * @param {object} [options]
 * @param {string[]} [options.deck] tip ids still to come, as last saved
 * @param {number} [options.count]
 * @param {typeof ABOUT_TIPS} [options.tips]
 * @param {() => number} [options.random]
 * @returns {{ hand: typeof ABOUT_TIPS, deck: string[] }}
 */
export function dealTips({
  deck = [],
  count = ABOUT_TIPS_PER_OPEN,
  tips = ABOUT_TIPS,
  random = Math.random,
} = {}) {
  const byId = new Map(tips.map((tip) => [tip.id, tip]));
  const size = Math.min(count, byId.size);
  let remaining = (Array.isArray(deck) ? deck : []).filter(
    (id, index, all) => byId.has(id) && all.indexOf(id) === index,
  );
  const hand = [];
  while (hand.length < size) {
    if (!remaining.length) {
      remaining = shuffle(
        [...byId.keys()].filter((id) => !hand.includes(id)),
        random,
      );
    }
    hand.push(remaining.shift());
  }
  return { hand: hand.map((id) => byId.get(id)), deck: remaining };
}
