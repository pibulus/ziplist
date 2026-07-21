<script>
  import { ModalCloseButton } from "./index.js";
  import { Mascot } from "$lib/components/ui";

  export let closeModal;
  export let markIntroAsSeen;
  export let triggerGhostClick;

  // Route through the shared closeModal so the modal animates OUT (skeleton
  // close-out) instead of vanishing via a direct dialog.close(). Mark the
  // intro seen, then kick off the ghost tap once the pop-out has finished.
  function handleActionButton() {
    markIntroAsSeen();
    closeModal();

    setTimeout(() => {
      triggerGhostClick();
    }, 300);
  }
</script>

<dialog
  id="intro_modal"
  class="modal modal-middle"
  aria-labelledby="intro_modal_title"
  aria-modal="true"
>
  <div
    class="modal-box relative bg-[#fff9ed] border-0"
    style="box-shadow: 0 10px 25px -5px rgba(249, 168, 212, 0.3), 0 8px 10px -6px rgba(249, 168, 212, 0.2), 0 0 15px rgba(249, 168, 212, 0.15);"
  >
    <form method="dialog">
      <ModalCloseButton
        {closeModal}
        position="right-2.5 top-2.5"
        size="sm"
        label="Close Intro"
        modalId="intro_modal"
      />
    </form>

    <div class="space-y-5 sm:space-y-6">
      <!-- Mascot slot (skeleton) — the ZipList dude, decorative, smaller in
           the modal so it reads alongside the title without crowding it. -->
      <div class="flex justify-center intro-mascot-slot">
        <Mascot interactive={false} aura={false} />
      </div>

      <h1
        id="intro_modal_title"
        class="text-center text-3xl sm:text-4xl font-black tracking-tight leading-[1.1] text-gray-900"
      >
        The shareable<br /> voice list thing.
      </h1>

      <!-- Three beats, each a headline + one plain line. The two things
           people don't work out on their own — that saying "got the milk"
           ticks it off, and that live lists need no account — get spelled
           out instead of implied. Structured, not prose: first-run copy
           gets skimmed, so each idea needs its own shape on the page. -->
      <div class="intro-beats">
        <p>
          <strong>Talk it in.</strong>
          Say the list out loud, it writes itself.
        </p>
        <p>
          <strong>Say what you did.</strong>
          "Got the milk" — and milk ticks itself off.
        </p>
        <p>
          <strong>Share it live.</strong>
          Two phones, one list, updating together.
        </p>
      </div>

      <p class="intro-footnote">
        No account, no signup, no subscription.<br />
        It's just a list. That's it.
      </p>

      <button
        type="button"
        class="w-full text-base sm:text-lg font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-full bg-gradient-to-r from-[#ffcc33] to-[#ff6ac2] text-slate-950 shadow-lg hover:shadow-xl hover:scale-105 active:scale-[0.98] transition-all duration-300"
        on:click={handleActionButton}
      >
        Zip it up
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="submit" class="text-[0]" aria-label="Close intro" tabindex="-1">close</button>
  </form>
</dialog>

<style>
  /* Mascot slot — shrink the shared Mascot to a modal-friendly size so it sits
     above the title without crowding it. Overrides the SoftStack breakpoint
     tokens locally; the character art itself is untouched. */
  .intro-mascot-slot :global(.mascot) {
    --mascot-size-mobile: 64px;
    --mascot-size-sm: 72px;
    --mascot-size-md: 80px;
    --mascot-size-lg: 80px;
    --mascot-ink-pad: 0%;
    margin-bottom: 0;
  }

  /* Three beats: bold lead-in carries the idea, the line under it does the
     explaining. Two type weights instead of one flat block, so the eye can
     skim just the bold and still get the pitch. */
  .intro-beats {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    text-align: center;
  }

  .intro-beats p {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.4;
    color: var(--zl-text-color-secondary, #3a2f2a);
  }

  .intro-beats strong {
    display: block;
    font-weight: 800;
    font-size: 1.0625rem;
    letter-spacing: -0.01em;
    color: var(--zl-text-color-primary, #1e1714);
  }

  /* The quiet closer — the "no catch" line. Deliberately understated:
     it's reassurance, not a sales pitch. */
  .intro-footnote {
    margin: 0;
    text-align: center;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--zl-text-color-disabled, #7d7269);
  }

  @media (min-width: 640px) {
    .intro-beats p {
      font-size: 1rem;
    }

    .intro-beats strong {
      font-size: 1.125rem;
    }

    .intro-footnote {
      font-size: 0.9375rem;
    }
  }
</style>
