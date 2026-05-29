/**
 * @typedef {Object} ListParserConfig
 * @property {boolean} [debug=false] - Enable debug logging.
 * @property {Array<string>} [addItemKeywords] - Keywords to identify adding an item.
 * @property {Array<string>} [createListKeywords] - Keywords for creating a new list.
 * @property {Array<string>} [clearListKeywords] - Keywords for clearing a list.
 * @property {Array<string>} [removeItemKeywords] - Keywords for removing an item.
 */

export class ListParser {
  /**
   * @param {ListParserConfig} config
   */
  constructor(config = {}) {
    this.config = {
      debug: false,
      addItemKeywords: ["add item", "add to my list", "put on my list", "item"],
      createListKeywords: ["create new list", "new list", "start a new list"],
      clearListKeywords: ["clear list", "delete all items", "empty my list"],
      removeItemKeywords: [
        "remove last item",
        "delete last item",
        "remove previous item",
      ],
      ...config,
    };
  }

  log(...args) {
    if (this.config.debug) {
      console.debug("[ListParser]", ...args);
    }
  }

  /**
   * Parses transcribed text to extract structured list items.
   * This is a preliminary implementation and will need refinement.
   * @param {string} transcribedText - The text from the transcription service.
   * @returns {{items: Array<string>, commands: Array<Object>}} An object containing extracted items and commands.
   */
  parse(transcribedText) {
    this.log(`Parsing text: "${transcribedText}"`);
    const items = [];
    const commands = [];
    const seenItems = new Set();

    if (!transcribedText || transcribedText.trim() === "") {
      return { items, commands };
    }

    const potentialLines = transcribedText.split(
      /\s*(?:[,;]|[.!?]\s+|\n+)\s*|(?<=.)\s+(?:I want|I need|I have to|remember to)\s+/i,
    );

    const lines = potentialLines
      .flatMap((line) => this._splitConjunctionList(line.trim()))
      .filter((line) => line.length > 0);
    this.log(`Potential lines after split: ${JSON.stringify(lines)}`);

    lines.forEach((line) => {
      // Check for commands first
      const command = this._identifyCommandInLine(line);
      if (command.command) {
        commands.push(command);
        // If a line is a command, it might also contain an item, or it might be exclusive.
        // For now, let's assume commands can also imply items if not explicitly handled.
        // Example: "add item milk" - command is "add item", item is "milk".
        // This part needs more sophisticated handling.
        const potentialItem = this._extractItemFromCommandContext(
          line,
          command,
        );
        if (potentialItem && !seenItems.has(potentialItem.toLowerCase())) {
          seenItems.add(potentialItem.toLowerCase());
          items.push(potentialItem);
        }
      } else {
        // If not a command, treat as a potential list item.
        // Further cleaning/validation might be needed.
        const item = this._cleanItemText(line);
        if (item && !seenItems.has(item.toLowerCase())) {
          seenItems.add(item.toLowerCase());
          items.push(item);
        }
      }
    });

    this.log(
      `Found items: ${JSON.stringify(items)}, Commands: ${JSON.stringify(commands)}`,
    );
    return { items, commands };
  }

  /**
   * Cleans item text by removing potential leading keywords if not handled by command.
   * @param {string} text
   * @returns {string}
   * @private
   */
  _cleanItemText(text) {
    let cleanedText = text.replace(/\s+/g, " ").trim();

    cleanedText = cleanedText
      .replace(/^[-\u2022*+]|\d+[.)]|\[\s*\]|\[\s*x\s*\]/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    for (const keyword of this.config.addItemKeywords) {
      if (cleanedText.toLowerCase().startsWith(keyword + " ")) {
        cleanedText = cleanedText.substring(keyword.length + 1).trim();
        break;
      }
    }

    cleanedText = cleanedText
      .replace(
        /^(?:I want|I need|I have to|remember to|please)\s+(?:a|an|to)?\s*/i,
        "",
      )
      .replace(/^(?:and|then|also)\s+/i, "")
      .replace(/[.!?]+$/g, "")
      .trim();

    // Capitalize first letter
    if (cleanedText.length > 0) {
      cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
    }

    return cleanedText;
  }

  /**
   * Splits plain fallback transcripts like "milk and eggs and bread" without
   * breaking common paired phrases such as "peanut butter and jelly".
   * @param {string} line
   * @returns {Array<string>}
   * @private
   */
  _splitConjunctionList(line) {
    if (!line || !/\s+(?:and|plus)\s+/i.test(line)) {
      return [line];
    }

    const hasListIntent =
      /^(?:add(?: item)?|add to my list|put on my list|please add|buy|get|grab|pick up|need|i need|i want)\s+/i.test(
        line,
      );

    const normalized = line
      .replace(
        /^(?:add(?: item)?|add to my list|put on my list|please add|buy|get|grab|pick up|need|i need|i want)\s+/i,
        "",
      )
      .trim();

    const parts = normalized
      .split(/\s+(?:and|plus)\s+/i)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length < 2 || parts.length > 8) {
      return [line];
    }

    if (parts.length === 2 && !hasListIntent) {
      return [line];
    }

    const hasActionPhrase =
      /\b(?:call|text|email|ask|tell|book|schedule|meet|finish|fix|clean|wash|write|read|watch|pay|cancel)\b/i.test(
        normalized,
      );

    if (hasActionPhrase || parts.some((part) => part.split(/\s+/).length > 4)) {
      return [line];
    }

    return parts;
  }

  /**
   * Extracts an item from a line that also triggered a command.
   * E.g., "add item milk" -> command "ADD_ITEM", item "milk"
   * @param {string} line
   * @param {Object} command
   * @returns {string|null}
   * @private
   */
  _extractItemFromCommandContext(line, command) {
    if (command.command === "ADD_ITEM") {
      // Attempt to extract the text after the keyword
      for (const keyword of this.config.addItemKeywords) {
        if (line.toLowerCase().startsWith(keyword + " ")) {
          const itemText = line.substring(keyword.length + 1).trim();
          return this._cleanItemText(itemText) || null;
        }
      }
    }
    return null; // No item extracted for this command type or pattern
  }

  /**
   * Identifies a voice command within a single line of text.
   * @param {string} line - A single line of transcribed text.
   * @returns {{command: string|null, params: Array<string>, originalText: string}} An object with the identified command and its parameters.
   * @private
   */
  _identifyCommandInLine(line) {
    const lowerLine = line.toLowerCase();

    for (const keyword of this.config.createListKeywords) {
      if (lowerLine.includes(keyword)) {
        this.log(`Identified command: CREATE_LIST from "${line}"`);
        return { command: "CREATE_LIST", params: [], originalText: line };
      }
    }
    for (const keyword of this.config.clearListKeywords) {
      if (lowerLine.includes(keyword)) {
        this.log(`Identified command: CLEAR_LIST from "${line}"`);
        return { command: "CLEAR_LIST", params: [], originalText: line };
      }
    }
    for (const keyword of this.config.removeItemKeywords) {
      if (lowerLine.includes(keyword)) {
        this.log(`Identified command: REMOVE_LAST_ITEM from "${line}"`);
        return { command: "REMOVE_LAST_ITEM", params: [], originalText: line };
      }
    }
    // "add item" type commands are handled slightly differently as they also include the item text.
    for (const keyword of this.config.addItemKeywords) {
      if (lowerLine.startsWith(keyword)) {
        // Use startsWith to be more specific for add item
        this.log(`Identified command: ADD_ITEM from "${line}"`);
        // Parameter could be the rest of the string, to be processed by _extractItemFromCommandContext
        const params = [line.substring(keyword.length).trim()];
        return { command: "ADD_ITEM", params, originalText: line };
      }
    }

    return { command: null, params: [], originalText: line };
  }
}

// Export a singleton instance, or allow instantiation if preferred by project structure
export const listParser = new ListParser({
  debug: import.meta.env.DEV,
});
