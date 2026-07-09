<script>
  import { createEventDispatcher, onMount } from "svelte";
  import { browser } from "$app/environment";
  import { isContributor, setContributorStatus } from "$lib";
  import {
    CONTRIBUTOR_BENEFITS,
    CONTRIBUTOR_COPY,
    PRICING,
  } from "$lib/config/pricing.js";
  import ModalCloseButton from "./ModalCloseButton.svelte";

  export let closeModal = () => {};

  const dispatch = createEventDispatcher();

  onMount(() => {
    const dialog = document.getElementById("contributor_modal");
    function onDialogClose() { closeModal(); }
    if (dialog) dialog.addEventListener("close", onDialogClose);
    return () => { if (dialog) dialog.removeEventListener("close", onDialogClose); };
  });

  let code = "";
  let errorMessage = "";
  let successMessage = "";
  let isSubmitting = false;
  let isStartingCheckout = false;
  let codePanelOpen = false;

  function claimStorageKey(checkoutId) {
    return `ziplist_checkout_claim_${checkoutId}`;
  }

  function setCheckoutClaim(checkoutId, claimToken) {
    if (!browser || !checkoutId || !claimToken) return;
    sessionStorage.setItem(claimStorageKey(checkoutId), claimToken);
  }

  async function handleCheckout() {
    if (!browser || isStartingCheckout || $isContributor) return;

    isStartingCheckout = true;
    errorMessage = "";
    successMessage = "";

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
    successMessage = "";

    try {
      const response = await fetch("/api/contributor/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.valid) {
        errorMessage =
          payload.error || "Check the contributor code and try once more.";
        return;
      }

      setContributorStatus(true, payload.token || null);
      successMessage = "Contributor is unlocked on this device.";
      code = "";

      window.dispatchEvent(
        new CustomEvent("ziplist-setting-changed", {
          detail: { setting: "contributor", value: true },
        }),
      );

      dispatch("unlocked");
    } catch (error) {
      console.error("Failed to validate contributor code:", error);
      errorMessage = "Code check needs one more try in a moment.";
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    closeModal();
  }
</script>

<dialog
  id="contributor_modal"
  class="zl-contributor-dialog"
  aria-labelledby="contributor_modal_title"
  aria-describedby="contributor_modal_description"
  aria-modal="true"
>
  <div class="zl-contributor-card">
    <form method="dialog">
      <ModalCloseButton
        closeModal={handleClose}
        label="Close contributor modal"
        position="right-4 top-4"
        modalId="contributor_modal"
      />
    </form>

    <div class="zl-contributor-content">
      <div class="zl-contributor-mark" aria-hidden="true">
        <span>Zip</span>
      </div>

      <div class="zl-contributor-heading">
        <p class="zl-contributor-eyebrow">Contributor</p>
        <h3 id="contributor_modal_title">More room. Same quiet list.</h3>
        <p id="contributor_modal_description">
          {CONTRIBUTOR_COPY.summary}
        </p>
      </div>

      <div class="zl-price-card">
        <span>{PRICING.displayPrice}</span>
        <small>/year · no subscription</small>
      </div>

      <ul class="zl-benefit-grid">
        {#each CONTRIBUTOR_BENEFITS as benefit}
          <li>{benefit}</li>
        {/each}
      </ul>

      {#if $isContributor}
        <div class="zl-contributor-note success" role="status">
          Contributor is unlocked here.
        </div>
      {:else}
        <button
          type="button"
          class="zl-contributor-primary"
          on:click={handleCheckout}
          disabled={isStartingCheckout}
        >
          {isStartingCheckout
            ? "Opening checkout..."
            : `Contribute for a year - ${PRICING.displayPrice}`}
        </button>
      {/if}

      {#if errorMessage}
        <p class="zl-contributor-note error" role="alert">{errorMessage}</p>
      {/if}

      {#if successMessage}
        <p class="zl-contributor-note success" role="status">
          {successMessage}
        </p>
      {/if}

      <details bind:open={codePanelOpen} class="zl-code-panel">
        <summary>
          <span>Have a contributor code?</span>
          <strong>{codePanelOpen ? "Close" : "Open"}</strong>
        </summary>

        <div class="zl-code-form">
          <label for="contributor-code" class="sr-only">Contributor code</label>
          <input
            id="contributor-code"
            bind:value={code}
            type="text"
            placeholder="Enter code"
            autocomplete="one-time-code"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
          />
          <button
            type="button"
            class="zl-contributor-primary"
            on:click={handleUnlock}
            disabled={isSubmitting || !code.trim()}
          >
            {isSubmitting ? "Checking code..." : "Unlock with code"}
          </button>
          <p>Codes are for gifts and your other devices.</p>
        </div>
      </details>

      <button type="button" class="zl-contributor-later" on:click={handleClose}>
        Maybe later
      </button>
    </div>
  </div>

  <button
    type="button"
    class="zl-contributor-backdrop"
    aria-label="Close contributor modal"
    tabindex="-1"
    on:click={handleClose}
  ></button>
</dialog>

<style>
  :global(dialog.zl-contributor-dialog) {
    display: none;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    padding: max(12px, env(safe-area-inset-top))
      max(12px, env(safe-area-inset-right))
      max(16px, env(safe-area-inset-bottom))
      max(12px, env(safe-area-inset-left));
    margin: 0;
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    position: fixed;
    inset: 0;
    z-index: 1000;
    box-sizing: border-box;
  }

  :global(dialog.zl-contributor-dialog[open]) {
    display: flex;
  }

  .zl-contributor-card {
    position: relative;
    z-index: 1001;
    width: min(92vw, 30rem);
    max-height: min(88dvh, 42rem);
    overflow-y: auto;
    border: var(--zl-card-border-width, 4px) solid var(--zl-card-border-color, #000000);
    border-radius: var(--zl-card-border-radius, 28px);
    background: linear-gradient(145deg, #fffaf0 0%, #ffefd5 100%);
    box-shadow: var(--zl-card-box-shadow, 10px 10px 0 #000000);
    padding: 1.35rem;
    font-family: "Space Mono", monospace;
    animation: modal-pop 0.24s cubic-bezier(0.19, 1, 0.22, 1) forwards;
  }

  .zl-contributor-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 0.25rem;
  }

  .zl-contributor-mark {
    align-items: center;
    align-self: flex-start;
    background: linear-gradient(135deg, #ffd56a, #79e7d3);
    border: 3px solid var(--zl-card-border-color, #000000);
    border-radius: 18px;
    box-shadow: 4px 4px 0 var(--zl-card-border-color, #000000);
    color: var(--zl-text-color-primary, #111827);
    display: inline-flex;
    font-size: 0.82rem;
    font-weight: 900;
    min-height: 48px;
    padding: 0 0.85rem;
  }

  .zl-contributor-heading {
    padding-right: 2.25rem;
  }

  .zl-contributor-eyebrow {
    color: #11776d;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    margin: 0 0 0.35rem;
    text-transform: uppercase;
  }

  .zl-contributor-heading h3 {
    color: var(--zl-text-color-primary, #111827);
    font-size: clamp(1.65rem, 8vw, 2.25rem);
    font-weight: 900;
    letter-spacing: 0;
    line-height: 1;
    margin: 0;
  }

  .zl-contributor-heading p {
    color: var(--zl-text-color-secondary, #4b5563);
    font-size: 0.92rem;
    line-height: 1.55;
    margin: 0.75rem 0 0;
  }

  .zl-price-card {
    align-items: baseline;
    background: rgba(255, 255, 255, 0.78);
    border: 2px solid rgba(0, 0, 0, 0.16);
    border-radius: 18px;
    display: flex;
    gap: 0.45rem;
    padding: 0.95rem 1rem;
  }

  .zl-price-card span {
    color: #111827;
    font-size: 1.55rem;
    font-weight: 900;
  }

  .zl-price-card small {
    color: #6b7280;
    font-size: 0.85rem;
    font-weight: 800;
  }

  .zl-benefit-grid {
    display: grid;
    gap: 0.6rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .zl-benefit-grid li {
    background: rgba(255, 255, 255, 0.68);
    border: 2px solid rgba(0, 0, 0, 0.12);
    border-radius: 16px;
    color: #1f2937;
    font-size: 0.78rem;
    font-weight: 800;
    line-height: 1.25;
    min-height: 48px;
    padding: 0.75rem;
    text-align: center;
  }

  .zl-contributor-primary,
  .zl-contributor-later {
    border-radius: 999px;
    cursor: pointer;
    font-family: "Space Mono", monospace;
    font-weight: 900;
    letter-spacing: 0;
    min-height: 52px;
    transition: var(--zl-transition-fast, all 0.2s ease);
    width: 100%;
  }

  /* Programmatic focus target for a11y — no UA ring on a container */
  .zl-contributor-card:focus,
  .zl-contributor-card:focus-visible {
    outline: none;
  }

  .zl-contributor-primary {
    background: var(--zl-cta-color, #ffb000);
    border: 0;
    box-shadow: 0 3px 8px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.25);
    color: #111111;
  }

  .zl-contributor-primary:hover:not(:disabled),
  .zl-contributor-primary:focus-visible:not(:disabled) {
    box-shadow: 0 5px 14px rgba(var(--zl-cta-color-rgb, 255, 176, 0), 0.32);
    filter: saturate(1.08) brightness(1.04);
    outline: none;
    transform: translateY(-1px);
  }

  /* Chunky mode keeps its hard-edge identity — gated, not leaked */
  :global(html.mode-neo-brutalist) .zl-contributor-primary {
    border: 3px solid var(--zl-card-border-color, #000000);
    box-shadow: 5px 5px 0 var(--zl-card-border-color, #000000);
  }

  :global(html.mode-neo-brutalist) .zl-contributor-primary:hover:not(:disabled),
  :global(html.mode-neo-brutalist)
    .zl-contributor-primary:focus-visible:not(:disabled) {
    box-shadow: 7px 7px 0 var(--zl-card-border-color, #000000);
    filter: none;
    transform: translate(-1px, -1px);
  }

  .zl-contributor-primary:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .zl-contributor-later {
    background: rgba(255, 255, 255, 0.7);
    border: 2px solid rgba(0, 0, 0, 0.12);
    color: #4b5563;
  }

  .zl-contributor-later:hover,
  .zl-contributor-later:focus-visible {
    background: #ffffff;
    outline: none;
    transform: translateY(-1px);
  }

  .zl-contributor-note {
    border-radius: 16px;
    font-size: 0.82rem;
    font-weight: 800;
    line-height: 1.4;
    margin: 0;
    padding: 0.75rem 0.85rem;
  }

  .zl-contributor-note.error {
    background: #fff7d6;
    border: 2px solid #f2bf3a;
    color: #6b4b00;
  }

  .zl-contributor-note.success {
    background: #e8fff8;
    border: 2px solid #79d8c6;
    color: #126052;
  }

  .zl-code-panel {
    background: rgba(255, 255, 255, 0.55);
    border: 2px solid rgba(0, 0, 0, 0.12);
    border-radius: 18px;
    padding: 0.85rem;
  }

  .zl-code-panel summary {
    align-items: center;
    cursor: pointer;
    display: flex;
    font-size: 0.85rem;
    font-weight: 900;
    justify-content: space-between;
    list-style: none;
    min-height: 44px;
  }

  .zl-code-panel summary::-webkit-details-marker {
    display: none;
  }

  .zl-code-panel summary strong {
    color: #11776d;
    font-size: 0.78rem;
  }

  .zl-code-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .zl-code-form input {
    border: 2px solid rgba(0, 0, 0, 0.18);
    border-radius: 16px;
    color: #111827;
    font-family: "Space Mono", monospace;
    font-size: 0.92rem;
    font-weight: 800;
    min-height: 48px;
    padding: 0.75rem 0.9rem;
  }

  .zl-code-form input:focus {
    border-color: #f3a72f;
    box-shadow: 0 0 0 3px rgba(243, 167, 47, 0.18);
    outline: none;
  }

  .zl-code-form p {
    color: #6b7280;
    font-size: 0.72rem;
    font-weight: 700;
    margin: 0;
  }

  .zl-contributor-backdrop {
    background: rgba(0, 0, 0, 0.38);
    backdrop-filter: blur(4px);
    border: none;
    inset: 0;
    position: fixed;
    z-index: 1000;
  }

  @keyframes modal-pop {
    from {
      opacity: 0;
      transform: translateY(14px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .zl-contributor-card {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }

  @media (max-width: 420px) {
    .zl-contributor-card {
      border-radius: 24px;
      padding: 1rem;
      width: min(94vw, 28rem);
    }

    .zl-benefit-grid {
      grid-template-columns: 1fr;
    }

    .zl-contributor-heading {
      padding-right: 1.75rem;
    }
  }
</style>
