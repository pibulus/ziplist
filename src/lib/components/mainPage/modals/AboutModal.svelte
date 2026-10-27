<script>
  import { onDestroy, onMount } from "svelte";
  import { browser } from "$app/environment";
  import { ModalCloseButton } from "./index.js";
  import { Mascot } from "$lib/components/ui";
  import { isContributor } from "$lib";
  import { ANIMATION, STORAGE_KEYS } from "$lib/constants";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import { dealTips } from "$lib/config/aboutTips.js";

  export let closeModal = () => {};

  const emojis = ["🌴", "☕", "🍸", "🌮"];
  let emojiIndex = Math.floor(Math.random() * emojis.length);

  function shuffleEmoji() {
    emojiIndex = (emojiIndex + 1) % emojis.length;
  }

  let dialog;
  let tips = [];
  let openObserver;

  function readDeck() {
    if (!browser) return [];
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(STORAGE_KEYS.ABOUT_TIPS_DECK) || "[]",
      );
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function writeDeck(deck) {
    if (!browser) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.ABOUT_TIPS_DECK,
        JSON.stringify(deck),
      );
    } catch {
      // Storage unavailable
    }
  }

  function dealNextHand() {
    const next = dealTips({ deck: readDeck() });
    tips = next.hand;
    writeDeck(next.deck);
  }

  function dealAgain() {
    soundService?.select?.();
    dealNextHand();
  }

  onMount(() => {
    dealNextHand();
    if (dialog && typeof MutationObserver !== "undefined") {
      openObserver = new MutationObserver(() => {
        if (dialog?.open && $isContributor) dealNextHand();
      });
      openObserver.observe(dialog, {
        attributes: true,
        attributeFilter: ["open"],
      });
    }
  });

  onDestroy(() => openObserver?.disconnect());

  function handlePassportClick() {
    closeModal();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("ziplist-open-contributor"));
    }, ANIMATION.MODAL.CLOSE_DURATION + 30);
  }
</script>

<dialog
  id="about_modal"
  class="modal"
  aria-labelledby="about_modal_title"
  aria-describedby="about_modal_description"
  aria-modal="true"
  bind:this={dialog}
>
  <div class="zl-modal-sm zl-modal-contained modal-box relative">
    <form method="dialog">
      <ModalCloseButton
        {closeModal}
        label="Close about modal"
        modalId="about_modal"
      />
    </form>

    <div
      class="zl-modal-scroll-area min-h-0 space-y-4 overflow-y-auto overflow-x-hidden pb-1 pr-1 sm:space-y-5"
    >
      <div class="flex justify-center pt-0.5">
        <div
          class="animate-zl-pulse-slow zl-pitch-hero h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]"
        >
          <Mascot interactive={false} aura={false} float={false} />
        </div>
      </div>

      {#if $isContributor}
        <div class="space-y-1.5 text-center">
          <h3
            id="about_modal_title"
            class="px-6 text-[1.45rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-2xl"
          >
            Getting the most out of <span class="zl-marker">ZipList</span>
          </h3>
          <p
            id="about_modal_description"
            class="text-sm font-bold tracking-tight"
            style="color: var(--zl-vibe-accent-text, #db2777);"
          >
            Fresh tricks on every open.
          </p>
        </div>

        <div class="zl-pitch-copy">
          <ul class="about-tips" aria-live="polite">
            {#each tips as tip (tip.id)}
              <li>
                <span class="about-tip-icon" aria-hidden="true">{tip.icon}</span
                >
                <span>{tip.text}</span>
              </li>
            {/each}
          </ul>
          <button type="button" class="about-deal-again" on:click={dealAgain}>
            <span>Deal three more ↻</span>
          </button>
        </div>

        <div class="space-y-1.5 pt-1">
          <button
            type="button"
            class="zl-pitch-cta"
            on:click={handlePassportClick}
          >
            <span aria-hidden="true">✦</span>
            <span>Open ZipList Passport</span>
          </button>
        </div>
      {:else}
        <div class="space-y-1.5 text-center">
          <h3
            id="about_modal_title"
            class="px-6 text-[1.55rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-3xl"
          >
            Zip up a list, <span class="zl-marker">lickety-split.</span>
          </h3>
          <p
            id="about_modal_description"
            class="text-sm font-bold tracking-tight sm:text-base"
            style="color: var(--zl-vibe-accent-text, #db2777);"
          >
            The shareable voice list thing.
          </p>
        </div>

        <div class="zl-pitch-copy">
          <p>Say the thing, and it lands on the list.</p>
          <ul class="zl-pitch-list">
            <li>Tap to talk, or hold like a walkie-talkie.</li>
            <li>No account. Lists stay fast and local by default.</li>
            <li>Share live with someone else and tick boxes together.</li>
          </ul>
        </div>

        <div class="space-y-2 pt-1">
          <button
            type="button"
            class="zl-pitch-cta"
            on:click={handlePassportClick}
          >
            <span aria-hidden="true">✦</span>
            <span>ZipList Passport</span>
          </button>
        </div>
      {/if}

      <p class="text-center text-xs font-semibold text-[#525252]">
        Made by
        <a
          href="https://github.com/pibulus"
          target="_blank"
          rel="noopener noreferrer"
          class="font-black text-[#1e1714] underline transition-colors hover:text-pink-600"
          >Pablo</a
        >
        <button
          type="button"
          class="inline-flex min-h-11 min-w-11 transform cursor-pointer select-none items-center justify-center transition-transform hover:scale-125 active:scale-95"
          on:click={shuffleEmoji}
          title="Shuffle vibe emoji"
          aria-label="Vibe emoji: click to shuffle">{emojis[emojiIndex]}</button
        >
        in Melbourne ·
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          class="underline underline-offset-2">Privacy</a
        >
        ·
        <a
          href="/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          class="underline underline-offset-2">Terms</a
        >
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
  .zl-pitch-hero :global(.mascot) {
    --mascot-size-mobile: 64px;
    --mascot-size-sm: 72px;
    --mascot-size-md: 72px;
    --mascot-size-lg: 72px;
    --mascot-ink-pad: 0%;
    width: var(--mascot-size-mobile);
    height: var(--mascot-size-mobile);
    margin-bottom: 0;
  }

  @media (min-width: 640px) {
    .zl-pitch-hero :global(.mascot) {
      width: var(--mascot-size-sm);
      height: var(--mascot-size-sm);
    }
  }

  .about-tips {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .about-tips > li {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    animation: about-tip-in 0.32s cubic-bezier(0.34, 1.4, 0.64, 1) both;
  }

  .about-tips > li:nth-child(2) {
    animation-delay: 0.05s;
  }

  .about-tips > li:nth-child(3) {
    animation-delay: 0.1s;
  }

  .about-tips > li + li {
    margin-top: 0.7rem;
  }

  .about-tip-icon {
    flex-shrink: 0;
    width: 1.4rem;
    text-align: center;
    font-size: 1.05rem;
    line-height: 1.3;
  }

  .about-deal-again {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.25rem;
    padding: 0 0.25rem;
    font-size: 0.8125rem;
    font-weight: 800;
    color: var(--zl-vibe-accent-text, #db2777);
    text-decoration: underline;
    text-underline-offset: 0.2em;
    touch-action: manipulation;
  }

  .about-deal-again:active {
    transform: scale(0.97);
  }

  @keyframes about-tip-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .about-tips > li {
      animation: none;
    }
    .about-deal-again:active {
      transform: none;
    }
  }
</style>
