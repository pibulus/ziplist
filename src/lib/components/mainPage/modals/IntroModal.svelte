<script>
  import { ModalCloseButton } from "./index.js";
  import { Mascot } from "$lib/components/ui";

  export let closeModal = () => {};
  export let markIntroAsSeen = () => {};
  export let triggerGhostClick = () => {};

  // Route through the shared closeModal so the modal animates OUT (skeleton
  // close-out) instead of vanishing via a direct dialog.close(). Mark the
  // intro seen, then kick off the mascot tap once the pop-out has finished.
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
  class="modal"
  aria-labelledby="intro_modal_title"
  aria-describedby="intro_modal_description"
  aria-modal="true"
>
  <div class="intro-modal-box zl-modal-md modal-box relative">
    <form method="dialog">
      <ModalCloseButton
        {closeModal}
        position="right-4 top-4"
        size="sm"
        label="Close Intro"
        modalId="intro_modal"
      />
    </form>

    <div class="space-y-4 sm:space-y-5">
      <!-- Mascot slot — TalkType pitch hero canon -->
      <div class="flex justify-center pt-1">
        <div
          class="animate-zl-pulse-slow zl-pitch-hero h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]"
        >
          <Mascot interactive={false} aura={false} float={false} />
        </div>
      </div>

      <div class="space-y-1.5 text-center">
        <h2
          id="intro_modal_title"
          class="text-[1.55rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-3xl"
        >
          Zip up a list,<br /><span class="zl-marker">lickety-split.</span>
        </h2>
        <p class="text-sm font-bold tracking-tight text-pink-600 sm:text-base">
          The talkable, shareable list thing.
        </p>
      </div>

      <!-- Feature lines: plain and centred, matching TalkType canon rhythm -->
      <div id="intro_modal_description" class="space-y-1.5 text-center">
        <p class="intro-line">Say the list out loud — it writes itself.</p>
        <p class="intro-line">"Got the milk" — and milk ticks itself off.</p>
        <p class="intro-line pt-2">
          No account, no login. Lists stay on this device.
        </p>
      </div>

      <div class="pt-1">
        <button
          type="button"
          class="zl-pitch-cta !min-h-12 w-full text-base sm:text-lg"
          on:click={handleActionButton}
        >
          Zip it up
        </button>
      </div>
    </div>
  </div>
  <button
    type="button"
    class="modal-backdrop"
    on:click={closeModal}
    aria-label="Close intro modal"
  ></button>
</dialog>

<style>
  /* Feature lines: plain and centred, matching TalkType IntroModal */
  .intro-line {
    font-size: 0.92rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.45;
    color: #463f3a;
  }

  @media (min-width: 640px) {
    .intro-line {
      font-size: 1rem;
    }
  }

  /* Custom pink shadow for intro modal (TalkType canon) */
  .intro-modal-box {
    box-shadow:
      0 10px 25px -5px rgba(249, 168, 212, 0.3),
      0 8px 10px -6px rgba(249, 168, 212, 0.2),
      0 0 15px rgba(249, 168, 212, 0.15);
  }

  /* Mascot slot sizing inside pitch hero */
  .zl-pitch-hero :global(.mascot) {
    --mascot-size-mobile: 64px;
    --mascot-size-sm: 72px;
    --mascot-size-md: 72px;
    --mascot-size-lg: 72px;
    --mascot-ink-pad: 0%;
    margin-bottom: 0;
  }
</style>
