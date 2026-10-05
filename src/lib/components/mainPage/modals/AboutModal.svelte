<script>
  import { ModalCloseButton } from "./index.js";
  import { Mascot } from "$lib/components/ui";
  import { isContributor } from "$lib";

  export let closeModal = () => {};

  /* The five facts anchor the app's personality and utility — stroke-icon
     language with concise lines matching TalkType pitch rhythm. */
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
      text: "No account. No sign-up. Lists stay on your device.",
      paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M5.64 5.64 18.36 18.36"],
    },
    {
      text: "Share live with someone else and tick boxes together.",
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

  function handleExtrasClick() {
    closeModal();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("ziplist-open-contributor"));
    }, 180);
  }
</script>

<dialog
  id="about_modal"
  class="modal"
  aria-labelledby="about_modal_title"
  aria-describedby="about_modal_description"
  aria-modal="true"
>
  <div class="zl-modal-md modal-box relative">
    <form method="dialog">
      <ModalCloseButton
        {closeModal}
        label="Close about modal"
        modalId="about_modal"
      />
    </form>

    <!-- Built from the pitch kit in app.css, matching TalkType canonical about modal -->
    <div class="space-y-4 sm:space-y-5">
      <div class="flex justify-center pt-1">
        <div
          class="animate-zl-pulse-slow zl-pitch-hero h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]"
        >
          <Mascot interactive={false} aura={false} />
        </div>
      </div>

      <div class="space-y-1.5 text-center">
        <h3
          id="about_modal_title"
          class="text-[1.55rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-3xl"
        >
          Zip up a list, <span class="zl-marker">lickety-split.</span>
        </h3>
        <p
          id="about_modal_description"
          class="text-sm font-bold tracking-tight text-pink-600 sm:text-base"
        >
          The shareable voice list thing.
        </p>
      </div>

      <div class="zl-pitch-copy">
        <p>Say the thing, and it's on the list.</p>
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
        <p>Click, speak, check off.</p>
        {#if !$isContributor}
          <p class="font-black text-gray-900">
            Unlock Extra Lists for 12 lists, live rooms, and every device kept
            in sync.
          </p>
        {/if}
      </div>

      <div class="space-y-2 pt-1">
        {#if !$isContributor}
          <button
            type="button"
            class="zl-pitch-cta"
            on:click={handleExtrasClick}
          >
            <span aria-hidden="true">✦</span>
            <span>Get Extra Lists</span>
          </button>
        {/if}
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a
            href="https://github.com/pibulus"
            target="_blank"
            rel="noopener noreferrer"
            class="zl-pitch-secondary"
            aria-label="Source code on GitHub"
          >
            <span aria-hidden="true">🐙</span>
            <span>Peek at the guts</span>
          </a>
          <a
            href="https://ko-fi.com/madebypablo"
            target="_blank"
            rel="noopener noreferrer"
            class="zl-pitch-secondary"
            aria-label="Support on Ko-fi"
          >
            <span aria-hidden="true">☕</span>
            <span>Buy me a coffee</span>
          </a>
        </div>
      </div>

      <p class="text-center text-xs font-semibold text-gray-500">
        © 2026 ZipList • Made by <span class="font-black text-gray-900"
          >Pablo</span
        > in Melbourne
      </p>
    </div>
  </div>
  <button
    type="button"
    class="modal-backdrop"
    on:click={closeModal}
    on:keydown={(e) => e.key === "Enter" && closeModal()}
    aria-label="Close about modal"
  ></button>
</dialog>

<style>
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
    opacity: 0.7;
    width: 18px;
  }

  /* Mascot slot inside pitch hero */
  .zl-pitch-hero :global(.mascot) {
    --mascot-size-mobile: 64px;
    --mascot-size-sm: 72px;
    --mascot-size-md: 72px;
    --mascot-size-lg: 72px;
    --mascot-ink-pad: 0%;
    margin-bottom: 0;
  }
</style>
