<script>
  import { ModalCloseButton } from "./index.js";
  import { Mascot } from "$lib/components/ui";
  export let closeModal;
</script>

<dialog
  id="about_modal"
  class="modal modal-middle overflow-hidden fixed z-50"
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

    <div class="space-y-4">
      <!-- pr-14 keeps the title clear of the absolute close X (40px button
           + right-2.5 offset on touch screens). -->
      <div class="flex items-center gap-3 mb-1 pr-14">
        <div class="about-mascot-slot shrink-0">
          <Mascot interactive={false} aura={false} />
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
          Talk stuff in, type stuff in, tap the tiny bits into place. Share a
          list live with someone else — tell it what you did and the boxes can
          tick themselves.
        </p>
      </div>

      <p class="text-xs text-gray-500 leading-relaxed">
        Your lists live on your device, not on a server.
      </p>

      <div class="flex flex-wrap justify-between items-center gap-3 pt-2">
        <p class="text-xs text-gray-500">Made by Pablo in Melbourne 💛</p>
        <a
          href="https://ko-fi.com/madebypablo"
          target="_blank"
          rel="noopener noreferrer"
          class="about-link text-xs text-teal-700 hover:text-teal-900 font-medium transition-colors"
        >
          ☕ Coffee jar
        </a>
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
