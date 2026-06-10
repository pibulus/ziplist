<script>
  import { ModalCloseButton } from "./index.js";
  export let closeModal;
</script>

<dialog
  id="about_modal"
  class="modal modal-bottom sm:modal-middle overflow-hidden fixed z-50"
  style="overflow-y: hidden!important;"
  aria-labelledby="about_modal_title"
  aria-modal="true"
>
  <div
    class="modal-box bg-gradient-to-br from-[#fffaef] to-[#fff6e6] shadow-xl border border-pink-200 rounded-2xl overflow-y-auto max-h-[80vh]"
  >
    <form method="dialog">
      <ModalCloseButton
        {closeModal}
        label="Close about modal"
        modalId="about_modal"
      />
    </form>

    <div class="animate-fadeUp space-y-4">
      <div class="flex items-center gap-3 mb-1">
        <div
          class="w-9 h-9 bg-gradient-to-br from-white to-pink-50 rounded-full flex items-center justify-center shadow-sm border border-pink-200/60"
        >
          <span class="text-xl">👻</span>
        </div>
        <h3
          id="about_modal_title"
          class="font-black text-xl text-gray-800 tracking-tight"
        >
          The shareable voice list thing
        </h3>
      </div>

      <div
        class="bg-gradient-to-r from-pink-50/90 to-amber-50/90 p-4 rounded-lg border border-pink-200/60 shadow-sm"
      >
        <p class="text-sm leading-relaxed text-gray-700">
          ZipList is a quick shareable voice list thing. Talk stuff in, type
          stuff in, tap the tiny bits into place, share a list live with
          someone else. Tell it what you did and the boxes can tick themselves.
        </p>
      </div>

      <div>
        <h4 class="font-bold text-sm text-gray-700 mb-2">What it does:</h4>
        <ul class="space-y-1.5 text-sm text-gray-600">
          <li class="flex items-start gap-2">
            <span class="text-teal-600 text-lg">⬩</span>
            <span>Shopping lists, set lists, gear lists, forever lists</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-teal-600 text-lg">⬩</span>
            <span>Talk stuff in, type stuff in, edit the bits</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-teal-600 text-lg">⬩</span>
            <span>Tell ZipList what you did; boxes can tick themselves</span>
          </li>
        </ul>
      </div>

      <div
        class="border-l-3 border-pink-300 py-1 pl-4 ml-1 my-2 italic text-gray-600"
      >
        "Talk. List. Tick."
      </div>

      <div class="flex items-center gap-3 pt-2">
        <a
          href="https://ko-fi.com/madebypablo"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-teal-700 hover:text-teal-900 font-medium transition-colors"
        >
          ☕ Coffee jar
        </a>
        <a
          href="https://github.com/pibulus/ziplist"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
        >
          GitHub
        </a>
      </div>

      <div class="flex justify-between items-end pt-2">
        <div>
          <p class="text-xs text-gray-500">Melbourne, Australia</p>
        </div>
        <div class="flex items-center gap-2 text-xs font-medium text-gray-600">
          Pablo
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
  .animate-fadeUp {
    animation: fadeUp 0.5s ease-out forwards;
  }

  @keyframes fadeUp {
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
