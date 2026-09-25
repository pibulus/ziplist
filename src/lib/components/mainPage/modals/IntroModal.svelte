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
    class="modal-box relative max-h-[90vh] overflow-y-auto rounded-2xl border border-pink-200 bg-gradient-to-br from-[#fffaef] to-[#fff6e6] shadow-xl"
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
      <div class="intro-mascot-slot flex justify-center">
        <Mascot interactive={false} aura={false} />
      </div>

      <h1
        id="intro_modal_title"
        class="text-center text-3xl font-black leading-[1.1] tracking-tight text-gray-900 sm:text-4xl"
      >
        Zip up a list,<br /><span class="zl-marker">lickety-split.</span>
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
        class="btn min-h-12 w-full rounded-2xl border-2 border-gray-900 bg-pink-500 text-base font-black tracking-tight text-white shadow-[3px_3px_0px_#1e1714] transition-all duration-150 hover:-translate-y-0.5 hover:bg-pink-600 hover:shadow-[4px_4px_0px_#1e1714] active:translate-y-0.5 active:shadow-none sm:text-lg"
        on:click={handleActionButton}
      >
        Zip it up
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button
      type="submit"
      class="text-[0]"
      aria-label="Close intro"
      tabindex="-1">close</button
    >
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

  .zl-marker {
    background-image: linear-gradient(
      to top,
      rgba(255, 106, 194, 0.45) 0%,
      rgba(255, 106, 194, 0.45) 38%,
      transparent 38%
    );
    border-radius: 2px;
    padding: 0 0.08em;
  }
</style>
