<script>
  import { onDestroy, onMount } from "svelte";
  import { browser } from "$app/environment";
  import { setContributorStatus } from "$lib";
  import MembershipCard from "$lib/cartridges/MembershipCard.svelte";
  import { generateMemberIdentity } from "$lib/cartridges/identityUtils.js";
  import Confetti from "$lib/components/ui/effects/Confetti.svelte";
  import { copyTextToClipboard } from "$lib/services/infrastructure/clipboard.js";
  import { buildDeviceSyncUrl } from "$lib/services/qrHandshakeService.js";
  import { deviceSyncStore } from "$lib/services/realtime/deviceSyncStore.js";
  import {
    getVaultHash,
    saveStoredSupporterCode,
  } from "$lib/services/vaultHashStorage.js";

  let status = "checking";
  let message = "Confirming Passport unlock...";
  let contributorCode = "";
  let contributorPhrase = "";
  let vaultHash = "";
  let checkoutId = "";
  let pollTimer;
  let copyMessageTimer;
  let copyMessage = "";
  let showConfetti = false;

  // One flaky request right after paying must not kill the poll — only give
  // up after several consecutive failures. 403/404 are definitive and stay
  // immediate.
  let failedPolls = 0;
  const MAX_TRANSIENT_FAILURES = 4;

  $: identity = generateMemberIdentity(vaultHash);
  $: displayPasskey =
    contributorPhrase ||
    (!identity.isFallback ? identity.phrase : "") ||
    contributorCode;
  $: unlockUrl = contributorCode
    ? buildDeviceSyncUrl(contributorCode, $deviceSyncStore.privatePhrase)
    : "";

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
            "Payment is safe — status check needs a brief pause. Refresh this page in a moment.";
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
      message = "ZipList Passport is active on this device.";
      const savedCode = payload.code
        ? saveStoredSupporterCode(payload.code)
        : "";
      contributorCode = savedCode || payload.code || "";
      contributorPhrase = payload.phrase || "";
      setContributorStatus(true, payload.token || null);
      sessionStorage.removeItem(claimStorageKey(checkoutId));
      showConfetti = true;

      if (contributorCode) {
        vaultHash = await getVaultHash(contributorCode);
        await deviceSyncStore.activatePassport(contributorCode);
      }
    } catch {
      failedPolls += 1;
      if (failedPolls >= MAX_TRANSIENT_FAILURES) {
        status = "error";
        message = "Check the connection, then refresh this page.";
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

  function showCopiedNotice(text) {
    copyMessage = text;
    clearCopyMessageTimer();
    copyMessageTimer = setTimeout(() => {
      copyMessage = "";
      copyMessageTimer = null;
    }, 2000);
  }

  async function copyPasskey() {
    if (!browser || !displayPasskey) return;
    const ok = await copyTextToClipboard(displayPasskey);
    showCopiedNotice(ok ? "4-word passkey copied" : "Select key to copy");
  }

  async function copyUnlockLink() {
    if (!browser || !unlockUrl) return;
    const ok = await copyTextToClipboard(unlockUrl);
    showCopiedNotice(ok ? "Unlock link copied" : "Select link to copy");
  }

  onMount(() => {
    if (!browser) return;

    const params = new URLSearchParams(window.location.search);
    checkoutId = params.get("checkout_id") || "";

    if (!checkoutId) {
      status = "error";
      message = "Open ZipList and start Passport checkout again.";
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
  <title>ZipList Passport | ZipList</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if showConfetti}
  <Confetti
    kind="stars"
    particleCount={48}
    duration={2600}
    on:complete={() => (showConfetti = false)}
  />
{/if}

<main class="zl-success-page">
  <section class="zl-success-card" aria-live="polite">
    <div class="zl-success-mark" aria-hidden="true">✦ ZipList Passport</div>

    <div class="zl-success-copy">
      <h1>{status === "paid" ? "Passport Ready" : "Almost there"}</h1>
      <span>{message}</span>
    </div>

    {#if status === "pending" || status === "checking"}
      <div class="zl-success-progress" aria-hidden="true">
        <div></div>
      </div>
    {/if}

    {#if contributorCode}
      {#if vaultHash}
        <div class="w-full max-w-[310px]">
          <MembershipCard {vaultHash} passportCode={contributorCode} />
        </div>
      {/if}

      <div class="zl-code-card">
        <p>4-Word Passport Key</p>
        <strong>{displayPasskey}</strong>
        <span
          >Keep this 4-word key or scan the Passport QR above to link another
          phone or laptop.</span
        >
        <div class="zl-code-actions">
          <button
            type="button"
            class="zl-code-copy-button"
            on:click={copyPasskey}
          >
            Copy 4-Word Key
          </button>
          <button
            type="button"
            class="zl-code-copy-button is-teal"
            on:click={copyUnlockLink}
          >
            🔗 Copy Unlock Link
          </button>
        </div>
        {#if copyMessage}
          <p class="zl-copy-feedback" aria-live="polite">{copyMessage}</p>
        {/if}
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
    color: #1e1714;
    display: flex;
    font-family: "Space Mono", monospace;
    justify-content: center;
    min-height: 100dvh;
    padding: 1.25rem;
  }

  .zl-success-card {
    align-items: center;
    background: linear-gradient(145deg, #fffef7, #fbf1e4);
    border: 3px solid #1e1714;
    border-radius: 28px;
    box-shadow: 6px 6px 0 #1e1714;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    max-width: 28rem;
    padding: 1.75rem 1.5rem;
    text-align: center;
    width: 100%;
  }

  .zl-success-mark {
    align-items: center;
    background: #fde68a;
    border: 2px solid #1e1714;
    border-radius: 999px;
    box-shadow: 2px 2px 0 #1e1714;
    color: #1e1714;
    display: inline-flex;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    min-height: 36px;
    padding: 0 0.9rem;
    text-transform: uppercase;
  }

  .zl-code-card p {
    color: #525252;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    margin: 0 0 0.45rem;
    text-transform: uppercase;
  }

  .zl-success-copy h1 {
    color: #1e1714;
    font-size: clamp(1.85rem, 8vw, 2.4rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.05;
    margin: 0;
  }

  .zl-success-copy span,
  .zl-code-card span {
    color: #525252;
    display: block;
    font-size: 0.85rem;
    line-height: 1.45;
    margin-top: 0.5rem;
  }

  .zl-success-progress {
    background: #fbf1e4;
    border: 1.5px solid #1e1714;
    border-radius: 999px;
    height: 0.65rem;
    overflow: hidden;
    width: 100%;
  }

  .zl-success-progress div {
    animation: pulse-progress 1.2s ease-in-out infinite;
    background: #ff5ca8;
    border-radius: inherit;
    height: 100%;
    width: 42%;
  }

  .zl-code-card {
    background: #fffdf5;
    border: 2px solid #1e1714;
    border-radius: 20px;
    box-shadow: 2px 2px 0 #1e1714;
    padding: 1rem;
    width: 100%;
  }

  .zl-code-card strong {
    background: #fbf1e4;
    border: 1.5px solid #1e1714;
    border-radius: 12px;
    color: #1e1714;
    display: block;
    font-family: "Space Mono", monospace;
    font-size: 1rem;
    font-weight: 900;
    letter-spacing: 0.02em;
    padding: 0.55rem 0.75rem;
    word-break: break-word;
  }

  .zl-code-actions {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1fr;
    margin-top: 0.85rem;
  }

  @media (min-width: 440px) {
    .zl-code-actions {
      grid-template-columns: 1fr 1fr;
    }
  }

  .zl-return-button {
    align-items: center;
    background: #ff5ca8;
    border: 2px solid #1e1714;
    border-radius: 16px;
    box-shadow: 3px 3px 0 #1e1714;
    color: #1e1714;
    display: inline-flex;
    font-weight: 900;
    justify-content: center;
    min-height: 48px;
    padding: 0 1.25rem;
    text-decoration: none;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
    width: 100%;
  }

  .zl-return-button:hover {
    box-shadow: 4px 4px 0 #1e1714;
    transform: translate(-1px, -1px);
  }

  .zl-code-copy-button {
    background: #fde68a;
    border: 2px solid #1e1714;
    border-radius: 14px;
    box-shadow: 2px 2px 0 #1e1714;
    color: #1e1714;
    cursor: pointer;
    font-family: "Space Mono", monospace;
    font-size: 0.78rem;
    font-weight: 900;
    min-height: 44px;
    padding: 0.55rem 0.85rem;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
    width: 100%;
  }

  .zl-code-copy-button.is-teal {
    background: #ccfbf1;
  }

  .zl-code-copy-button:hover {
    box-shadow: 3px 3px 0 #1e1714;
    transform: translate(-1px, -1px);
  }

  .zl-copy-feedback {
    color: #db2777 !important;
    font-size: 0.75rem !important;
    font-weight: 800 !important;
    margin: 0.55rem 0 0 !important;
    text-transform: none !important;
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

    .zl-code-copy-button,
    .zl-return-button {
      transition: none;
    }

    .zl-code-copy-button:hover,
    .zl-return-button:hover {
      transform: none;
    }
  }
</style>
