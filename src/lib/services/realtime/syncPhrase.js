// ═══════════════════════════════════════════════════════════════════════════
// 🔑 syncPhrase — carry a list to another device by typing four words
// ═══════════════════════════════════════════════════════════════════════════
// No accounts, no auth, no login. You read four words off one screen and type
// them into another, and the list follows. The phrase deterministically
// derives a live-room id, so both devices land in the same PartyKit room and
// the existing live-list machinery does the rest.
//
// DELIBERATE TRADEOFF (Pablo's call): the phrase IS the secret, exactly like
// the room id already is elsewhere in this app ("the room id IS the secret —
// no passwords", conversationProtocol.ts). Four words from these banks is
// ~1.6 million combinations. That is convenience-first, and correct for a
// shopping list — it is NOT a vault, and nothing here should ever be reused
// for anything that wants to be one.

const ADJECTIVES = [
  "neon",
  "funky",
  "silent",
  "sneaky",
  "cosmic",
  "retro",
  "atomic",
  "chunky",
  "dapper",
  "spry",
  "loopy",
  "vibrant",
  "fuzzy",
  "gloomy",
  "slick",
  "brave",
  "wild",
  "gentle",
  "sleepy",
  "peppy",
  "glossy",
  "rowdy",
  "humble",
  "zesty",
  "mellow",
  "crispy",
  "plucky",
  "swanky",
  "jolly",
  "nimble",
  "quiet",
  "sunny",
  "bouncy",
  "velvet",
  "copper",
  "wobbly",
  "breezy",
  "toasty",
  "salty",
  "lucky",
];

const NOUNS = [
  "turtle",
  "lantern",
  "pickle",
  "comet",
  "walrus",
  "muffin",
  "cactus",
  "otter",
  "kettle",
  "puffin",
  "noodle",
  "badger",
  "pebble",
  "raccoon",
  "mango",
  "wombat",
  "satchel",
  "gecko",
  "pancake",
  "ferret",
  "thistle",
  "marble",
  "donkey",
  "waffle",
  "hedgehog",
  "biscuit",
  "lobster",
  "acorn",
  "penguin",
  "teapot",
  "magpie",
  "pumpkin",
  "anchor",
  "sparrow",
  "domino",
  "weasel",
  "kazoo",
  "parsnip",
  "yak",
  "bagel",
];

const VERBS = [
  "drifts",
  "hums",
  "naps",
  "wanders",
  "juggles",
  "tumbles",
  "skips",
  "hoards",
  "whistles",
  "shuffles",
  "ponders",
  "orbits",
  "gallops",
  "dozes",
  "giggles",
  "sneezes",
  "waltzes",
  "blooms",
  "rattles",
  "paddles",
  "wiggles",
  "salutes",
  "yodels",
  "sulks",
  "bounces",
  "grumbles",
  "twirls",
  "snoozes",
  "hoots",
  "scuttles",
  "flops",
  "sighs",
];

const PLACES = [
  "uptown",
  "sideways",
  "downstairs",
  "offshore",
  "backwards",
  "nearby",
  "overboard",
  "homeward",
  "onstage",
  "outback",
  "seaside",
  "midair",
  "underfoot",
  "roadside",
  "skyward",
  "indoors",
  "poolside",
  "upstream",
  "yonder",
  "aloft",
  "ashore",
  "afield",
  "abroad",
  "inland",
  "lakeside",
  "treetop",
  "rooftop",
  "streetwise",
  "campside",
  "harbourside",
  "trackside",
  "hillside",
];

const BANKS = [ADJECTIVES, NOUNS, VERBS, PLACES];

/** How many distinct phrases exist. Surfaced so the tradeoff stays visible. */
export const SYNC_PHRASE_COMBINATIONS = BANKS.reduce(
  (total, bank) => total * bank.length,
  1,
);

export const SYNC_ROOM_PREFIX = "zl_p";

/** A phrase-derived room id: the prefix plus 32 lowercase hex characters. */
export const SYNC_ROOM_PATTERN = /^zl_p[0-9a-f]{32}$/;

function pick(bank) {
  const max = Math.floor(0xffffffff / bank.length) * bank.length;
  const buf = new Uint32Array(1);
  let value;
  // Reject the ragged tail so every word stays equally likely.
  do {
    globalThis.crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= max);
  return bank[value % bank.length];
}

/** Four words, hyphenated — readable off a screen, typeable on a phone. */
export function generateSyncPhrase() {
  return BANKS.map(pick).join("-");
}

/**
 * Forgiving on input: case, spaces, underscores and stray punctuation all
 * normalize to the same phrase, because people retype these by hand.
 */
export function normalizeSyncPhrase(value) {
  return (value ?? "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join("-");
}

/** Does this look like a phrase we could derive a room from? */
export function isValidSyncPhrase(value) {
  const words = normalizeSyncPhrase(value).split("-").filter(Boolean);
  return words.length === BANKS.length;
}

/**
 * Deterministic phrase -> room id. Same words on any device, same room.
 * SHA-256 truncated to 128 bits: the hash is a naming function here, not a
 * security boundary — the phrase's own entropy is the ceiling either way.
 */
export async function deriveRoomIdFromPhrase(value) {
  const normalized = normalizeSyncPhrase(value);
  if (!isValidSyncPhrase(normalized)) return "";

  const bytes = new TextEncoder().encode(`ziplist:sync:v1:${normalized}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${SYNC_ROOM_PREFIX}${hex.slice(0, 32)}`;
}
