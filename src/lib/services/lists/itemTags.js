// ===================================================================
// #TAGS — modularity you get by typing, not by learning a UI
// ===================================================================
// "milk #urgent" becomes an item that reads "Milk" wearing an urgent chip.
// No tag field, no picker, no mode — the input is the thing people already
// know how to use, which is why hashtags survived everywhere else too.
//
// Pure and dependency-free so scripts/check-item-tags.mjs can exercise it
// outside a SvelteKit build.

/** Hashtags are capped so one enthusiastic entry can't become a chip salad. */
export const MAX_TAGS_PER_ITEM = 4;
export const MAX_TAG_LENGTH = 20;

// A tag is a # that STARTS a word — letters, digits, hyphen, underscore.
// The leading boundary matters: "C#" is a language and "a#b" is a typo,
// neither is a tag.
const TAG_PATTERN = /(^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;

/**
 * Snap a tag to an existing canonical tag in vocabulary to avoid synonym / plural drift.
 * E.g. "guitars" snaps to "guitar" if "guitar" exists; "groceries" snaps to "grocery" if "grocery" exists.
 */
export function cohereTag(tag, existingVocabulary = []) {
  if (!tag || typeof tag !== "string") return "";
  const raw = tag.toLowerCase().trim().replace(/^#/, "");
  if (!raw) return "";

  if (!Array.isArray(existingVocabulary) || existingVocabulary.length === 0) {
    return raw;
  }

  const vocab = existingVocabulary.map((v) =>
    String(v).toLowerCase().replace(/^#/, "").trim(),
  );

  // 1. Direct exact match
  if (vocab.includes(raw)) return raw;

  // 2. Singular / Plural (-s, -es, -ies)
  if (raw.endsWith("ies")) {
    const singular = raw.slice(0, -3) + "y";
    if (vocab.includes(singular)) return singular;
  }
  if (raw.endsWith("y")) {
    const plural = raw.slice(0, -1) + "ies";
    if (vocab.includes(plural)) return plural;
  }
  if (raw.endsWith("es") && raw.length > 3) {
    const base = raw.slice(0, -2);
    if (vocab.includes(base)) return base;
  }
  if (raw.endsWith("s") && raw.length > 2) {
    const singular = raw.slice(0, -1);
    if (vocab.includes(singular)) return singular;
  }
  if (!raw.endsWith("s")) {
    const plural = raw + "s";
    if (vocab.includes(plural)) return plural;
  }

  // 3. -ing verb forms (e.g. shopping -> shop, camping -> camp)
  if (raw.endsWith("ing") && raw.length > 4) {
    const base = raw.slice(0, -3);
    if (vocab.includes(base)) return base;
    // double-consonant check e.g. shopping -> shop
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
      const single = base.slice(0, -1);
      if (vocab.includes(single)) return single;
    }
  }

  return raw;
}

/**
 * Split "milk #urgent #shop" into its text and its tags.
 * @param {string} raw
 * @param {string[]} [existingVocabulary]
 * @returns {{text: string, tags: string[]}}
 */
export function extractTags(raw, existingVocabulary = []) {
  const input = String(raw ?? "");
  if (!input.includes("#")) return { text: input.trim(), tags: [] };

  const tags = [];
  const stripped = input.replace(TAG_PATTERN, (match, lead, word) => {
    if (tags.length >= MAX_TAGS_PER_ITEM) return match;
    const rawTag = word.toLowerCase().slice(0, MAX_TAG_LENGTH);
    const tag = cohereTag(rawTag, existingVocabulary);
    if (!tags.includes(tag)) tags.push(tag);
    return lead;
  });

  const text = stripped.replace(/\s+/g, " ").trim();

  // "#milk" on its own is someone naming the thing, not tagging it. Returning
  // an empty item would silently eat their entry.
  if (!text) return { text: input.trim(), tags: [] };

  return { text, tags };
}

/**
 * Normalise a tag list coming from anywhere (wire, storage, paste).
 * @param {any[]} value
 * @param {string[]} [existingVocabulary]
 */
export function normalizeTags(value, existingVocabulary = []) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    const raw = String(entry ?? "")
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .slice(0, MAX_TAG_LENGTH);
    const tag = cohereTag(raw, existingVocabulary);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= MAX_TAGS_PER_ITEM) break;
  }
  return out;
}

// ── Tag colour ────────────────────────────────────────────────────────
// Lifted from ProMapper, which had the better idea: a tag's colour comes from
// its NAME, so #urgent is the same red on every item and in every list without
// anyone picking it. That's the cheapest possible answer to "the lists are
// samey and cream and flat" — the colour arrives with the content instead of
// being another thing to choose.
//
// Same six as the avatars on purpose: one colour vocabulary for the whole app.
// A chip is a cream tint with dark text and an avatar is a solid fill, so they
// never read as the same kind of object even when they share a hue.
//
// Restated here rather than imported because this module stays pure —
// avatarService touches localStorage, and check-item-tags.mjs runs it outside
// any SvelteKit build.
export const TAG_COLOURS = Object.freeze([
  "#e6579a", // hot pink
  "#d2721f", // tangerine
  "#179d82", // jade
  "#2191dc", // ocean
  "#6c85e9", // cornflower
  "#a970ea", // violet
]);

/** A tag's stable colour. Same tag, same colour, everywhere, forever. */
export function tagColour(tag) {
  const key = String(tag ?? "").toLowerCase();
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 2147483647;
  }
  return TAG_COLOURS[Math.abs(hash) % TAG_COLOURS.length];
}
