<script>
  import { ModalCloseButton } from './index.js';

  export let closeModal;
  export let markIntroAsSeen;
  export let triggerGhostClick;

  function handleActionButton() {
    const modal = document.getElementById('intro_modal');
    if (modal) modal.close();
    markIntroAsSeen();
    
    setTimeout(() => {
      triggerGhostClick();
    }, 300);
  }
</script>

<dialog id="intro_modal" class="modal modal-bottom sm:modal-middle" aria-labelledby="intro_modal_title" aria-modal="true">
  <div class="modal-box relative bg-[#fff9ed] rounded-3xl p-6 sm:p-8 md:p-10 w-[95%] max-w-[90vw] sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto border-0"
    style="box-shadow: 0 10px 25px -5px rgba(249, 168, 212, 0.3), 0 8px 10px -6px rgba(249, 168, 212, 0.2), 0 0 15px rgba(249, 168, 212, 0.15);">

    <form method="dialog">
      <ModalCloseButton {closeModal} position="right-4 top-4" size="sm" label="Close Intro" modalId="intro_modal" />
    </form>

    <div class="space-y-5 sm:space-y-6 md:space-y-7 animate-fadeIn">
      <h1 id="intro_modal_title" class="text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-gray-900">
        Ziplist's the best. <br> Organize the rest.
      </h1>

      <div class="space-y-3 sm:space-y-4">
        <p class="text-sm sm:text-base md:text-lg font-medium text-gray-700 leading-relaxed">
          Clean, sweet, and stupidly easy.
        </p>

        <p class="text-sm sm:text-base md:text-lg font-medium text-gray-700 leading-relaxed">
          Tap the mic to speak — we turn your voice into lists.
        </p>

        <p class="text-sm sm:text-base md:text-lg font-medium text-gray-700 leading-relaxed">
          Use it anywhere. Save it to your home screen.
          Add the extension. Talk into any box on any site.
        </p>
      </div>

      <p class="text-center text-pink-600 font-bold text-base sm:text-lg md:text-xl py-2">
        It's fast, it's fun, it's freaky good.
      </p>

      <form method="dialog">
        <button
          class="w-full text-base sm:text-lg font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-full bg-gradient-to-r from-yellow-400 to-pink-400 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-[0.98] transition-all duration-300"
          on:click={handleActionButton}
        >
          Tap the mic and start talking
        </button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
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

</style>
