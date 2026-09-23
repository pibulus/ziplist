<script>
  import { ModalCloseButton } from "./index.js";
  import { Mascot } from "$lib/components/ui";
  export let closeModal;

  /* The four facts had no anchors — four grey sentences in a stack, nothing
     to catch the eye or tell them apart. One 24px stroke-icon language (the
     app's, not emoji), carried as path data so the markup stays one row per
     fact. The walkie-talkie line is new: holding the record button has
     worked since the hold gesture shipped, and NOTHING in the app said so —
     it lives in an aria-label, which is why it reads as missing. */
  const FACTS = [
    {
      text: "A tap starts and stops. A hold runs like a walkie-talkie.",
      paths: [
        "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z",
        "M5 11a7 7 0 0 0 14 0",
        "M12 18v3",
      ],
    },
    {
      text: "No account. No sign-up. No upsell to use it.",
      paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M5.64 5.64 18.36 18.36"],
    },
    {
      text: "Lists live on the device, not on somebody's server.",
      paths: [
        "M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z",
        "M10.5 18.5h3",
      ],
    },
    {
      text: "Share one live and two people can tick the same boxes.",
      paths: [
        "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
        "M2 21a7 7 0 0 1 14 0",
        "M17 5.5a3 3 0 0 1 0 5.5",
        "M19.5 20.5a6 6 0 0 0-2.8-4.7",
      ],
    },
    {
      text: "Four words carry a list to another phone. No login, no fuss.",
      paths: [
        "M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1 1",
        "M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1-1",
      ],
    },
  ];
</script>

<dialog
  id="about_modal"
  class="modal modal-middle fixed z-50 overflow-hidden"
  style="overflow-y: hidden!important;"
  aria-labelledby="about_modal_title"
  aria-modal="true"
>
  <div
    class="modal-box max-h-[80vh] overflow-y-auto rounded-2xl border border-pink-200 bg-gradient-to-br from-[#fffaef] to-[#fff6e6] shadow-xl"
  >
    <form method="dialog">
      <ModalCloseButton
        {closeModal}
        label="Close about modal"
        modalId="about_modal"
      />
    </form>

    <div class="space-y-4">
      <!-- pr-14 keeps the title clear of the absolute close X (40px button
           + right-2.5 offset on touch screens). -->
      <!-- The headline used to share a narrow column with both the mascot and
           the subtitle and broke over three lines. The mascot keeps the
           eyebrow company on one row; the headline then gets full width. -->
      <div class="mb-1">
        <div class="flex items-center gap-3 pr-14">
          <div class="about-mascot-slot shrink-0">
            <Mascot interactive={false} aura={false} />
          </div>
          <p class="about-eyebrow">The shareable voice list thing</p>
        </div>
        <h3 id="about_modal_title" class="about-title">
          Zip up a list, lickety-split.
        </h3>
      </div>

      <div
        class="rounded-lg border border-pink-200/60 bg-gradient-to-r from-pink-50/90 to-amber-50/90 p-4 shadow-sm"
      >
        <p class="text-sm leading-relaxed text-gray-700">
          Say the thing, and it's on the list. That's the whole trick.
        </p>
      </div>

      <!-- Same short-line rhythm as the intro modal, and as TalkType's About —
           the family should sound like one person wrote all of it. -->
      <div class="text-sm leading-relaxed">
        <ul class="about-facts">
          {#each FACTS as fact}
            <li>
              <svg
                class="about-fact-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                {#each fact.paths as d}
                  <path {d} />
                {/each}
              </svg>
              <span>{fact.text}</span>
            </li>
          {/each}
        </ul>
        <!-- The long version at /about is PARKED, not deleted (Pablo, 2026-09-23
             — "hide it for now"). The route still exists and still ranks; only
             this in-modal link is hidden. Restore by uncommenting.
        <p class="pt-3">
          <a
            href="/about"
            class="about-more font-semibold underline underline-offset-2"
            >How it works, at more length</a
          >
        </p>
        -->
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p class="about-attrib text-xs">
          © 2026 ZipList • Made by <a
            href="https://madebypablo.app"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-gray-800">Pablo</a
          > in Melbourne
        </p>
        <div class="flex items-center gap-4">
          <a
            href="https://github.com/pibulus"
            target="_blank"
            rel="noopener noreferrer"
            class="about-link text-xs font-medium transition-colors"
            aria-label="Source code on GitHub"
          >
            <span aria-hidden="true">🐙</span>Peek at the guts
          </a>
          <a
            href="https://ko-fi.com/madebypablo"
            target="_blank"
            rel="noopener noreferrer"
            class="about-link text-xs font-medium transition-colors"
          >
            <span aria-hidden="true">☕</span>Buy me a coffee
          </a>
        </div>
      </div>
    </div>
  </div>
  <button
    type="button"
    class="modal-backdrop bg-black/40"
    on:click={closeModal}
    aria-label="Close modal"
    tabindex="-1"
  ></button>
</dialog>

<style>
  /* This modal predated the design laws and dressed in Tailwind greys while
     Options and Extra Lists wore the warm tokens — it read as the one screen
     from another app. Same ink, same cream family, same 2px quiet borders. */
  .about-eyebrow {
    color: var(--zl-pass-color, #ff6ac2);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: -0.005em;
    margin: 0;
  }

  .about-title {
    color: var(--zl-text-color-primary, #1e1714);
    font-size: clamp(1.25rem, 5.5vw, 1.5rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.12;
    margin: 0.4rem 0 0;
  }

  /* One stroke-icon language, ink at low weight so the sentences still lead.
     The icon column is fixed so every line starts at the same text edge. */
  .about-facts {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .about-facts li {
    align-items: flex-start;
    color: var(--zl-text-color-secondary, #3a2f2a);
    display: flex;
    gap: 0.65rem;
  }

  .about-fact-icon {
    color: var(--zl-text-color-primary, #1e1714);
    flex-shrink: 0;
    height: 18px;
    margin-top: 0.15rem;
    opacity: 0.55;
    width: 18px;
  }

  .about-more {
    color: var(--zl-text-color-primary, #1e1714);
    text-decoration-color: var(--zl-pass-color, #ff6ac2);
  }

  /* The charm emoji keep their place (footer and support links always do),
     but they sat flush against the first letter — a text space disappears
     into an emoji's advance width. A flex gap is a gap the glyph can't eat.
     Teal was the only teal in the app; these speak brand ink and pink. */
  .about-link {
    align-items: center;
    color: var(--zl-text-color-secondary, #3a2f2a);
    display: inline-flex;
    gap: 0.35rem;
  }

  .about-link:hover {
    color: var(--zl-pass-color, #ff6ac2);
  }

  .about-attrib {
    color: var(--zl-text-color-secondary, #3a2f2a);
    opacity: 0.8;
  }

  /* Mascot slot — shrink the shared Mascot to sit inline beside the title
     without crowding it. The character art itself is untouched. */
  .about-mascot-slot :global(.mascot) {
    --mascot-size-mobile: 44px;
    --mascot-size-sm: 48px;
    --mascot-size-md: 48px;
    --mascot-size-lg: 48px;
    --mascot-ink-pad: 0%;
    margin-bottom: 0;
  }

  /* ~44px tap target for thumbs. */
  .about-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
</style>
