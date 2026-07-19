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

    <div class="space-y-5 sm:space-y-6 md:space-y-7 animate-fadeIn">
      <!-- Mascot slot (skeleton) — the ZipList dude, decorative, smaller in
           the modal so it reads alongside the title without crowding it. -->
      <div class="flex justify-center intro-mascot-slot">
        <Mascot interactive={false} aura={false} />
      </div>

      <h1
        id="intro_modal_title"
        class="text-center text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-gray-900"
      >
        Speak up a list, <br /> lickety split.
      </h1>

      <div class="space-y-3 sm:space-y-4">
        <p
          class="text-sm sm:text-base md:text-lg font-medium text-gray-700 leading-relaxed"
        >
          The shareable voice list thing. Talk stuff in, type stuff in, tap
          the tiny bits into place.
        </p>

        <p
          class="text-sm sm:text-base md:text-lg font-medium text-gray-700 leading-relaxed"
        >
          Tell ZipList what you did and watch the boxes tick themselves. Add a
          few things while you're at it.
        </p>

        <p
          class="text-sm sm:text-base md:text-lg font-medium text-gray-700 leading-relaxed"
        >
          Shopping list, band set list, gear list, chores list, forever list.
          Last box ticked, confetti in the air.
        </p>
      </div>

      <p
        class="text-center text-teal-700 font-bold text-base sm:text-lg md:text-xl py-2"
      >
        Talk. List. Tick.
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
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-out forwards;
  }

  @keyframes fadeIn {
    0% {
      opacity: 0;
      transform: translateY(8px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Mascot slot — shrink the shared Mascot to a modal-friendly size so it sits
     above the title without crowding it. Overrides the SoftStack breakpoint
     tokens locally; the character art itself is untouched. */
  .intro-mascot-slot :global(.mascot) {
    --mascot-size-mobile: 64px;
    --mascot-size-sm: 72px;
    --mascot-size-md: 80px;
    --mascot-size-lg: 80px;
    margin-bottom: 0;
  }
</style>
