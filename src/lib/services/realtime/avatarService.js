/**
 * Avatar Service
 *
 * Generates and persists random avatar names like "Misty Fox" or "Happy Frog"
 * for anonymous user identification in live collaboration.
 */

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
const AVATAR_COLORS = [
  "#ff6ac2",
  "#00d4ff",
  "#ffb000",
  "#51cf66",
  "#c978ff",
  "#38d9a9",
  "#4dabf7",
  "#20c997",
  "#f783ac",
  "#ffd43b",
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
 * Reset the user's avatar (generate a new one)
 * @returns {string} New avatar name
 */
export function resetAvatar() {
  if (typeof window !== "undefined") {
    const newAvatar = generateAvatar();
    try {
      localStorage.setItem(STORAGE_KEY, newAvatar);
    } catch {
      // storage unavailable — still hand back a usable name
    }
    return newAvatar;
  }
  return "Guest";
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
