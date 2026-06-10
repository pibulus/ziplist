<script>
  import { promptStyle } from "$lib";
  import { geminiService } from "$lib/services/geminiService";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import { PROMPT_STYLES } from "$lib/constants";

  // Props
  export let selectedPromptStyle = "standard";

  // Available styles (excluding leetSpeak and sparklePop)
  const availableStyles = [
    PROMPT_STYLES.STANDARD, // Keep standard/refined as a selectable option
    PROMPT_STYLES.SURLY_PIRATE,
    PROMPT_STYLES.CODE_WHISPERER,
    PROMPT_STYLES.QUILL_AND_INK,
    PROMPT_STYLES.LEET_SPEAK,
    PROMPT_STYLES.SPARKLE_POP,
  ];

  const styleGlyphs = {
    standard: "Aa",
    surlyPirate: "Yo",
    codeWhisperer: "</>",
    quillAndInk: "Ink",
    leetSpeak: "1337",
    sparklePop: "Pop",
  };

  const styleGlyphClasses = {
    standard: "text-teal-700 border-teal-200 bg-teal-50",
    surlyPirate: "text-amber-600 border-amber-200 bg-amber-50",
    codeWhisperer: "text-cyan-600 border-cyan-200 bg-cyan-50",
    quillAndInk: "text-violet-600 border-violet-200 bg-violet-50",
    leetSpeak: "text-lime-700 border-lime-200 bg-lime-50",
    sparklePop: "text-fuchsia-600 border-fuchsia-200 bg-fuchsia-50",
  };

  // Style names (more descriptive)
  const styleNames = {
    standard: "Standard",
    surlyPirate: "Pirate",
    codeWhisperer: "Code",
    quillAndInk: "Victorian",
    leetSpeak: "Leet",
    sparklePop: "Pop",
  };

  // Style tooltips (full descriptions for tooltips)
  const styleTooltips = {
    standard: "Clean everyday items",
    surlyPirate: "Pirate lingo & swagger",
    codeWhisperer: "Structured tech syntax",
    quillAndInk: "Victorian literature style",
    leetSpeak: "Internet shorthand style",
    sparklePop: "Bright, playful style",
  };

  // Props for handler function
  export let changePromptStyle = (style) => {
    // Simply set the selected style
    selectedPromptStyle = style;
    soundService.select();

    // Update the service
    geminiService.setPromptStyle(style);

    // Update the store (this will also save to localStorage)
    promptStyle.set(style);

    // Dispatch a custom event that the main page can listen for
    window.dispatchEvent(
      new CustomEvent("ziplist-setting-changed", {
        detail: { setting: "promptStyle", value: style },
      }),
    );
  };
</script>

<div class="space-y-2">
  <h4 class="text-sm font-bold text-gray-700">List Style</h4>

  <!-- Using exact same grid pattern as vibe selector -->
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {#each availableStyles as style}
      <button
        type="button"
        class="vibe-option relative flex flex-col items-center rounded-xl border border-pink-100 bg-[#fffdf5] p-2 shadow-sm transition-all duration-300 hover:border-pink-200 hover:shadow-md {selectedPromptStyle ===
        style
          ? 'selected-vibe border-pink-300 ring-2 ring-pink-200 ring-opacity-60'
          : ''}"
        on:click={() => changePromptStyle(style)}
        aria-label={`Use ${styleNames[style] || style} list style`}
        aria-pressed={selectedPromptStyle === style}
        title={styleTooltips[style]}
        data-style-type={style}
      >
        <div class="preview-container mb-2">
          <!-- Using same dimensions as theme preview for consistency -->
          <div class="preview-ghost-wrapper relative h-12 w-12">
            <div
              class="preview-icon-layers relative h-full w-full flex items-center justify-center"
            >
              <span
                class="style-glyph border {styleGlyphClasses[style] ||
                  styleGlyphClasses.standard}"
                aria-hidden="true"
              >
                {styleGlyphs[style] || "Aa"}
              </span>
            </div>
          </div>
        </div>

        <!-- Style Name -->
        <span class="text-xs font-medium text-gray-700"
          >{styleNames[style] || style}</span
        >

        <!-- Tooltip on hover -->
        <div
          class="tooltip opacity-0 invisible absolute -top-9 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap pointer-events-none transition-opacity duration-150"
        >
          {styleTooltips[style]}
          <div
            class="tooltip-arrow absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"
          ></div>
        </div>

        <!-- Selected indicator (matching vibe selector above) -->
        {#if selectedPromptStyle === style}
          <div
            class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-xs text-white shadow-sm"
            aria-hidden="true"
          >
            ✓
          </div>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  /* Using the exact same classes as the vibe selector for complete consistency */
  /* We inherit all styling from the main modal's vibe-option and selected-vibe classes */

  /* Explicitly adding the shadows to match in case of CSS specificity issues */
  .selected-vibe {
    box-shadow:
      0 0 0 2px rgba(249, 168, 212, 0.4),
      0 4px 8px rgba(249, 168, 212, 0.2);
  }

  .style-glyph {
    align-items: center;
    border-radius: 999px;
    display: inline-flex;
    font-family: "Space Mono", monospace;
    font-size: 0.8rem;
    font-weight: 900;
    height: 2.25rem;
    justify-content: center;
    transition: all 0.3s ease;
    width: 2.25rem;
  }

  .vibe-option:hover .style-glyph {
    filter: drop-shadow(0 0 3px rgba(249, 168, 212, 0.5));
  }

  /* Tooltip styling */
  button:hover .tooltip {
    opacity: 1;
    visibility: visible;
  }

  .tooltip {
    z-index: 10;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  }

  .tooltip-arrow {
    width: 0;
    height: 0;
  }
</style>
