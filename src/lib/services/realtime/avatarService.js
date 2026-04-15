/**
 * Avatar Service
 *
 * Generates and persists random avatar names like "Misty Fox" or "Happy Frog"
 * for anonymous user identification in live collaboration.
 */

const ADJECTIVES = [
  'Misty', 'Happy', 'Quiet', 'Bright', 'Swift', 'Gentle',
  'Bold', 'Calm', 'Eager', 'Mellow', 'Clever', 'Lucky',
  'Brave', 'Kind', 'Wise', 'Jolly', 'Noble', 'Zesty'
];

const ANIMALS = [
  'Fox', 'Frog', 'Owl', 'Deer', 'Wolf', 'Bear',
  'Lynx', 'Hawk', 'Otter', 'Raven', 'Seal', 'Eagle',
  'Panda', 'Tiger', 'Koala', 'Dove', 'Swan', 'Hare'
];

const STORAGE_KEY = 'ziplist_user_avatar';

/**
 * Get or create an avatar name for the current user
 * @returns {string} Avatar name like "Misty Fox"
 */
export function getOrCreateAvatar() {
  // Check if we already have an avatar
  if (typeof window !== 'undefined') {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      return existing;
    }

    // Generate new avatar
    const avatar = generateAvatar();
    localStorage.setItem(STORAGE_KEY, avatar);
    return avatar;
  }

  // Fallback for SSR
  return 'Guest';
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
  if (typeof window !== 'undefined') {
    const newAvatar = generateAvatar();
    localStorage.setItem(STORAGE_KEY, newAvatar);
    return newAvatar;
  }
  return 'Guest';
}

/**
 * Get the current avatar without creating one
 * @returns {string | null} Current avatar or null
 */
export function getAvatar() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY);
  }
  return null;
}
