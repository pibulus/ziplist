<script>
  import { ModalCloseButton } from "./index.js";
  import { Mascot } from "$lib/components/ui";
  export let closeModal;
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
      <div class="mb-1 flex items-center gap-3 pr-14">
        <div class="about-mascot-slot shrink-0">
          <Mascot interactive={false} aura={false} />
        </div>
        <div>
          <h3
            id="about_modal_title"
            class="text-xl font-black tracking-tight text-gray-800"
          >
            Zip up a list, lickety-split
          </h3>
          <p class="text-xs font-semibold tracking-wide text-pink-600">
            The shareable voice list thing
          </p>
        </div>
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
      <div class="space-y-1.5 text-sm leading-relaxed text-gray-600">
        <p>No account. No sign-up. No upsell to use it.</p>
        <p>Lists live on the device, not on somebody's server.</p>
        <p>Share one live and two people can tick the same boxes.</p>
        <p>Four words carry a list to another phone. No login, no fuss.</p>
        <!-- The long version lives at /about. Linked from inside the modal
             rather than given its own footer button — the footer already has
             an About affordance and this is the same idea, further down. -->
        <p class="pt-1">
          <a
            href="/about"
            class="font-semibold underline decoration-pink-300 underline-offset-2 hover:text-gray-800"
            >How it works, at more length</a
          >
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p class="text-xs text-gray-500">
          © 2026 ZipList • Made by <a
            href="https://madebypablo.app"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-gray-800">Pablo</a
          > in Melbourne
        </p>
        <div class="flex items-center gap-1">
          <a
            href="https://github.com/pibulus"
            target="_blank"
            rel="noopener noreferrer"
            class="about-link text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
            aria-label="Source code on GitHub"
          >
            🐙 Peek at the guts
          </a>
          <a
            href="https://ko-fi.com/madebypablo"
            target="_blank"
            rel="noopener noreferrer"
            class="about-link text-xs font-medium text-teal-700 transition-colors hover:text-teal-900"
          >
            ☕ Buy me a coffee
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
