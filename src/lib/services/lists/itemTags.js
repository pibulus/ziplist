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
 * Split "milk #urgent #shop" into its text and its tags.
 * @returns {{text: string, tags: string[]}}
 */
export function extractTags(raw) {
  const input = String(raw ?? "");
  if (!input.includes("#")) return { text: input.trim(), tags: [] };

  const tags = [];
  const stripped = input.replace(TAG_PATTERN, (match, lead, word) => {
    if (tags.length >= MAX_TAGS_PER_ITEM) return match;
    const tag = word.toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (!tags.includes(tag)) tags.push(tag);
    return lead;
  });

  const text = stripped.replace(/\s+/g, " ").trim();

  // "#milk" on its own is someone naming the thing, not tagging it. Returning
  // an empty item would silently eat their entry.
  if (!text) return { text: input.trim(), tags: [] };

  return { text, tags };
}

/** Normalise a tag list coming from anywhere (wire, storage, paste). */
export function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    const tag = String(entry ?? "")
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .slice(0, MAX_TAG_LENGTH);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= MAX_TAGS_PER_ITEM) break;
  }
  return out;
}
