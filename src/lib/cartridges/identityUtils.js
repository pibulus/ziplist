/**
 * Membership identity generation.
 * Deterministically turns a vault hash into a ZipList contributor identity.
 */

const FALLBACK_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export const VERBS = [
  "drifts",
  "hums",
  "glows",
  "floats",
  "sings",
  "sparks",
  "roams",
  "blooms",
  "echoes",
  "whispers",
  "flickers",
  "wanders",
  "pulses",
  "shines",
  "orbits",
  "dances",
  "haunts",
  "buzzes",
  "ripples",
  "dreams",
  "naps",
  "juggles",
  "tumbles",
  "skips",
  "whistles",
  "shuffles",
  "ponders",
  "gallops",
  "dozes",
  "giggles",
  "waltzes",
  "rattles",
  "paddles",
  "wiggles",
  "salutes",
  "yodels",
  "bounces",
  "twirls",
  "snoozes",
  "hoots",
  "scuttles",
  "sighs",
  "glides",
  "cruises",
  "sparkles",
  "chimes",
  "strolls",
  "bounds",
  "soars",
  "grooves",
  "basks",
];

export const PLACES = [
  "quietly",
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
  "softly",
  "brightly",
  "boldly",
  "freely",
  "gently",
  "gladly",
  "warmly",
  "swiftly",
  "calmly",
  "proudly",
  "lightly",
  "nightly",
  "daily",
  "westward",
  "eastward",
  "northward",
  "southward",
  "starward",
  "moonward",
  "sunward",
  "forever",
];

export const ADJECTIVES = [
  "Speedy",
  "Sleepy",
  "Radiant",
  "Cosmic",
  "Pixel",
  "Neon",
  "Velvet",
  "Lunar",
  "Disco",
  "Glitch",
  "Breezy",
  "Mossy",
  "Golden",
  "Dreamy",
  "Fizzy",
  "Lucky",
  "Plucky",
  "Sunny",
  "Wavy",
  "Zippy",
  "Funky",
  "Silent",
  "Sneaky",
  "Retro",
  "Atomic",
  "Chunky",
  "Dapper",
  "Spry",
  "Loopy",
  "Vibrant",
  "Fuzzy",
  "Slick",
  "Brave",
  "Gentle",
  "Peppy",
  "Glossy",
  "Humble",
  "Zesty",
  "Mellow",
  "Crispy",
  "Swanky",
  "Jolly",
  "Nimble",
  "Quiet",
  "Bouncy",
  "Copper",
  "Wobbly",
  "Toasty",
  "Salty",
  "Starry",
  "Cozy",
  "Pastel",
  "Amber",
  "Coral",
  "Indigo",
  "Jade",
  "Maple",
  "Silver",
  "Tidy",
  "Clever",
  "Misty",
  "Wild",
  "Rowdy",
  "Daring",
];

export const ANIMALS = [
  "Goanna",
  "Panda",
  "Ghost",
  "Axolotl",
  "Capybara",
  "Corgi",
  "Koala",
  "Falcon",
  "Shark",
  "Otter",
  "Quokka",
  "Wombat",
  "Kookaburra",
  "Numbat",
  "Platypus",
  "Gecko",
  "Possum",
  "Rosella",
  "Bilby",
  "Wallaby",
  "Turtle",
  "Walrus",
  "Puffin",
  "Badger",
  "Raccoon",
  "Ferret",
  "Donkey",
  "Hedgehog",
  "Lobster",
  "Penguin",
  "Magpie",
  "Sparrow",
  "Weasel",
  "Yak",
  "Narwhal",
  "Pelican",
  "Lemur",
  "Alpaca",
  "Firefly",
  "Chameleon",
  "Flamingo",
  "Tapir",
  "Pangolin",
  "Ocelot",
  "Meerkat",
  "Manatee",
  "Toucan",
  "Kiwi",
  "Lynx",
  "Seal",
  "Heron",
  "Finch",
  "Newt",
  "Stoat",
  "Condor",
  "Ibis",
  "Marmot",
  "Pika",
  "Wren",
  "Robin",
];

export const NOUNS = ANIMALS;

const BG_COLORS = [
  "ffb3c6",
  "ffd1dc",
  "ffdfba",
  "ffd6a5",
  "fce4ec",
  "fff1a8",
  "fde68a",
  "ff9baa",
  "ffcad4",
  "ffddd2",
  "ffc8dd",
  "ffe5b4",
];

const SHAPE_COLORS = [
  "f7b89c",
  "f0c080",
  "f5c86b",
  "f4afa3",
  "f5b08e",
  "e6adc5",
  "d0bfd8",
  "f3caa7",
];

export function deriveHexHash(input) {
  const normalized = String(input || "")
    .trim()
    .toLowerCase();
  if (/^[0-9a-f]{64}$/.test(normalized)) {
    return normalized;
  }
  let hex = "";
  for (let chunk = 0; chunk < 8; chunk++) {
    let h = (0x811c9dc5 ^ Math.imul(chunk + 1, 0x9e3779b1)) >>> 0;
    for (let i = 0; i < normalized.length; i++) {
      h ^= normalized.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    hex += (h >>> 0).toString(16).padStart(8, "0");
  }
  return hex;
}

export function parseFourWordPasskey(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (parts.length !== 4) return null;

  const adj = ADJECTIVES.find((item) => item.toLowerCase() === parts[0]);
  const animal = ANIMALS.find((item) => item.toLowerCase() === parts[1]);
  const verb = VERBS.find((item) => item.toLowerCase() === parts[2]);
  const place = PLACES.find((item) => item.toLowerCase() === parts[3]);

  if (!adj || !animal || !verb || !place) return null;

  const phrase = `${adj.toLowerCase()}-${animal.toLowerCase()}-${verb.toLowerCase()}-${place.toLowerCase()}`;
  return {
    adj,
    animal,
    verb: verb.toLowerCase(),
    place: place.toLowerCase(),
    name: `${adj} ${animal}`,
    phrase,
    initials: `${adj[0]}${animal[0]}`,
    words: [
      adj.toLowerCase(),
      animal.toLowerCase(),
      verb.toLowerCase(),
      place.toLowerCase(),
    ],
  };
}

export function getSyncRoomId(input) {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  const parsed = parseFourWordPasskey(trimmed);
  const canonical = parsed ? parsed.phrase : trimmed.toLowerCase();
  return deriveHexHash(canonical);
}

function normalizeHash(vaultHash) {
  const raw = typeof vaultHash === "string" ? vaultHash.trim() : "";
  if (!raw) {
    return {
      hash: FALLBACK_HASH,
      isFallback: true,
    };
  }
  return {
    hash: /^[0-9a-f]{64}$/i.test(raw) ? raw.toLowerCase() : deriveHexHash(raw),
    isFallback: false,
  };
}

function hashToIndex(hash, array, offset = 0) {
  // hash is always a hex SHA-256 string here (normalizeHash guards the empty case)
  const segment = hash.slice(offset, offset + 8) || hash;
  return Number.parseInt(segment, 16) % array.length;
}

export function generateMemberIdentity(vaultHash, passkeyHint = "") {
  const parsedPasskey =
    parseFourWordPasskey(passkeyHint) || parseFourWordPasskey(vaultHash);
  if (parsedPasskey) {
    const canonicalHash = getSyncRoomId(parsedPasskey.phrase);
    const bg = BG_COLORS[hashToIndex(canonicalHash, BG_COLORS, 16)];
    const shape = SHAPE_COLORS[hashToIndex(canonicalHash, SHAPE_COLORS, 24)];
    const memberId = `ZL-${canonicalHash.slice(0, 4).toUpperCase()}-${canonicalHash.slice(4, 8).toUpperCase()}`;

    return {
      name: parsedPasskey.name,
      phrase: parsedPasskey.phrase,
      memberId,
      initials: parsedPasskey.initials,
      bg,
      shape,
      syncRoomId: canonicalHash,
      isFallback: false,
    };
  }

  const { hash, isFallback } = normalizeHash(vaultHash);
  if (isFallback) {
    return {
      name: "Passport Pending",
      phrase: "",
      memberId: "ZL-PENDING",
      initials: "ZL",
      bg: "fff1f2",
      shape: "f9a8d4",
      syncRoomId: "",
      isFallback: true,
    };
  }

  const adj = ADJECTIVES[hashToIndex(hash, ADJECTIVES, 0)];
  const animal = ANIMALS[hashToIndex(hash, ANIMALS, 8)];
  const bg = BG_COLORS[hashToIndex(hash, BG_COLORS, 16)];
  const shape = SHAPE_COLORS[hashToIndex(hash, SHAPE_COLORS, 24)];
  const verb = VERBS[hashToIndex(hash, VERBS, 32)];
  const place = PLACES[hashToIndex(hash, PLACES, 40)];
  const phrase = `${adj.toLowerCase()}-${animal.toLowerCase()}-${verb}-${place}`;
  const memberId = `ZL-${hash.slice(0, 4).toUpperCase()}-${hash.slice(4, 8).toUpperCase()}`;

  return {
    name: `${adj} ${animal}`,
    phrase,
    memberId,
    initials: `${adj[0]}${animal[0]}`,
    bg,
    shape,
    syncRoomId: getSyncRoomId(phrase),
    isFallback: false,
  };
}
