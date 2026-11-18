<script>
  import { onMount, tick } from "svelte";
  import { browser } from "$app/environment";
  import {
    getContributorTokenSnapshot,
    isContributor,
    setContributorStatus,
  } from "$lib";
  import {
    CONTRIBUTOR_BENEFITS,
    CONTRIBUTOR_COPY,
    CONTRIBUTOR_REASONS,
  } from "$lib/config/pricing.js";
  import { ANIMATION } from "$lib/constants.js";
  import ModalCloseButton from "./ModalCloseButton.svelte";
  import { Mascot } from "$lib/components/ui";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import { hapticService } from "$lib/services/infrastructure";
  import MembershipCard from "$lib/components/ui/MembershipCard.svelte";
  import SyncPresence from "$lib/components/ui/SyncPresence.svelte";
  import Confetti from "$lib/components/ui/Confetti.svelte";
  import { parseFourWordPasskey } from "$lib/softstack-passport/identity.js";
  import {
    readStoredSupporterCode,
    saveStoredSupporterCode,
    getVaultHash,
  } from "$lib/services/vaultHashStorage.js";
  import { extractPairingInput } from "$lib/services/realtime/qrHandshakeService.js";
  import { deviceSyncStore } from "$lib/services/realtime/deviceSyncStore.js";

  export let closeModal = () => {};
  export let reason = "";

  $: reasonNote = CONTRIBUTOR_REASONS[reason] || "";

  const PREVIEW_VAULT_HASH =
    "000000100000000f000000000000000000000000000000000000000000000000";
  const MAX_PASSPORT_CODE_LENGTH = 160;

  let code = "";
  let errorMessage = "";
  let isSubmitting = false;
  let isStartingCheckout = false;
  let view = "pitch"; // 'pitch' or 'redeem'
  let codeInput;
  let showConfetti = false;
  let passportCode = "";
  let vaultHash = "";
  let showEmailForm = false;
  let emailInput = "";
  let emailError = "";
  let isSendingEmail = false;
  let emailSent = false;
  let emailInputEl;

  let showWordsForm = false;
  let wordsInput = "";
  let wordsError = "";
  let wordsBusy = false;
  let wordsInputEl;
  let justSynced = false;
  let confirmingDisconnect = false;

  let passportExpiry = null;

  // The token already carries the term. Showing it costs nothing and turns
  // "a year" from a claim on a sales page into a date on this device.
  function readPassportExpiry() {
    if (!browser) return null;
    try {
      const token = getContributorTokenSnapshot();
      const payload = token?.split(".")[1];
      if (!payload) return null;
      const json = JSON.parse(
        atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
      );
      return json?.exp ? new Date(json.exp * 1000) : null;
    } catch {
      return null;
    }
  }

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  $: passportExpiryLabel = passportExpiry
    ? `${passportExpiry.getUTCDate()} ${MONTH_NAMES[passportExpiry.getUTCMonth()]} ${passportExpiry.getUTCFullYear()}`
    : "";
  $: passportDaysLeft = passportExpiry
    ? Math.ceil((passportExpiry.getTime() - Date.now()) / 86400000)
    : null;

  $: if (browser && $isContributor && !passportCode) {
    passportCode = readStoredSupporterCode() || "";
  }

  $: parsedPhrase = parseFourWordPasskey(passportCode)?.phrase || "";
  $: hasPasskey = Boolean(parsedPhrase);

  $: hashSeed = passportCode || ($isContributor ? "contributor-active" : "");

  $: if (hashSeed) {
    getVaultHash(hashSeed)
      .then((h) => {
        vaultHash = h;
      })
      .catch(() => {});
  } else {
    vaultHash = "";
  }

  function refreshStoredPassport() {
    if (!browser) return;
    passportExpiry = readPassportExpiry();
    const storedCode = readStoredSupporterCode();
    passportCode = storedCode || "";
    const seed = storedCode || ($isContributor ? "contributor-active" : "");
    if (seed) {
      getVaultHash(seed)
        .then((h) => {
          vaultHash = h;
        })
        .catch(() => {});
    } else {
      vaultHash = "";
    }
  }

  onMount(() => {
    if (!browser) return;
    refreshStoredPassport();
    window.addEventListener("ziplist-passport-changed", refreshStoredPassport);
    return () => {
      window.removeEventListener(
        "ziplist-passport-changed",
        refreshStoredPassport,
      );
    };
  });

  function claimStorageKey(checkoutId) {
    return `ziplist_checkout_claim_${checkoutId}`;
  }

  function setCheckoutClaim(checkoutId, claimToken) {
    if (!browser || !checkoutId || !claimToken) return false;
    try {
      sessionStorage.setItem(claimStorageKey(checkoutId), claimToken);
      return true;
    } catch (error) {
      console.warn("Failed to store checkout claim:", error);
      return false;
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
      showConfetti = false;
      showEmailForm = false;
      emailInput = "";
      emailError = "";
      emailSent = false;
      showWordsForm = false;
      wordsInput = "";
      wordsError = "";
      justSynced = false;
      confirmingDisconnect = false;
    }, ANIMATION.MODAL.CLOSE_DURATION);
  }

  async function toggleEmailForm() {
    emailError = "";
    emailSent = false;
    showEmailForm = !showEmailForm;
    if (showEmailForm) {
      showWordsForm = false;
      await tick();
      emailInputEl?.focus();
    }
  }

  async function toggleWordsForm() {
    wordsError = "";
    showWordsForm = !showWordsForm;
    if (showWordsForm) {
      showEmailForm = false;
      await tick();
      wordsInputEl?.focus();
    }
  }

  async function redeemAndLink(rawInput) {
    const extracted = extractPairingInput(rawInput);
    const candidateCode = extracted?.code || rawInput.trim();
    const candidateSyncPhrase = extracted?.phrase || "";

    if (!candidateCode) {
      return { ok: false, error: "Enter a 4-word passkey to unlock." };
    }

    const response = await fetch("/api/contributor/redeem", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: candidateCode }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.valid) {
      return {
        ok: false,
        error: payload.error || "Check the 4-word passkey and try once more.",
      };
    }

    const personalCode = saveStoredSupporterCode(
      payload.phrase || payload.code || candidateCode,
    );
    setContributorStatus(true, payload.token || null);
    if (candidateSyncPhrase) {
      deviceSyncStore.pairWithPhrase(candidateSyncPhrase);
    }
    passportCode = personalCode;
    passportExpiry = readPassportExpiry();
    vaultHash = await getVaultHash(personalCode);
    await deviceSyncStore.enableSync();

    return { ok: true };
  }

  async function handleWordsRestore() {
    if (!browser || wordsBusy) return;
    const raw = wordsInput.trim();
    if (!raw) return;

    wordsBusy = true;
    wordsError = "";

    try {
      const result = await redeemAndLink(raw);
      if (!result.ok) {
        wordsError = result.error;
        return;
      }

      wordsInput = "";
      showWordsForm = false;
      justSynced = true;
      showConfetti = true;
      soundService?.fanfare?.({ force: true });
      hapticService?.notification?.("success");
      window.dispatchEvent(
        new CustomEvent("ziplist:toast", {
          detail: {
            message: "Devices linked! ✨",
            type: "success",
          },
        }),
      );
    } catch (error) {
      console.error("Failed to link 4-word passkey:", error);
      wordsError = "Passkey check needs one more try in a moment.";
    } finally {
      wordsBusy = false;
    }
  }

  function handleDisconnectPassport() {
    if (!browser) return;
    deviceSyncStore.disableSync();
    setContributorStatus(false, null);
    passportCode = "";
    vaultHash = "";
    passportExpiry = null;
    confirmingDisconnect = false;
    justSynced = false;
    soundService?.select?.();
  }

  async function handleEmailPassport() {
    if (!browser || isSendingEmail) return;
    const targetEmail = emailInput.trim();
    const targetCode = passportCode || code || readStoredSupporterCode();
    if (!targetEmail || !targetCode) return;

    isSendingEmail = true;
    emailError = "";

    try {
      const contributorToken = getContributorTokenSnapshot();

      const headers = { "Content-Type": "application/json" };
      if (contributorToken) {
        headers["x-ziplist-contributor-token"] = contributorToken;
      }

      const response = await fetch("/api/contributor/email-pass", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: targetEmail,
          code: targetCode,
          phrase: parseFourWordPasskey(targetCode)?.phrase || "",
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.sent) {
        emailError =
          payload.error ||
          "Email delivery paused right now. Try once more in a moment.";
        return;
      }

      emailInput = "";
      showEmailForm = false;
      emailSent = true;
      soundService?.copySuccess?.({ force: true });
      hapticService?.impact?.("light");
      window.dispatchEvent(
        new CustomEvent("ziplist:toast", {
          detail: {
            type: "success",
            message: "Passport dispatched to inbox ✉️",
          },
        }),
      );
    } catch (error) {
      console.warn("Failed to email contributor passport:", error);
      emailError =
        "Email delivery paused right now. Try once more in a moment.";
    } finally {
      isSendingEmail = false;
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
      const result = await redeemAndLink(code);
      if (!result.ok) {
        errorMessage = result.error;
        return;
      }

      showConfetti = true;
      soundService?.fanfare?.({ force: true });
      hapticService?.notification?.("success");
      view = "pitch";
      code = "";

      window.dispatchEvent(
        new CustomEvent("ziplist:toast", {
          detail: {
            message: "ZipList Passport unlocked",
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
  <div
    class="zl-modal-md zl-modal-contained modal-box relative"
    class:zl-passport-redeem={view === "redeem"}
  >
    <form method="dialog">
      <ModalCloseButton
        closeModal={handleClose}
        label="Close Passport modal"
        modalId="contributor_modal"
      />
    </form>

    <div
      class="zl-modal-scroll-area zl-passport-scroll min-h-0 space-y-3 overflow-y-auto overflow-x-hidden pb-1 pr-1 sm:space-y-3.5"
    >
      <div class="flex justify-center pt-0.5">
        <div
          class="animate-zl-pulse-slow zl-pitch-hero h-14 w-14 sm:h-16 sm:w-16"
        >
          <Mascot interactive={false} aura={false} float={false} />
        </div>
      </div>

      {#if $isContributor && view !== "redeem"}
        <!-- 1. Unlocked Passport Holder State -->
        <div class="space-y-1 text-center">
          <h3
            id="contributor_modal_title"
            class="whitespace-nowrap px-1 text-[clamp(1.15rem,5vw,1.55rem)] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-2xl"
          >
            {#if justSynced}
              🎉 Devices <span class="zl-marker">Linked!</span>
            {:else}
              Passport <span class="zl-marker">Ready</span>
            {/if}
          </h3>
          <p
            id="contributor_modal_description"
            class="px-2 text-xs font-bold leading-snug sm:text-sm"
            style:color="var(--zl-vibe-accent-text, #db2777)"
          >
            {#if justSynced}
              Lists stay in sync across screens.
            {:else if hasPasskey}
              Scan the QR stamp or tap the 4-word passkey to copy
            {:else}
              Enter the 4-word passkey below to link another device
            {/if}
          </p>
        </div>

        {#if vaultHash}
          <div class="flex flex-col items-center gap-1.5 py-1">
            <MembershipCard
              {vaultHash}
              {passportCode}
              passportPhrase={parsedPhrase}
            />
            {#if passportExpiryLabel}
              <p
                class="px-2 text-center text-[11px] font-black uppercase tracking-[0.08em]"
                style:color="var(--zl-vibe-accent-text, #db2777)"
              >
                {passportDaysLeft > 0
                  ? `Good until ${passportExpiryLabel}`
                  : `Lapsed ${passportExpiryLabel}`}
              </p>
            {/if}
          </div>
        {/if}

        <SyncPresence aloneLabel="Ready to link another device" />

        <div class="space-y-2.5 pt-1 text-center">
          {#if hasPasskey}
            <button
              type="button"
              class="zl-passport-gold-btn"
              on:click={toggleEmailForm}
              aria-expanded={showEmailForm}
            >
              {emailSent ? "Passport emailed" : "Email Passport"}
            </button>

            {#if showEmailForm}
              <form
                class="mx-auto flex max-w-sm flex-col gap-2 rounded-2xl border-2 border-[#1e1714] bg-[#fffef7] p-3 shadow-[3px_3px_0px_#1e1714]"
                on:submit|preventDefault={handleEmailPassport}
              >
                <label
                  for="passport-email-input"
                  class="text-left text-xs font-black text-[#1e1714]"
                >
                  Send Passport &amp; 4-word passkey by email
                </label>
                <div class="flex gap-1.5">
                  <input
                    id="passport-email-input"
                    bind:this={emailInputEl}
                    bind:value={emailInput}
                    type="email"
                    required
                    placeholder="name@example.com"
                    autocomplete="email"
                    class="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-[#1e1714] bg-[#fffdf5] px-3 py-2 text-xs font-bold text-[#1e1714] focus:border-[#1e1714] focus:outline-none focus:ring-0"
                  />
                  <button
                    type="submit"
                    disabled={isSendingEmail || !emailInput.trim()}
                    class="min-h-11 rounded-xl border-2 border-[#1e1714] bg-[#ffbe0b] px-3.5 py-2 text-xs font-black text-[#1e1714] shadow-[2px_2px_0px_#1e1714] transition hover:bg-[#ffd04a] active:bg-[#f2ac00] disabled:opacity-50"
                  >
                    {isSendingEmail ? "Sending..." : "Send"}
                  </button>
                </div>
                {#if emailError}
                  <p
                    class="text-left text-xs font-bold text-[#8f3a28]"
                    aria-live="polite"
                  >
                    {emailError}
                  </p>
                {/if}
              </form>
            {/if}

            <button
              type="button"
              class="min-h-11 w-full rounded-xl border-[1.5px] border-[#1e1714]/25 bg-[#f6efe2] px-4 py-2.5 text-sm font-extrabold text-[#1e1714] transition-colors hover:border-[#1e1714]/45 hover:bg-[#efe5d2] active:scale-[0.99]"
              aria-expanded={showWordsForm}
              on:click={toggleWordsForm}
            >
              Use a different passkey
            </button>
          {:else}
            <button
              type="button"
              class="min-h-12 w-full rounded-2xl border-2 border-[#1e1714] bg-[#ff5ca8] px-4 py-3 text-base font-black text-[#1e1714] shadow-[3px_3px_0_#1e1714] transition-all hover:-translate-y-0.5 hover:bg-[#ff459b] hover:shadow-[4px_4px_0_#1e1714] active:translate-y-0.5 active:bg-[#e62e84] active:shadow-[1px_1px_0_#1e1714]"
              aria-expanded={showWordsForm}
              on:click={toggleWordsForm}
            >
              Link 4-word passkey
            </button>
          {/if}

          {#if showWordsForm}
            <form
              class="mx-auto flex max-w-sm flex-col gap-2 rounded-2xl border-2 border-[#1e1714] bg-[#fffef7] p-3 shadow-[3px_3px_0px_#1e1714]"
              on:submit|preventDefault={handleWordsRestore}
            >
              <label
                for="passport-words-input"
                class="text-left text-xs font-black text-[#1e1714]"
              >
                4-word passkey from another device:
              </label>
              <div class="flex gap-1.5">
                <input
                  id="passport-words-input"
                  bind:this={wordsInputEl}
                  bind:value={wordsInput}
                  type="text"
                  autocapitalize="off"
                  autocorrect="off"
                  spellcheck="false"
                  placeholder="e.g. velvet octopus drifts by"
                  maxlength={MAX_PASSPORT_CODE_LENGTH}
                  class="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-[#1e1714] bg-[#fffdf5] px-3 py-2 text-xs font-bold text-[#1e1714] focus:border-[#1e1714] focus:outline-none focus:ring-0"
                />
                <button
                  type="submit"
                  disabled={wordsBusy || !wordsInput.trim()}
                  class="min-h-11 rounded-xl border-2 border-[#1e1714] bg-[#ff5ca8] px-3.5 py-2 text-xs font-black text-[#1e1714] shadow-[2px_2px_0px_#1e1714] transition hover:bg-[#ff459b] active:bg-[#e62e84] disabled:opacity-50"
                >
                  {wordsBusy ? "Checking..." : "Link"}
                </button>
              </div>
              {#if wordsError}
                <p
                  class="text-left text-xs font-bold text-[#8f3a28]"
                  aria-live="polite"
                >
                  {wordsError}
                </p>
              {/if}
            </form>
          {/if}

          {#if !hasPasskey && passportCode}
            <button
              type="button"
              class="zl-passport-gold-btn"
              on:click={toggleEmailForm}
              aria-expanded={showEmailForm}
            >
              {emailSent ? "Passport emailed" : "Email Passport"}
            </button>

            {#if showEmailForm}
              <form
                class="mx-auto flex max-w-sm flex-col gap-2 rounded-2xl border-2 border-[#1e1714] bg-[#fffef7] p-3 shadow-[3px_3px_0px_#1e1714]"
                on:submit|preventDefault={handleEmailPassport}
              >
                <label
                  for="passport-email-fallback-input"
                  class="text-left text-xs font-black text-[#1e1714]"
                >
                  Send Passport &amp; 4-word passkey by email
                </label>
                <div class="flex gap-1.5">
                  <input
                    id="passport-email-fallback-input"
                    bind:this={emailInputEl}
                    bind:value={emailInput}
                    type="email"
                    required
                    placeholder="name@example.com"
                    autocomplete="email"
                    class="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-[#1e1714] bg-[#fffdf5] px-3 py-2 text-xs font-bold text-[#1e1714] focus:border-[#1e1714] focus:outline-none focus:ring-0"
                  />
                  <button
                    type="submit"
                    disabled={isSendingEmail || !emailInput.trim()}
                    class="min-h-11 rounded-xl border-2 border-[#1e1714] bg-[#ffbe0b] px-3.5 py-2 text-xs font-black text-[#1e1714] shadow-[2px_2px_0px_#1e1714] transition hover:bg-[#ffd04a] active:bg-[#f2ac00] disabled:opacity-50"
                  >
                    {isSendingEmail ? "Sending..." : "Send"}
                  </button>
                </div>
                {#if emailError}
                  <p
                    class="text-left text-xs font-bold text-[#8f3a28]"
                    aria-live="polite"
                  >
                    {emailError}
                  </p>
                {/if}
              </form>
            {/if}
          {/if}

          <!-- Quiet device disconnect so no browser ever stays stuck on an old pass -->
          <div class="pt-1">
            {#if confirmingDisconnect}
              <div
                class="flex flex-wrap items-center justify-between gap-2 rounded-xl border-[1.5px] border-[#1e1714]/25 bg-[#fffef7] px-3 py-2 text-xs font-bold text-[#44403c]"
              >
                <span>Disconnect this browser? Local lists stay here.</span>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="rounded-lg border border-[#1e1714]/30 bg-[#f6efe2] px-2.5 py-1 text-xs font-extrabold text-[#1e1714] hover:bg-[#efe5d2]"
                    on:click={() => (confirmingDisconnect = false)}
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-[#1e1714] bg-amber-200 px-2.5 py-1 text-xs font-black text-[#1e1714] hover:bg-amber-300"
                    on:click={handleDisconnectPassport}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            {:else}
              <button
                type="button"
                class="text-xs font-bold text-[#525252] underline decoration-[#1e1714]/25 underline-offset-2 transition hover:text-[#1e1714]"
                on:click={() => (confirmingDisconnect = true)}
              >
                Disconnect this device
              </button>
            {/if}
          </div>
        </div>
      {:else if view === "redeem"}
        <!-- 2. Redeem State -->
        <div class="space-y-1.5 text-center">
          <h3
            id="contributor_modal_title"
            class="px-10 text-[1.55rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-3xl"
          >
            Enter a <span class="zl-marker">Passport Key</span>
          </h3>
          <p
            id="contributor_modal_description"
            class="text-sm font-bold leading-snug"
            style="color: var(--zl-vibe-accent-text, #db2777);"
          >
            Works with a 4-word passkey or sync link.
          </p>
        </div>

        <form
          class="zl-passport-code-form"
          on:submit|preventDefault={handleUnlock}
        >
          <label
            for="contributor-code-input"
            class="text-sm font-bold text-[#1e1714]"
          >
            4-word passkey
          </label>
          <input
            id="contributor-code-input"
            bind:this={codeInput}
            bind:value={code}
            type="text"
            placeholder="velvet octopus drifts by"
            class="zl-passport-code-input"
            aria-describedby="passport-code-hint"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            maxlength={MAX_PASSPORT_CODE_LENGTH}
          />

          {#if errorMessage}
            <p
              class="rounded-xl border-2 border-[#1e1714] bg-[#fffdf5] p-2.5 text-xs font-bold text-[#1e1714]"
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
            {isSubmitting ? "Checking key..." : "Unlock ZipList Passport"}
          </button>
          <p
            id="passport-code-hint"
            class="text-center text-xs leading-relaxed text-[#525252]"
          >
            Spaces, hyphens, or a pasted sync link all work.
          </p>
        </form>

        <button
          type="button"
          class="mx-auto flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-[#525252] transition hover:text-[#1e1714]"
          on:click={showPitch}
        >
          <span aria-hidden="true">←</span>
          <span>Back to ZipList Passport</span>
        </button>
      {:else}
        <!-- 3. Pitch Manifesto State -->
        <div class="space-y-1 px-10 text-center sm:px-4">
          <h3
            id="contributor_modal_title"
            class="text-[1.45rem] font-black leading-[1.15] tracking-tight text-[#1e1714] sm:text-2xl"
          >
            {CONTRIBUTOR_COPY.headline}
            <span class="zl-marker">{CONTRIBUTOR_COPY.headlineHighlight}</span>
          </h3>
          <p
            id="contributor_modal_description"
            class="text-xs font-bold tracking-tight sm:text-sm"
            style="color: var(--zl-vibe-accent-text, #db2777);"
          >
            {CONTRIBUTOR_COPY.tagline}
          </p>
          <p class="pt-1 text-sm font-black leading-tight text-[#1e1714]">
            {CONTRIBUTOR_COPY.priceHeadline}
            <span class="block pt-0.5 text-[11px] font-bold text-[#525252]">
              {CONTRIBUTOR_COPY.priceSuffix}
            </span>
          </p>
          {#if reasonNote}
            <p class="pt-2 text-xs font-bold leading-snug text-[#525252]">
              {reasonNote}
            </p>
          {/if}
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
            class="rounded-xl border-2 border-[#1e1714] bg-[#fffdf5] p-2.5 text-xs font-bold text-[#1e1714]"
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
            <span aria-hidden="true">✦</span>
            <span>
              {isStartingCheckout
                ? "Starting checkout..."
                : CONTRIBUTOR_COPY.ctaButton}
            </span>
          </button>
          <p
            class="text-center text-[11px] font-bold leading-snug text-[#525252]"
          >
            Passport arrives by email about a minute after payment. The address
            stays with it, so a reminder can find it before the year is up.
          </p>
        </div>

        <button
          type="button"
          class="zl-pitch-secondary zl-passport-code-link"
          on:click={showRedeem}
        >
          {CONTRIBUTOR_COPY.redeemButton}
        </button>

        <!-- The card is the tactile bonus, not a wall between value and cost. -->
        <div class="flex flex-col items-center gap-1.5 px-2 py-1 sm:px-4">
          <div class="w-full max-w-[310px]">
            <MembershipCard vaultHash={PREVIEW_VAULT_HASH} isPreview={true} />
          </div>
          <p class="text-center text-[11px] font-bold text-[#525252]">
            Card shuffles skins · Tilt to shine
          </p>
        </div>
      {/if}
    </div>
  </div>

  <button
    type="button"
    class="modal-backdrop"
    aria-label="Close Passport modal"
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
    --mascot-size-mobile: 56px;
    --mascot-size-sm: 64px;
    --mascot-size-md: 64px;
    --mascot-size-lg: 64px;
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

  /* One chunky action, gold like the Save pill. The card is the copy action. */
  .zl-passport-gold-btn {
    display: flex;
    width: 100%;
    min-height: 3rem;
    align-items: center;
    justify-content: center;
    border: 2px solid #1e1714;
    border-radius: 1rem;
    background: #ffbe0b;
    color: #1e1714;
    font-size: 1rem;
    font-weight: 900;
    letter-spacing: -0.01em;
    box-shadow: 3px 3px 0 #1e1714;
    transition:
      background-color 150ms ease,
      transform 150ms ease,
      box-shadow 150ms ease;
  }

  .zl-passport-gold-btn:hover {
    background: #ffd04a;
    transform: translateY(-1px);
    box-shadow: 4px 4px 0 #1e1714;
  }

  .zl-passport-gold-btn:active {
    background: #f2ac00;
    transform: translateY(1px);
    box-shadow: 1px 1px 0 #1e1714;
  }

  .zl-passport-gold-btn:focus-visible {
    outline: 2px solid #ff6ac2;
    outline-offset: 3px;
  }

  /* The Passport panel fits; if a short phone scrolls, no bar cuts the card. */
  .zl-passport-scroll {
    scrollbar-width: none;
    scrollbar-gutter: auto;
  }

  .zl-passport-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
