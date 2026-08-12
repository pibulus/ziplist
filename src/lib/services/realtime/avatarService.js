/**
 * Avatar Service
 *
 * Generates and persists random avatar names like "Misty Fox" or "Happy Frog"
 * for anonymous user identification in live collaboration. Names are editable
 * (Options → your room name); faces come from DiceBear's thumbs collection,
 * generated offline as SVG data-URIs (no network, no CSP concerns) and seeded
 * by the name so the same name always wears the same face.
 */
import { createAvatar } from "@dicebear/core";
import { thumbs } from "@dicebear/collection";

const ADJECTIVES = [
  "Misty",
  "Happy",
  "Quiet",
  "Bright",
  "Swift",
  "Gentle",
  "Bold",
  "Calm",
  "Eager",
  "Mellow",
  "Clever",
  "Lucky",
  "Brave",
  "Kind",
  "Wise",
  "Jolly",
  "Noble",
  "Zesty",
];

const ANIMALS = [
  "Fox",
  "Frog",
  "Owl",
  "Deer",
  "Wolf",
  "Bear",
  "Lynx",
  "Hawk",
  "Otter",
  "Raven",
  "Seal",
  "Eagle",
  "Panda",
  "Tiger",
  "Koala",
  "Dove",
  "Swan",
  "Hare",
];

const STORAGE_KEY = "ziplist_user_avatar";
// Twelve slots, evenly spaced 30° around the wheel and held at a single
// lightness, so no two people in a room ever get near-twins and nobody's dot
// reads heavier than anyone else's. Anchored on ZipList's own hot pink rather
// than picked at random.
//
// What was here before was a grab-bag of stock Open Color library values
// (#51cf66, #4dabf7, #20c997, #f783ac are all straight out of the box) — two
// near-identical yellows 5° apart, and a lightness spread of 46%-74% that made
// some avatars look washed out beside others.
//
// The colour is the FACE: DiceBear "thumbs" renders with a transparent
// background, so this shows through as the avatar's own body colour.
// Saturation dips through the yellow-green band, where full chroma glows.
const AVATAR_COLORS = [
  "#f764ba", // hot pink — the brand anchor
  "#f76470", // blossom
  "#f7a164", // tangerine
  "#e0d87b", // honey
  "#b6e07b", // citron
  "#83e07b", // lime
  "#7be0a5", // mint
  "#64f7eb", // lagoon
  "#64baf7", // sky
  "#6470f7", // cornflower
  "#a164f7", // periwinkle
  "#eb64f7", // orchid
];

/**
 * Get or create an avatar name for the current user
 * @returns {string} Avatar name like "Misty Fox"
 */
export function getOrCreateAvatar() {
  // localStorage can throw in privacy modes — never let that break a room
  // join; a fresh unpersisted name is fine.
  if (typeof window !== "undefined") {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        return existing;
      }

      // Generate new avatar
      const avatar = generateAvatar();
      localStorage.setItem(STORAGE_KEY, avatar);
      return avatar;
    } catch {
      return generateAvatar();
    }
  }

  // Fallback for SSR
  return "Guest";
}

/**
 * Generate a random avatar name
 * @returns {string} Random avatar name
 */
function generateAvatar() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adjective} ${animal}`;
}

/**
 * Re-roll to a brand-new random avatar (the "click your face for a new
 * one" move). Faces are seeded by name, so a fresh generated name is a
 * fresh face — regenerates until it actually differs from the current one
 * so a click always visibly does something.
 * @param {string} [currentName]
 * @returns {string} the stored name
 */
export function rerollAvatar(currentName) {
  let next = generateAvatar();
  let guard = 0;
  while (next === currentName && guard < 5) {
    next = generateAvatar();
    guard += 1;
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // privacy mode — the name just won't persist
    }
  }
  return next;
}

/**
 * Set a custom avatar name (the "call me Mum" move). Empty input falls
 * back to a fresh generated name.
 * @param {string} name
 * @returns {string} the stored name
 */
export function setAvatarName(name) {
  const trimmed = (name || "").trim().slice(0, 48);
  const finalName = trimmed || generateAvatar();
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, finalName);
    } catch {
      // privacy mode — the name just won't persist
    }
  }
  return finalName;
}

const avatarImageCache = new Map();

/**
 * DiceBear thumbs face for an avatar name — offline SVG data-URI, cached.
 * @param {string} name - avatar name used as the deterministic seed
 * @returns {string} data:image/svg+xml URI ('' if generation fails)
 */
export function getAvatarImage(name) {
  const seed = name || "Guest";
  if (avatarImageCache.has(seed)) {
    return avatarImageCache.get(seed);
  }
  let uri = "";
  try {
    uri = createAvatar(thumbs, {
      seed,
      radius: 50,
      scale: 92,
      backgroundType: ["solid"],
      backgroundColor: ["transparent"],
    }).toDataUri();
  } catch (error) {
    console.warn("Avatar image generation failed:", error);
  }
  avatarImageCache.set(seed, uri);
  return uri;
}

/**
 * Get the current avatar without creating one
 * @returns {string | null} Current avatar or null
 */
export function getAvatar() {
  if (typeof window !== "undefined") {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export function getAvatarColor(value) {
  const key = String(value || "Guest");
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 2147483647;
  }

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
