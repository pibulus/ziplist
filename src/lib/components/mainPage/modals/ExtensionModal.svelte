<script>
  import { ModalCloseButton } from "./index.js";
  export let closeModal;
</script>

<dialog
  id="extension_modal"
  class="modal modal-middle fixed z-50 overflow-hidden"
  style="overflow-y: hidden!important;"
  aria-labelledby="extension_modal_title"
  aria-modal="true"
>
  <div
    class="modal-box max-h-[80vh] overflow-y-auto rounded-2xl border border-pink-200 bg-gradient-to-br from-[#fffaef] to-[#fff6e6] shadow-xl"
  >
    <form method="dialog">
      <ModalCloseButton
        {closeModal}
        label="Close extension modal"
        modalId="extension_modal"
      />
    </form>

    <div class="space-y-4">
      <!-- pr-10 keeps the title clear of the absolute close X -->
      <div class="mb-1 flex items-center gap-3 pr-10">
        <div
          class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-purple-200/60 shadow-sm"
        >
          <img
            src="/icons/icon-96x96.png"
            alt="Ziplist Chrome Extension"
            class="h-full w-full object-cover"
          />
        </div>
        <h3
          id="extension_modal_title"
          class="text-xl font-black tracking-tight text-gray-800"
        >
          Chrome Extension
        </h3>
      </div>

      <div
        class="rounded-lg border border-pink-200/60 bg-gradient-to-r from-pink-50/90 to-amber-50/90 p-4 shadow-sm"
      >
        <p class="text-sm leading-relaxed text-gray-700">
          Use ZipList in more places on the web. The Chrome extension lets you
          make quick lists directly in text fields when a full app would be too
          much.
        </p>
      </div>

      <div
        class="rounded-xl border border-pink-200/60 bg-gradient-to-br from-white to-pink-50/50 p-4 shadow-sm"
      >
        <h4 class="mb-2 text-sm font-bold text-gray-800">
          Installation in 5 easy steps:
        </h4>
        <ol
          class="mt-2 list-decimal space-y-2 pl-5 text-left text-sm text-gray-700"
        >
          <li class="pb-1">
            Download the extension files <span
              class="font-medium text-teal-700"
              aria-disabled="true">here</span
            >
          </li>
          <li class="pb-1">Unzip the files to a folder on your computer</li>
          <li class="pb-1">
            Open Chrome and go to <code
              class="rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-slate-800"
              >chrome://extensions</code
            >
          </li>
          <li class="pb-1">Enable "Developer mode" in the top-right corner</li>
          <li>Click "Load unpacked" and select the extension folder</li>
        </ol>
      </div>

      <div class="flex justify-end pt-1">
        <span class="text-xs font-medium italic text-gray-600"
          >Talk a list into any box.</span
        >
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
