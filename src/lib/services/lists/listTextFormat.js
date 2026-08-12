// ═══════════════════════════════════════════════════════════════════════════
// 📋 listTextFormat — a list as plain text, and back again
// ═══════════════════════════════════════════════════════════════════════════
// Export/import that works with anything: Notes, Messages, a whiteboard photo
// you retyped, someone else's shopping list pasted out of an email.
//
// Deliberately NOT listParser: that one reads speech, where items arrive as
// comma-and-"and" separated prose. Pasted text is newline-separated with
// bullets and checkboxes, so it gets its own tiny reader rather than teaching
// the speech parser a second grammar.

const CHECKED_MARKS = ["[x]", "[X]", "[✓]", "✓", "✔", "☑"];

/** A list as a markdown checklist — pastes readably into basically anything. */
export function listToText(list) {
  if (!list?.items?.length) return `${list?.name || "List"}\n`;

  const lines = list.items.map(
    (item) => `- [${item.checked ? "x" : " "}] ${item.text}`,
  );
  return `${list.name || "List"}\n${lines.join("\n")}\n`;
}

/**
 * Read pasted text back into items. Forgiving on purpose — people paste
 * hyphens, asterisks, "1." numbering, emoji bullets, and checkbox marks, and
 * every one of those should just work.
 */
export function textToItems(text) {
  if (!text || typeof text !== "string") return [];

  return text
    .split(/\r?\n/)
    .map((raw) => {
      let line = raw.trim();
      if (!line) return null;

      // Strip a leading bullet or numbering: -, *, •, –, 1., 1)
      line = line.replace(/^([-*•–—]|\d+[.)])\s+/, "");

      // Checkbox state, if the line carries one.
      let checked = false;
      const boxMatch = line.match(/^\[( |x|X|✓)\]\s*/);
      if (boxMatch) {
        checked = boxMatch[1].toLowerCase() === "x" || boxMatch[1] === "✓";
        line = line.slice(boxMatch[0].length);
      } else {
        for (const mark of CHECKED_MARKS) {
          if (line.startsWith(`${mark} `)) {
            checked = true;
            line = line.slice(mark.length + 1);
            break;
          }
        }
      }

      line = line.trim();
      return line ? { text: line, checked } : null;
    })
    .filter(Boolean);
}

/**
 * A pasted block often leads with the list's own name — a first line with no
 * bullet, followed by bulleted ones. Treat that as the title, not an item.
 */
export function splitPastedList(text) {
  const lines = (text || "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { name: "", items: textToItems(text) };

  const firstLooksLikeItem = /^([-*•–—]|\d+[.)]|\[)/.test(lines[0].trim());
  const restAreItems = lines
    .slice(1)
    .some((l) => /^([-*•–—]|\d+[.)]|\[)/.test(l.trim()));

  if (!firstLooksLikeItem && restAreItems) {
    return {
      name: lines[0].trim().slice(0, 60),
      items: textToItems(lines.slice(1).join("\n")),
    };
  }
  return { name: "", items: textToItems(text) };
}
