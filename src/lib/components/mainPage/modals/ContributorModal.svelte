<script>
  import { createEventDispatcher, onMount } from "svelte";
  import { browser } from "$app/environment";
  import { isContributor, setContributorStatus } from "$lib";
  import {
    CONTRIBUTOR_BENEFITS,
    CONTRIBUTOR_COPY,
    PRICING,
  } from "$lib/config/pricing.js";
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
      <!-- Same tiny pink corner X as the settings modal — the two share one
           visual language now (Pablo's call 2026-08-17). -->
      <button
        type="button"
        class="zl-contributor-close"
        on:click={handleClose}
        aria-label="Close contributor modal"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </form>

    <div class="zl-contributor-content">
      <div class="zl-contributor-heading">
        <p class="zl-contributor-eyebrow">Contributor</p>
        <h3 id="contributor_modal_title">More room. Same quiet list.</h3>
        <p id="contributor_modal_description">
          {CONTRIBUTOR_COPY.summary}
        </p>
      </div>

      <ul class="zl-benefit-list">
        {#each CONTRIBUTOR_BENEFITS as benefit}
          <li>
            <span class="zl-benefit-check" aria-hidden="true">✓</span>
            <span>{benefit}</span>
          </li>
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
            : `Unlock Contributor Pass · ${PRICING.displayPrice}`}
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
    /* inset stretches the dialog; 100vw included the desktop scrollbar and
       biased the flex-center a few px right (same fix as the settings dialog). */
    width: auto;
    height: auto;
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

  /* One family voice with the settings modal: same cream card surface, same
     sans-black chrome (Space Mono survives only in the code input, where
     typed text matches the list's typewriter identity). */
  .zl-contributor-card {
    position: relative;
    z-index: 1001;
    width: min(92vw, 30rem);
    max-height: min(88dvh, 42rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    border: var(--zl-card-border-width, 4px) solid
      var(--zl-card-border-color, #1e1714);
    border-radius: var(--zl-card-border-radius, 28px);
    background: var(--zl-card-bg-gradient-color-start, #fff9f0);
    box-shadow: var(--zl-card-box-shadow, 0 12px 30px rgba(30, 23, 20, 0.12));
    padding: 1.5rem;
    animation: modal-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  .zl-contributor-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 3;
    background: #ff6ac2;
    border: none;
    cursor: pointer;
    color: #fffdf5;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 50%;
    box-shadow: 0 3px 8px rgba(255, 106, 194, 0.35);
    transition:
      transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.18s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .zl-contributor-close:hover {
    transform: scale(1.12) rotate(90deg);
    box-shadow: 0 5px 12px rgba(255, 106, 194, 0.5);
  }

  .zl-contributor-close:active {
    transform: scale(0.88);
  }

  .zl-contributor-close:focus-visible {
    outline: 3px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.45);
    outline-offset: 3px;
  }

  .zl-contributor-content {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding-top: 0.9rem;
  }

  .zl-contributor-heading {
    padding-right: 1.5rem;
  }

  .zl-contributor-eyebrow {
    color: var(--zl-text-color-secondary, #3a2f2a);
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    margin: 0 0 0.35rem;
    opacity: 0.75;
    text-transform: uppercase;
  }

  .zl-contributor-heading h3 {
    color: var(--zl-text-color-primary, #1e1714);
    font-size: clamp(1.65rem, 8vw, 2.25rem);
    font-weight: 900;
    letter-spacing: -0.01em;
    line-height: 1;
    margin: 0;
  }

  .zl-contributor-heading p {
    color: var(--zl-text-color-secondary, #3a2f2a);
    font-size: 0.92rem;
    line-height: 1.55;
    margin: 0.75rem 0 0;
  }

  /* Price and benefits wear the settings modal's row anatomy: soft white
     over cream, 2px quiet border, 16px corners. */
  .zl-benefit-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    list-style: none;
    margin: 0.25rem 0 0.5rem;
    padding: 0;
    text-align: left;
  }

  .zl-benefit-list li {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    color: var(--zl-text-color-primary, #1e1714);
    font-size: 0.88rem;
    font-weight: 800;
    line-height: 1.35;
  }

  .zl-benefit-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffb000;
    color: #1e1714;
    border: 2px solid #1e1714;
    font-size: 0.72rem;
    font-weight: 900;
    flex-shrink: 0;
  }

  .zl-contributor-primary {
    border-radius: 999px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.98rem;
    font-weight: 900;
    letter-spacing: -0.01em;
    min-height: 52px;
    transition: var(--zl-transition-fast, all 0.2s ease);
    width: 100%;
  }

  .zl-contributor-later {
    background: transparent;
    border: 0;
    box-shadow: none;
    color: var(--zl-text-color-secondary, #6b5f54);
    font-size: 0.82rem;
    font-weight: 800;
    min-height: 36px;
    padding: 0.4rem;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color 0.15s ease;
  }

  .zl-contributor-later:hover,
  .zl-contributor-later:focus-visible {
    color: var(--zl-text-color-primary, #1e1714);
    background: transparent;
    outline: none;
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
    color: #1e1714;
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
    border: 3px solid var(--zl-card-border-color, #1e1714);
    box-shadow: 5px 5px 0 var(--zl-card-border-color, #1e1714);
  }

  :global(html.mode-neo-brutalist) .zl-contributor-primary:hover:not(:disabled),
  :global(html.mode-neo-brutalist)
    .zl-contributor-primary:focus-visible:not(:disabled) {
    box-shadow: 7px 7px 0 var(--zl-card-border-color, #1e1714);
    filter: none;
    transform: translate(-1px, -1px);
  }

  .zl-contributor-primary:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .zl-contributor-later {
    background: rgba(255, 255, 255, 0.5);
    border: var(--zl-item-border-width, 2px) solid
      var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    color: var(--zl-text-color-secondary, #3a2f2a);
  }

  .zl-contributor-later:hover,
  .zl-contributor-later:focus-visible {
    background: #fffef7;
    border-color: var(--zl-primary-color, #ffb000);
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
    background: rgba(255, 255, 255, 0.5);
    border: var(--zl-item-border-width, 2px) solid
      var(--zl-item-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 16px;
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
    color: var(--zl-text-color-secondary, #3a2f2a);
    font-size: 0.78rem;
    opacity: 0.8;
  }

  .zl-code-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .zl-code-form input {
    background: rgba(255, 255, 255, 0.8);
    border: 2px solid rgba(30, 23, 20, 0.18);
    border-radius: 12px;
    color: var(--zl-text-color-primary, #1e1714);
    font-family: "Space Mono", monospace;
    font-size: 0.92rem;
    font-weight: 700;
    min-height: 48px;
    padding: 0.75rem 0.9rem;
  }

  .zl-code-form input:focus {
    border-color: var(--zl-primary-color, #ffb000);
    box-shadow: 0 0 0 3px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.18);
    outline: none;
  }

  .zl-code-form p {
    color: var(--zl-text-color-secondary, #3a2f2a);
    font-size: 0.72rem;
    font-weight: 700;
    margin: 0;
    opacity: 0.75;
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

    .zl-contributor-heading {
      padding-right: 1.75rem;
    }
  }
</style>
