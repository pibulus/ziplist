// Collection of different prompt templates organized by style

export const promptTemplates = {
  // Standard prompt style (current implementation)
  standard: {
    transcribeAudio: {
      text: 
`Process this audio file into a structured JSON format with a list of tasks or items.
The response MUST be valid JSON with ONLY this structure:

{
  "items": [
    "First item",
    "Second item",
    "Another distinct item"
  ]
}

Requirements:
1. Extract distinct and separate items from the audio
2. Remove filler words, duplicates, and profanity
3. Format each item consistently with proper capitalization
4. If the audio mentions "I need to" or "I want to" phrases, convert these to clean action items
5. Return ONLY the raw JSON without any explanation, markdown formatting, or code blocks
6. The response must be valid, parseable JSON
7. Do not add any text outside the JSON structure

Example valid response:
{"items":["Reply to emails","Buy groceries","Schedule dentist appointment"]}`,
    },
    generateAnimation: {
      text: 
`Generate a CSS animation for a ghost SVG based on this description: '{{description}}'.
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
      text: 
`Process this audio into a structured JSON list of pirate-style items.
Format response as valid JSON with the following structure:

{
  "items": [
    "First pirate item",
    "Second pirate item"
  ]
}

Use pirate slang, expressions, and attitude (arr, matey, ye, scallywag, etc.).
Return ONLY raw JSON, no additional text or formatting.`,
    },
  },

  // L33T Sp34k prompt style
  leetSpeak: {
    transcribeAudio: {
      text: 
`Pr0c355 th15 4ud10 1nt0 4 5tructur3d J50N l15t 0f l33t 5p34k 1t3m5.
F0rm4t r35p0n53 45 v4l1d J50N w1th th15 5tructur3:

{
  "items": [
    "F1r5t l33t 1t3m",
    "53c0nd l33t 1t3m"
  ]
}

U53 num3r1c 5ub5t1tut10n5 (3=e, 4=a, 1=i, 0=o, 5=s, 7=t) 4nd h4ck3r j4rg0n.
R3turn 0NLY r4w J50N, n0 4dd1t10n4l t3xt.`,
    },
  },

  // Sparkle Pop prompt style
  sparklePop: {
    transcribeAudio: {
      text: 
`OMG!!! Process this audio into a structured JSON list of SUPER bubbly items!!!
Format response as valid JSON with this structure:

{
  "items": [
    "First AMAZING item ✨💖",
    "Second TOTALLY CUTE item 🌈✨"
  ]
}

Make each item EXTRA bubbly with emojis, excitement, and teen slang!!!
Use words like 'literally,' 'totally,' 'sooo,' 'vibes,' and 'obsessed'!!!
Return ONLY raw JSON, no additional text or formatting!!!`,
    },
  },

  // Code Whisperer (formerly Prompt Engineer)
  codeWhisperer: {
    transcribeAudio: {
      text: 
`Process this audio into a structured JSON list of technical, precise items.
Format response as valid JSON with the following structure:

{
  "items": [
    "First technical item",
    "Second technical item" 
  ]
}

Use clear, structured, technical language suitable for a coding prompt.
Remove redundancies, organize logically, use precise terminology.
Return ONLY raw JSON, no additional text or formatting.`,
    },
  },

  // Quill & Ink (formerly Victorian Author)
  quillAndInk: {
    transcribeAudio: {
      text: 
`Process this audio into a structured JSON list of eloquent Victorian-style items.
Format response as valid JSON with the following structure:

{
  "items": [
    "First eloquent Victorian item",
    "Second ornate Victorian item"
  ]
}

Employ the eloquence and stylistic flourishes of a 19th century Victorian novelist.
Use elaborate sentences, period-appropriate vocabulary, and literary devices.
Return ONLY raw JSON, no additional text or formatting.`,
    },
  },
};

// Helper function to apply template with variables
export function applyTemplate(template, variables) {
  let result = template;

  // Replace all variables in the template
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, value);
  });

  return result;
}
