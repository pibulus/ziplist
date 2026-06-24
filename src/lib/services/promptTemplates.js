// Collection of different prompt templates organized by style

function buildTranscribePrompt({ intro, itemStyleRule, exampleItems }) {
  return `${intro}

{{existingItemsContext}}

The response MUST be valid JSON with ONLY this structure:

{
  "items": ${JSON.stringify(exampleItems)},
  "complete": ["exact text of existing item to tick off"]
}

Rules for "items" (new things to add):
1. Extract distinct checklist items from the audio
2. Remove filler words, repeated starts, and duplicates
3. ${itemStyleRule}
4. Convert "I need to" / "I want to" phrases into clean items
5. Do NOT add items that match something the user said they already did

Rules for "complete" (things to tick off):
1. If the speaker says they did, bought, finished, got, or completed something — and it matches an existing list item — include the EXACT text of that existing item in "complete"
2. Match semantically: "I bought the milk" → complete "Buy milk". "picked up dog food" → complete "Dog food"
3. Only include items that exist in the current list. Do not invent completions.
4. Do not stylize or rewrite "complete" entries; they must match the current list text.
5. If nothing was completed, return "complete": []

Return ONLY raw JSON. No explanation, no markdown, no code blocks.`;
}

export const promptTemplates = {
  // Standard prompt style (current implementation)
  standard: {
    transcribeAudio: {
      text: buildTranscribePrompt({
        intro: "Process this audio into a structured JSON response.",
        itemStyleRule: "Format with plain wording and proper capitalization",
        exampleItems: ["Book a haircut", "Buy groceries"],
      }),
    },
    generateAnimation: {
      text: `Generate a CSS animation for a ghost SVG based on this description: '{{description}}'.
Return a JSON object with the following structure:

{
  "name": "unique-animation-name", // A unique, descriptive kebab-case name for the animation
  "target": "whole" or "eyes" or "bg" or "outline", // Which part of the ghost to animate
  "duration": value in seconds, // Reasonable animation duration (0.5-3s)
  "timing": "ease"/"linear"/"cubic-bezier(x,x,x,x)", // Appropriate timing function
  "iteration": number or "infinite", // How many times to play (usually 1 or infinite)
  "keyframes": [
    {
      "percentage": 0, // Keyframe percentage (0-100)
      "properties": { // CSS properties to animate
        "transform": "...", // Any transform functions
        "opacity": value, // Opacity value if needed
        // Other properties as needed
      }
    },
    // More keyframes as needed
  ],
  "description": "Short description of what this animation does"
}

Critical requirements:
1. Make sure the animation is visually appealing and matches the description
2. Use ONLY transform properties (scale, rotate, translate, etc.) and opacity for animation
3. Avoid properties that would break the SVG (like background-color)
4. Ensure animation starts and ends in a natural state (if not infinite)
5. If the animation should affect only part of the ghost, specify the correct 'target'
6. Ensure all values are valid CSS
7. DO NOT include any explanation or text outside the JSON object
8. Return raw JSON only - DO NOT use markdown formatting or code blocks in your response`,
    },
  },

  // Surly pirate prompt style
  surlyPirate: {
    transcribeAudio: {
      text: buildTranscribePrompt({
        intro: "Process this audio into a structured JSON response.",
        itemStyleRule:
          "For new items only, use pirate slang, expressions, and attitude",
        exampleItems: ["Fetch the milk, matey", "Call the dentist, arr"],
      }),
    },
  },

  // L33T Sp34k prompt style
  leetSpeak: {
    transcribeAudio: {
      text: buildTranscribePrompt({
        intro: "Process this audio into a structured JSON response.",
        itemStyleRule:
          "For new items only, use l33t numeric substitutions and hacker jargon",
        exampleItems: ["Buy m1lk", "Call d3nt15t"],
      }),
    },
  },

  // Sparkle Pop prompt style
  sparklePop: {
    transcribeAudio: {
      text: buildTranscribePrompt({
        intro: "Process this audio into a structured JSON response.",
        itemStyleRule:
          "For new items only, make each item bubbly with emojis, excitement, and teen slang",
        exampleItems: ["Buy milk ✨", "Book a haircut 💖"],
      }),
    },
  },

  // Code Whisperer (formerly Prompt Engineer)
  codeWhisperer: {
    transcribeAudio: {
      text: buildTranscribePrompt({
        intro: "Process this audio into a structured JSON response.",
        itemStyleRule:
          "For new items only, use clear, structured, technical language",
        exampleItems: ["Document API behavior", "Refactor settings module"],
      }),
    },
  },

  // Quill & Ink (formerly Victorian Author)
  quillAndInk: {
    transcribeAudio: {
      text: buildTranscribePrompt({
        intro: "Process this audio into a structured JSON response.",
        itemStyleRule:
          "For new items only, use eloquent Victorian-inspired wording",
        exampleItems: [
          "Procure a bottle of milk",
          "Arrange an appointment with the dentist",
        ],
      }),
    },
  },
};

// Helper function to apply template with variables
export function applyTemplate(template, variables) {
  let result = template;

  // Replace all variables in the template.
  // Use a replacer function (not a string) so `$`-sequences in user-derived
  // values (e.g. "$5", "$&") are inserted literally instead of being treated
  // as String.replace special replacement patterns.
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, () => String(value));
  });

  return result;
}
