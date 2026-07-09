<script>
  import { onDestroy, onMount } from "svelte";
  import { browser } from "$app/environment";
  import { setContributorStatus } from "$lib";

  let status = "checking";
  let message = "Checking your contributor unlock...";
  let contributorCode = "";
  let checkoutId = "";
  let pollTimer;
  let copyMessageTimer;
  let copyMessage = "";

  // One flaky request right after paying must not kill the poll — only give
  // up after several consecutive failures. 403/404 are definitive and stay
  // immediate.
  let failedPolls = 0;
  const MAX_TRANSIENT_FAILURES = 4;

  function claimStorageKey(id) {
    return `ziplist_checkout_claim_${id}`;
  }

  async function checkCheckout() {
    if (!browser || !checkoutId) return;

    const claimToken = sessionStorage.getItem(claimStorageKey(checkoutId));
    if (!claimToken) {
      status = "missing-claim";
      message = "Open this link in the same browser used for checkout.";
      return;
    }

    try {
      const response = await fetch(
        `/api/contributor/checkout/${encodeURIComponent(checkoutId)}?claim_token=${encodeURIComponent(
          claimToken,
        )}`,
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          status = "error";
          message = payload.error || "Checkout status needs one more try.";
          return;
        }

        failedPolls += 1;
        if (failedPolls >= MAX_TRANSIENT_FAILURES) {
          status = "error";
          message =
            "Your payment is safe — the status check needs a break. Refresh this page in a moment.";
        }
        return;
      }

      failedPolls = 0;

      if (payload.status !== "paid") {
        status = "pending";
        message =
          "Payment is being confirmed. This usually takes a few seconds.";
        return;
      }

      status = "paid";
      message = "Contributor is unlocked on this device.";
      contributorCode = payload.code || "";
      setContributorStatus(true, payload.token || null);
      sessionStorage.removeItem(claimStorageKey(checkoutId));
    } catch {
      failedPolls += 1;
      if (failedPolls >= MAX_TRANSIENT_FAILURES) {
        status = "error";
        message = "Check your connection, then refresh this page.";
      }
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function clearCopyMessageTimer() {
    if (copyMessageTimer) {
      clearTimeout(copyMessageTimer);
      copyMessageTimer = null;
    }
  }

  async function copyContributorCode() {
    if (!browser || !contributorCode) return;

    try {
      await navigator.clipboard.writeText(contributorCode);
      copyMessage = "Copied";
      clearCopyMessageTimer();
      copyMessageTimer = setTimeout(() => {
        copyMessage = "";
        copyMessageTimer = null;
      }, 1800);
    } catch {
      copyMessage = "Tap the page, then try copy.";
    }
  }

  onMount(() => {
    if (!browser) return;

    const params = new URLSearchParams(window.location.search);
    checkoutId = params.get("checkout_id") || "";

    if (!checkoutId) {
      status = "error";
      message = "Open ZipList and start contributor checkout again.";
      return;
    }

    checkCheckout();
    pollTimer = setInterval(() => {
      if (
        status === "paid" ||
        status === "error" ||
        status === "missing-claim"
      ) {
        stopPolling();
        return;
      }
      checkCheckout();
    }, 2500);

    return () => {
      stopPolling();
      clearCopyMessageTimer();
    };
  });

  onDestroy(() => {
    stopPolling();
    clearCopyMessageTimer();
  });
</script>

<svelte:head>
  <title>Contributor Unlock | ZipList</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="zl-success-page">
  <section class="zl-success-card" aria-live="polite">
    <div class="zl-success-mark" aria-hidden="true">Zip</div>

    <div class="zl-success-copy">
      <p>Contributor</p>
      <h1>{status === "paid" ? "You are unlocked" : "Almost there"}</h1>
      <span>{message}</span>
    </div>

    {#if status === "pending" || status === "checking"}
      <div class="zl-success-progress" aria-hidden="true">
        <div></div>
      </div>
    {/if}

    {#if contributorCode}
      <div class="zl-code-card">
        <p>Your contributor code</p>
        <strong>{contributorCode}</strong>
        <span>Keep this code for unlocking ZipList on another device.</span>
        <button
          type="button"
          class="zl-code-copy-button"
          on:click={copyContributorCode}
        >
          {copyMessage || "Copy Code"}
        </button>
      </div>
    {/if}

    <a href="/" class="zl-return-button">Return to ZipList</a>
  </section>
</main>

<style>
  .zl-success-page {
    align-items: center;
    background:
      radial-gradient(
        circle at 50% 20%,
        rgba(255, 204, 77, 0.22),
        transparent 34rem
      ),
      #fff6e6;
    color: #111827;
    display: flex;
    font-family: "Space Mono", monospace;
    justify-content: center;
    min-height: 100dvh;
    padding: 1.25rem;
  }

  .zl-success-card {
    align-items: center;
    background: linear-gradient(145deg, #fffaf0, #ffefd5);
    border: 4px solid #000000;
    border-radius: 28px;
    box-shadow: 10px 10px 0 #000000;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    max-width: 28rem;
    padding: 2rem;
    text-align: center;
    width: 100%;
  }

  .zl-success-mark {
    align-items: center;
    background: var(--zl-cta-color, #ffb000);
    border: 3px solid #000000;
    border-radius: 18px;
    box-shadow: 4px 4px 0 #000000;
    display: inline-flex;
    font-weight: 900;
    min-height: 56px;
    padding: 0 1rem;
  }

  .zl-success-copy p,
  .zl-code-card p {
    color: #11776d;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0;
    margin: 0 0 0.45rem;
    text-transform: uppercase;
  }

  .zl-success-copy h1 {
    font-size: clamp(2rem, 10vw, 2.7rem);
    font-weight: 900;
    letter-spacing: 0;
    line-height: 1;
    margin: 0;
  }

  .zl-success-copy span,
  .zl-code-card span {
    color: #4b5563;
    display: block;
    font-size: 0.9rem;
    line-height: 1.5;
    margin-top: 0.75rem;
  }

  .zl-success-progress {
    background: rgba(255, 255, 255, 0.72);
    border-radius: 999px;
    height: 0.65rem;
    overflow: hidden;
    width: 100%;
  }

  .zl-success-progress div {
    animation: pulse-progress 1.2s ease-in-out infinite;
    background: #ffb000;
    border-radius: inherit;
    height: 100%;
    width: 42%;
  }

  .zl-code-card {
    background: rgba(255, 255, 255, 0.72);
    border: 2px solid rgba(0, 0, 0, 0.12);
    border-radius: 20px;
    padding: 1rem;
    width: 100%;
  }

  .zl-code-card strong {
    color: #111827;
    display: block;
    font-family: "Space Mono", monospace;
    font-size: 1.2rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    word-break: break-word;
  }

  .zl-return-button {
    align-items: center;
    background: var(--zl-cta-color, #ffb000);
    border: 3px solid #000000;
    border-radius: 999px;
    box-shadow: 5px 5px 0 #000000;
    color: #111111;
    display: inline-flex;
    font-weight: 900;
    justify-content: center;
    min-height: 52px;
    padding: 0 1.25rem;
    text-decoration: none;
    width: 100%;
  }

  .zl-code-copy-button {
    background: rgba(255, 255, 255, 0.86);
    border: 2px solid #000000;
    border-radius: 16px;
    box-shadow: 3px 3px 0 #000000;
    color: #111827;
    cursor: pointer;
    font-family: "Space Mono", monospace;
    font-size: 0.82rem;
    font-weight: 900;
    margin-top: 1rem;
    min-height: 44px;
    padding: 0.6rem 1rem;
    transition: var(--zl-transition-fast, all 0.2s ease);
    width: 100%;
  }

  .zl-code-copy-button:hover {
    box-shadow: 4px 4px 0 #000000;
    transform: translate(-1px, -1px);
  }

  @keyframes pulse-progress {
    0%,
    100% {
      transform: translateX(-10%);
    }
    50% {
      transform: translateX(150%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .zl-success-progress div {
      animation: none;
      transform: none;
    }

    .zl-code-copy-button {
      transition: none;
    }

    .zl-code-copy-button:hover {
      transform: none;
    }
  }
</style>
