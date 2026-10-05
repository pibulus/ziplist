<script>
  import { tick } from "svelte";
  import { browser } from "$app/environment";
  import { isContributor, setContributorStatus } from "$lib";
  import {
    CONTRIBUTOR_BENEFITS,
    CONTRIBUTOR_COPY,
  } from "$lib/config/pricing.js";
  import ModalCloseButton from "./ModalCloseButton.svelte";
  import { Mascot } from "$lib/components/ui";
  import { soundService } from "$lib/services/infrastructure/soundService";

  export let closeModal = () => {};

  let code = "";
  let errorMessage = "";
  let isSubmitting = false;
  let isStartingCheckout = false;
  let view = "pitch"; // 'pitch' or 'redeem'
  let codeInput;

  function claimStorageKey(checkoutId) {
    return `ziplist_checkout_claim_${checkoutId}`;
  }

  function setCheckoutClaim(checkoutId, claimToken) {
    if (!browser || !checkoutId || !claimToken) return;
    try {
      sessionStorage.setItem(claimStorageKey(checkoutId), claimToken);
    } catch (error) {
      console.warn("Failed to store checkout claim:", error);
    }
  }

  async function showRedeem() {
    errorMessage = "";
    view = "redeem";
    await tick();
    codeInput?.focus();
  }

  function showPitch() {
    errorMessage = "";
    view = "pitch";
  }

  function handleClose() {
    closeModal();
  }

  function handleDialogClose() {
    setTimeout(() => {
      view = "pitch";
      errorMessage = "";
    }, 150);
  }

  async function handleCheckout() {
    if (!browser || isStartingCheckout || $isContributor) return;

    isStartingCheckout = true;
    errorMessage = "";

    try {
      const response = await fetch("/api/contributor/checkout", {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.checkoutUrl) {
        errorMessage = payload.error || CONTRIBUTOR_COPY.checkoutError;
        return;
      }

      setCheckoutClaim(payload.checkoutId, payload.claimToken);
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      console.error("Failed to start contributor checkout:", error);
      errorMessage = "Checkout needs one more try in a moment.";
    } finally {
      isStartingCheckout = false;
    }
  }

  async function handleUnlock() {
    if (!browser || isSubmitting) return;

    isSubmitting = true;
    errorMessage = "";

    try {
      const response = await fetch("/api/contributor/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim() }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.valid) {
        errorMessage =
          payload.error || "Check the unlock code and try once more.";
        return;
      }

      setContributorStatus(true, payload.token || null);
      soundService.success?.({ force: true });
      view = "pitch";
      code = "";

      window.dispatchEvent(
        new CustomEvent("ziplist:toast", {
          detail: {
            message: "Extras unlocked on this device! ★",
            type: "success",
          },
        }),
      );
    } catch (error) {
      console.error("Failed to redeem code:", error);
      errorMessage = "Redeem needs one more try in a moment.";
    } finally {
      isSubmitting = false;
    }
  }
</script>

<dialog
  id="contributor_modal"
  class="modal"
  aria-labelledby="contributor_modal_title"
  aria-describedby="contributor_modal_description"
  aria-modal="true"
  on:close={handleDialogClose}
>
  <div class="zl-modal-md modal-box relative">
    <form method="dialog">
      <ModalCloseButton
        closeModal={handleClose}
        label="Close extras modal"
        modalId="contributor_modal"
      />
    </form>

    <!-- Built from TalkType pitch kit canon -->
    <div class="space-y-4 sm:space-y-5">
      <div class="flex justify-center pt-1">
        <div
          class="animate-zl-pulse-slow zl-pitch-hero h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]"
        >
          <Mascot interactive={false} aura={false} />
        </div>
      </div>

      {#if $isContributor}
        <!-- Unlocked State -->
        <div class="space-y-1.5 text-center">
          <h3
            id="contributor_modal_title"
            class="text-[1.55rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-2xl"
          >
            Extras are <span class="zl-marker">Unlocked ★</span>
          </h3>
          <p
            id="contributor_modal_description"
            class="text-sm font-bold text-pink-600"
          >
            All perks are active on this device.
          </p>
        </div>

        <div class="zl-pitch-copy">
          <ul class="zl-pitch-list">
            <li>Up to 12 active checklists.</li>
            <li>Real-time collaborative live rooms.</li>
            <li>Instant 4-word phrase device sync.</li>
          </ul>
        </div>

        <div class="space-y-2 pt-1">
          <button type="button" class="zl-pitch-cta" on:click={handleClose}>
            Nice, let's make lists
          </button>
        </div>
      {:else if view === "redeem"}
        <!-- Redeem Code View -->
        <div class="space-y-1.5 text-center">
          <h3
            id="contributor_modal_title"
            class="text-[1.55rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-3xl"
          >
            Redeem an <span class="zl-marker">Unlock Code</span>
          </h3>
          <p
            id="contributor_modal_description"
            class="text-sm font-bold leading-snug text-pink-600"
          >
            Codes work for gifts and extra devices.
          </p>
        </div>

        <form class="space-y-3" on:submit|preventDefault={handleUnlock}>
          <label for="contributor-code-input" class="sr-only">Unlock code</label
          >
          <input
            id="contributor-code-input"
            bind:this={codeInput}
            bind:value={code}
            type="text"
            placeholder="ZL-XXXX-XXXX"
            class="w-full rounded-2xl border-2 border-gray-900 bg-white px-4 py-3 text-center font-mono font-black uppercase tracking-wider text-gray-900 placeholder:text-gray-300 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
          />

          {#if errorMessage}
            <p
              class="rounded-xl border-2 border-amber-300 bg-amber-50 p-2.5 text-xs font-bold text-amber-900"
              role="alert"
            >
              {errorMessage}
            </p>
          {/if}

          <button
            type="submit"
            class="zl-pitch-cta"
            disabled={isSubmitting || !code.trim()}
          >
            {isSubmitting ? "Checking code..." : "Unlock with code"}
          </button>
        </form>

        <button
          type="button"
          class="mx-auto flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-bold text-gray-500 transition hover:text-gray-900"
          on:click={showPitch}
        >
          <span aria-hidden="true">←</span>
          <span>Back to perks</span>
        </button>
      {:else}
        <!-- Pitch View -->
        <div class="space-y-1.5 text-center">
          <h3
            id="contributor_modal_title"
            class="text-[1.55rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-3xl"
          >
            More lists, <span class="zl-marker">more chops.</span>
          </h3>
          <p
            id="contributor_modal_description"
            class="text-sm font-bold tracking-tight text-pink-600 sm:text-base"
          >
            12 lists · live rooms · every device
          </p>
        </div>

        <div class="zl-pitch-copy">
          <ul class="zl-pitch-list">
            {#each CONTRIBUTOR_BENEFITS as benefit}
              <li>{benefit}</li>
            {/each}
          </ul>
        </div>

        {#if errorMessage}
          <p
            class="rounded-xl border-2 border-amber-300 bg-amber-50 p-2.5 text-xs font-bold text-amber-900"
            role="alert"
          >
            {errorMessage}
          </p>
        {/if}

        <div class="space-y-2 pt-1">
          <button
            type="button"
            class="zl-pitch-cta"
            on:click={handleCheckout}
            disabled={isStartingCheckout}
          >
            <span aria-hidden="true">✦</span>
            <span>{isStartingCheckout ? "Opening checkout..." : "Dig in"}</span>
          </button>

          <p
            class="whitespace-nowrap px-1 text-center text-xs font-semibold text-gray-500"
          >
            {CONTRIBUTOR_COPY.priceLine}
          </p>

          <button
            type="button"
            class="zl-pitch-secondary"
            on:click={showRedeem}
          >
            Got an unlock code?
          </button>
        </div>
      {/if}

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
    aria-label="Close extras modal"
    on:click={handleClose}
  ></button>
</dialog>

<style>
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
