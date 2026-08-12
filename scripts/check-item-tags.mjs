// Hashtags must pull a tag out WITHOUT eating the entry. Run: node scripts/check-item-tags.mjs
import assert from "node:assert/strict";
import {
  extractTags,
  normalizeTags,
  MAX_TAGS_PER_ITEM,
} from "../src/lib/services/lists/itemTags.js";

const t = (s) => extractTags(s);

// The ordinary cases.
assert.deepEqual(t("milk #urgent"), { text: "milk", tags: ["urgent"] });
assert.deepEqual(t("#urgent milk"), { text: "milk", tags: ["urgent"] });
assert.deepEqual(t("get #milk from #shop"), {
  text: "get from",
  tags: ["milk", "shop"],
});
assert.deepEqual(t("plain milk"), { text: "plain milk", tags: [] });
assert.deepEqual(t(""), { text: "", tags: [] });

// Things that LOOK like tags and aren't.
assert.deepEqual(
  t("learn C# properly"),
  { text: "learn C# properly", tags: [] },
  "a # inside a word is not a tag",
);
assert.deepEqual(t("call apt 4#2"), { text: "call apt 4#2", tags: [] });
assert.deepEqual(
  t("just # alone"),
  { text: "just # alone", tags: [] },
  "a bare # is not a tag",
);

// Never eat the entry.
assert.deepEqual(
  t("#milk"),
  { text: "#milk", tags: [] },
  "a lone hashtag is someone NAMING the thing, not tagging it",
);
assert.deepEqual(t("#a #b"), { text: "#a #b", tags: [] });

// Case and duplicates.
assert.deepEqual(t("x #Urgent #URGENT"), { text: "x", tags: ["urgent"] });

// Cap.
const many = t("x #a #b #c #d #e #f");
assert.equal(many.tags.length, MAX_TAGS_PER_ITEM);
assert.ok(
  many.text.includes("#e"),
  "tags past the cap stay as literal text, not lost",
);

// Unicode is fine.
assert.deepEqual(t("café #niño"), { text: "café", tags: ["niño"] });

// normalizeTags is forgiving about whatever it's handed.
assert.deepEqual(normalizeTags(["#Urgent", "shop", "", null, "urgent"]), [
  "urgent",
  "shop",
]);
assert.deepEqual(normalizeTags("nope"), []);
assert.deepEqual(normalizeTags(null), []);

console.log("✓ item tags: extracts cleanly, never eats an entry, C# stays C#");
