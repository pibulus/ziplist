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
  import { hapticService } from "$lib/services/infrastructure";
  import MembershipCard from "$lib/cartridges/MembershipCard.svelte";
  import Confetti from "$lib/components/ui/effects/Confetti.svelte";
  import {
    readStoredSupporterCode,
    saveStoredSupporterCode,
    getVaultHash,
  } from "$lib/services/vaultHashStorage.js";
  import { buildDeviceSyncUrl } from "$lib/services/qrHandshakeService.js";
  import { copyTextToClipboard } from "$lib/services/infrastructure/clipboard.js";

  export let closeModal = () => {};

  let code = "";
  let errorMessage = "";
  let isSubmitting = false;
  let isStartingCheckout = false;
  let view = "pitch"; // 'pitch' or 'redeem'
  let codeInput;
  let showConfetti = false;
  let passportCode = "";
  let vaultHash = "";
  let linkCopied = false;

  $: passportCode = readStoredSupporterCode() || "";
  $: if (passportCode && !vaultHash) {
    getVaultHash(passportCode)
      .then((h) => (vaultHash = h))
      .catch(() => {});
  }

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

  async function copySyncLink() {
    const targetCode = passportCode || readStoredSupporterCode();
    if (!targetCode) return;
    const syncUrl = buildDeviceSyncUrl({ code: targetCode });
    const success = await copyTextToClipboard(syncUrl);
    if (success) {
      linkCopied = true;
      soundService?.play?.("bloom") || soundService?.copySuccess?.();
      hapticService?.impact?.("light");
      setTimeout(() => (linkCopied = false), 2200);
      window.dispatchEvent(
        new CustomEvent("ziplist:toast", {
          detail: { message: "Sync link copied! 🔗", type: "success" },
        }),
      );
    } else {
      soundService?.locked?.();
      window.dispatchEvent(
        new CustomEvent("ziplist:toast", {
          detail: {
            message: "Couldn't copy automatically — select link manually",
            type: "warning",
          },
        }),
      );
    }
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

      const personalCode = payload.code || code.trim();
      saveStoredSupporterCode(personalCode);
      setContributorStatus(true, payload.token || null);
      passportCode = personalCode;
      vaultHash = await getVaultHash(personalCode);
      showConfetti = true;
      soundService?.play?.("bloom") || soundService?.success?.({ force: true });
      hapticService?.notification?.("success");
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
        <!-- Unlocked State with MembershipCard (TalkType canon) -->
        <div class="space-y-1.5 text-center">
          <h3
            id="contributor_modal_title"
            class="text-[1.55rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-2xl"
          >
            Your Passport is <span class="zl-marker">Ready</span>
          </h3>
          <p
            id="contributor_modal_description"
            class="text-sm font-bold text-pink-600"
          >
            Full extras unlocked on this device.
          </p>
        </div>

        {#if vaultHash}
          <div class="flex justify-center py-1">
            <MembershipCard {vaultHash} {passportCode} />
          </div>
        {/if}

        <div class="space-y-2.5 pt-2 text-center">
          <p class="px-2 text-xs font-bold leading-relaxed text-stone-600">
            Point your camera at your passport for instant sync across devices —
            it's magic! Or tap your passport to open the link on your device.
          </p>
          <button
            type="button"
            class="zl-pitch-secondary"
            on:click={copySyncLink}
          >
            {linkCopied ? "✨ Sync link copied!" : "🔗 Copy 1-click sync link"}
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
          <span>←</span>
          <span>Back to supporter pass</span>
        </button>
      {:else}
        <!-- Pitch View -->
        <div class="space-y-1.5 text-center">
          <h3
            id="contributor_modal_title"
            class="text-[1.55rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-3xl"
          >
            Unlock <span class="zl-marker">More Lists</span>
          </h3>
          <p
            id="contributor_modal_description"
            class="text-sm font-bold leading-snug text-pink-600"
          >
            {CONTRIBUTOR_COPY.tagline}
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
            disabled={isStartingCheckout}
            on:click={handleCheckout}
          >
            {isStartingCheckout
              ? "Starting checkout..."
              : CONTRIBUTOR_COPY.ctaButton}
          </button>

          <button
            type="button"
            class="zl-pitch-secondary"
            on:click={showRedeem}
          >
            {CONTRIBUTOR_COPY.redeemButton}
          </button>
        </div>

        <p class="text-center text-xs font-bold text-gray-400">
          {CONTRIBUTOR_COPY.finePrint}
        </p>
      {/if}
    </div>
  </div>

  <button
    type="button"
    class="modal-backdrop"
    aria-label="Close extras modal"
    tabindex="-1"
    on:click={handleClose}
  ></button>
</dialog>

{#if showConfetti}
  <Confetti duration={2000} on:complete={() => (showConfetti = false)} />
{/if}

<style>
  /* Mascot slot sizing inside pitch hero (matches TalkType canon) */
  .zl-pitch-hero :global(.mascot) {
    --mascot-size-mobile: 64px;
    --mascot-size-sm: 72px;
    --mascot-size-md: 72px;
    --mascot-size-lg: 72px;
    --mascot-ink-pad: 0%;
    width: var(--mascot-size-mobile);
    height: var(--mascot-size-mobile);
  }

  @media (min-width: 640px) {
    .zl-pitch-hero :global(.mascot) {
      width: var(--mascot-size-sm);
      height: var(--mascot-size-sm);
    }
  }
</style>
