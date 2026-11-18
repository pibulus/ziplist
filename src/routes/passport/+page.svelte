<script>
  import { onMount, tick } from "svelte";
  import { browser } from "$app/environment";
  import {
    getContributorTokenSnapshot,
    isContributor,
    setContributorStatus,
  } from "$lib";
  import { Mascot } from "$lib/components/ui";
  import MembershipCard from "$lib/components/ui/MembershipCard.svelte";
  import SyncPresence from "$lib/components/ui/SyncPresence.svelte";
  import Confetti from "$lib/components/ui/Confetti.svelte";
  import { parseFourWordPasskey } from "$lib/softstack-passport/identity.js";
  import {
    getVaultHash,
    readStoredSupporterCode,
    saveStoredSupporterCode,
  } from "$lib/services/vaultHashStorage.js";
  import { extractPairingInput } from "$lib/services/realtime/qrHandshakeService.js";
  import { deviceSyncStore } from "$lib/services/realtime/deviceSyncStore.js";
  import { soundService } from "$lib/services/infrastructure/soundService.js";
  import { hapticService } from "$lib/services/infrastructure/hapticService.js";

  const MAX_PASSPORT_CODE_LENGTH = 160;
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

  let status = "checking"; // "checking" | "manual" | "importing" | "ready"
  let passportCode = "";
  let vaultHash = "";
  let manualCode = "";
  let errorMessage = "";
  let showConfetti = false;
  let justSynced = false;

  let showWordsForm = false;
  let wordsInput = "";
  let wordsError = "";
  let wordsBusy = false;
  let wordsInputEl;

  let showEmailForm = false;
  let emailInput = "";
  let emailError = "";
  let isSendingEmail = false;
  let emailSent = false;
  let emailInputEl;

  let confirmingDisconnect = false;
  let passportExpiry = null;

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

  $: passportExpiryLabel = passportExpiry
    ? `${passportExpiry.getUTCDate()} ${MONTH_NAMES[passportExpiry.getUTCMonth()]} ${passportExpiry.getUTCFullYear()}`
    : "";
  $: passportDaysLeft = passportExpiry
    ? Math.ceil((passportExpiry.getTime() - Date.now()) / 86400000)
    : null;

  $: parsedPhrase = parseFourWordPasskey(passportCode)?.phrase || "";
  $: hasPasskey = Boolean(parsedPhrase);
  $: isUnlockedView = Boolean($isContributor || passportCode);

  function syncStoredPassport() {
    if (!browser) return;
    passportExpiry = readPassportExpiry();
    const stored = readStoredSupporterCode();
    passportCode = stored || "";
    const seed = stored || ($isContributor ? "contributor-active" : "");
    if (seed) {
      void getVaultHash(seed).then((h) => {
        vaultHash = h;
      });
      status = "ready";
    } else {
      vaultHash = "";
      status = "manual";
    }
  }

  async function redeemAndLink(rawInput) {
    const extracted = extractPairingInput(rawInput);
    const candidateCode = extracted?.code || rawInput.trim();
    const candidateSyncPhrase = extracted?.phrase || "";

    if (!candidateCode) {
      return {
        ok: false,
        error: "Enter a 4-word passkey to link this device.",
      };
    }

    const response = await fetch("/api/contributor/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: candidateCode }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.valid) {
      return {
        ok: false,
        error: payload.error || "Check the 4-word passkey and try once more.",
      };
    }

    const savedCode = saveStoredSupporterCode(
      payload.phrase || payload.code || candidateCode,
    );
    setContributorStatus(true, payload.token || null);
    if (candidateSyncPhrase) {
      deviceSyncStore.pairWithPhrase(candidateSyncPhrase);
    }
    passportCode = savedCode;
    passportExpiry = readPassportExpiry();
    vaultHash = await getVaultHash(savedCode);
    await deviceSyncStore.enableSync();
    window.history.replaceState({}, "", "/passport");
    return { ok: true };
  }

  async function importPassport(nextInput = manualCode) {
    errorMessage = "";
    const trimmed = nextInput.trim();
    if (!trimmed) {
      errorMessage = "Enter a 4-word passkey.";
      status = "manual";
      return;
    }

    status = "importing";
    try {
      const result = await redeemAndLink(trimmed);
      if (!result.ok) {
        status = passportCode ? "ready" : "manual";
        errorMessage = result.error;
        return;
      }

      manualCode = "";
      status = "ready";
      justSynced = true;
      showConfetti = true;
      soundService?.fanfare?.({ force: true });
      hapticService?.notification?.("success");
    } catch (error) {
      console.error("Passport import failed:", error);
      status = passportCode ? "ready" : "manual";
      errorMessage = "Check the connection and try once more.";
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
    } catch {
      wordsError = "Passkey check needs one more try in a moment.";
    } finally {
      wordsBusy = false;
    }
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

  async function handleEmailPassport() {
    if (!browser || isSendingEmail) return;
    const targetEmail = emailInput.trim();
    const targetCode = passportCode || readStoredSupporterCode();
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
    } catch {
      emailError =
        "Email delivery paused right now. Try once more in a moment.";
    } finally {
      isSendingEmail = false;
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
    status = "manual";
    soundService?.select?.();
  }

  onMount(() => {
    if (!browser) return;
    window.addEventListener("ziplist-passport-changed", syncStoredPassport);

    const rawHref = window.location.href;
    const incoming = extractPairingInput(rawHref);
    if (incoming?.code) {
      window.history.replaceState({}, "", "/passport");
      void importPassport(rawHref);
      return () =>
        window.removeEventListener(
          "ziplist-passport-changed",
          syncStoredPassport,
        );
    }

    syncStoredPassport();
    return () =>
      window.removeEventListener(
        "ziplist-passport-changed",
        syncStoredPassport,
      );
  });

  const passportStructuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "ZipList Passport — Sovereign 4-Word E2EE QR Sync",
        url: "https://ziplist.app/passport",
        image: "https://ziplist.app/og-card.png",
        description:
          "Zero-account end-to-end encrypted checklist sync across phone and computer using a 4-word passkey and holographic QR stamp (PBKDF2 + HKDF + AES-GCM-256).",
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web, iOS, Android, macOS, Windows, Linux",
        inLanguage: "en",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "29",
          priceCurrency: "AUD",
          description:
            "One-year ZipList Passport (A$29 for 365 days, zero auto-renewing subscription)",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "ZipList",
            item: "https://ziplist.app/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "ZipList Passport",
            item: "https://ziplist.app/passport",
          },
        ],
      },
    ],
  });
  const jsonLdScript =
    '<script type="application/ld+json">' +
    passportStructuredData +
    "</" +
    "script>";
</script>

<svelte:head>
  <title>ZipList Passport — 4-Word E2EE Device Sync | ZipList</title>
  <meta
    name="description"
    content="Link phone and computer checklists without an account. ZipList Passport uses a 4-word passkey and holographic QR stamp for end-to-end encrypted sync."
  />
  <link rel="canonical" href="https://ziplist.app/passport" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ZipList" />
  <meta
    property="og:title"
    content="ZipList Passport — 4-Word E2EE Device Sync"
  />
  <meta
    property="og:description"
    content="Link phone and computer checklists without an account using a 4-word passkey or holographic QR stamp."
  />
  <meta property="og:url" content="https://ziplist.app/passport" />
  <meta property="og:image" content="https://ziplist.app/og-card.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html jsonLdScript}
</svelte:head>

<main
  class="flex min-h-[100dvh] items-center justify-center bg-[#fffaef] px-4 py-8 text-[#1e1714] sm:px-6 sm:py-12"
>
  <div
    class="relative w-full max-w-md rounded-3xl border-2 border-[#1e1714] bg-[#fffdf5] p-5 text-center shadow-[4px_4px_0px_#1e1714] sm:p-6"
  >
    <!-- Squishy Close Button (returns to /) -->
    <a
      href="/"
      class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#1e1714] bg-[#ff5ca8] text-sm font-black text-[#1e1714] shadow-[1.5px_1.5px_0px_#1e1714] transition-all hover:bg-[#ff459b] active:scale-95"
      aria-label="Back to ZipList"
    >
      ✕
    </a>

    <!-- Mascot -->
    <div
      class="zl-passport-page-hero mx-auto mb-2 flex h-16 w-16 justify-center"
    >
      <Mascot interactive={false} aura={false} float={false} />
    </div>

    <!-- Title Header -->
    <div class="mb-4 space-y-1">
      <h1 class="text-2xl font-black tracking-tight text-[#1e1714] sm:text-3xl">
        {#if isUnlockedView}
          {#if justSynced}
            🎉 Device <span class="zl-marker">Linked!</span>
          {:else}
            Passport <span class="zl-marker">Ready</span>
          {/if}
        {:else}
          Connect <span class="zl-marker">Passport</span>
        {/if}
      </h1>
      <p class="text-xs font-bold text-[#525252] sm:text-sm">
        {#if isUnlockedView}
          {#if hasPasskey}
            Scan the QR stamp or tap the 4-word passkey on the card to link
            another device.
          {:else}
            Enter the 4-word passkey below to link another device.
          {/if}
        {:else}
          Scan the QR stamp on another screen or enter the 4-word passkey below.
        {/if}
      </p>
    </div>

    {#if isUnlockedView && vaultHash}
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

      <div class="mt-2">
        <SyncPresence aloneLabel="Ready to link another device" />
      </div>

      <div class="mt-3 space-y-2.5 text-center">
        {#if hasPasskey}
          <button
            type="button"
            class="min-h-12 w-full rounded-xl border-2 border-[#1e1714] bg-[#ffbe0b] px-4 py-3 text-sm font-black text-[#1e1714] shadow-[3px_3px_0_#1e1714] transition-all hover:-translate-y-0.5 hover:bg-[#ffd04a] hover:shadow-[4px_4px_0_#1e1714] active:translate-y-0.5 active:bg-[#f2ac00] active:shadow-[1px_1px_0_#1e1714]"
            on:click={toggleEmailForm}
            aria-expanded={showEmailForm}
          >
            {emailSent ? "Passport emailed" : "Email Passport"}
          </button>

          {#if showEmailForm}
            <form
              class="flex w-full flex-col gap-2 rounded-2xl border-2 border-[#1e1714] bg-[#fffef7] p-3 shadow-[3px_3px_0px_#1e1714]"
              on:submit|preventDefault={handleEmailPassport}
            >
              <label
                for="page-passport-email-input"
                class="text-left text-xs font-black text-[#1e1714]"
              >
                Send Passport card &amp; 4-word passkey (never stored):
              </label>
              <div class="flex gap-1.5">
                <input
                  id="page-passport-email-input"
                  bind:this={emailInputEl}
                  bind:value={emailInput}
                  type="email"
                  required
                  placeholder="name@example.com"
                  autocomplete="email"
                  class="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-[#1e1714] bg-[#fffef7] px-3 py-2 text-xs font-bold text-[#1e1714] focus:outline-none"
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
            class="min-h-12 w-full rounded-xl border-2 border-[#1e1714] bg-[#ff5ca8] px-4 py-3 text-sm font-black text-[#1e1714] shadow-[3px_3px_0_#1e1714] transition-all hover:-translate-y-0.5 hover:bg-[#ff459b] hover:shadow-[4px_4px_0_#1e1714] active:translate-y-0.5 active:bg-[#e62e84] active:shadow-[1px_1px_0_#1e1714]"
            aria-expanded={showWordsForm}
            on:click={toggleWordsForm}
          >
            Link 4-word passkey
          </button>
        {/if}

        {#if showWordsForm}
          <form
            class="flex w-full flex-col gap-2 rounded-2xl border-2 border-[#1e1714] bg-[#fffef7] p-3 shadow-[3px_3px_0px_#1e1714]"
            on:submit|preventDefault={handleWordsRestore}
          >
            <label
              for="page-passport-words-input"
              class="text-left text-xs font-black text-[#1e1714]"
            >
              4-word passkey from another device:
            </label>
            <div class="flex gap-1.5">
              <input
                id="page-passport-words-input"
                bind:this={wordsInputEl}
                bind:value={wordsInput}
                type="text"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                maxlength={MAX_PASSPORT_CODE_LENGTH}
                placeholder="e.g. velvet octopus drifts by"
                class="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-[#1e1714] bg-[#fffef7] px-3 py-2 text-xs font-bold text-[#1e1714] focus:outline-none"
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
    {:else}
      <!-- Unconnected / Empty state -->
      <div class="mt-2 text-left">
        <form
          class="space-y-3"
          on:submit|preventDefault={() => importPassport(manualCode)}
        >
          <div>
            <label
              for="passport_code_input"
              class="mb-1 block text-xs font-black uppercase tracking-wider text-[#374151]"
            >
              4-Word Passkey
            </label>
            <input
              id="passport_code_input"
              type="text"
              class="min-h-11 w-full rounded-xl border-2 border-[#1e1714] bg-[#fffef7] px-4 font-mono text-sm font-bold text-[#1e1714] shadow-[1.5px_1.5px_0px_#1e1714] outline-none transition-all placeholder:text-[#78716c] focus:border-[#ff5ca8] focus:ring-2 focus:ring-pink-200"
              placeholder="e.g. velvet octopus drifts by"
              bind:value={manualCode}
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              maxlength={MAX_PASSPORT_CODE_LENGTH}
            />
          </div>

          <button
            type="submit"
            class="min-h-12 w-full rounded-xl border-2 border-[#1e1714] bg-[#ff5ca8] px-4 py-3 text-sm font-black text-[#1e1714] shadow-[3px_3px_0px_#1e1714] transition-all hover:-translate-y-0.5 hover:bg-[#ff459b] hover:shadow-[4px_4px_0px_#1e1714] active:translate-y-0.5 active:bg-[#e62e84] active:shadow-[1px_1px_0px_#1e1714] disabled:opacity-60"
            disabled={status === "importing" || !manualCode.trim()}
          >
            {status === "importing"
              ? "Linking device..."
              : "Link This Device ✦"}
          </button>
        </form>

        <div class="mt-4 border-t border-[#1e1714]/10 pt-3 text-center">
          <p class="text-xs font-bold leading-relaxed text-[#525252]">
            Open <strong>Options → Passport</strong> on the other device to read the
            4-word passkey or scan its QR stamp.
          </p>
        </div>
      </div>
    {/if}

    {#if errorMessage}
      <p
        class="mt-3 rounded-xl border-2 border-[#1e1714] bg-[#fffef7] p-2.5 text-xs font-black text-[#8f3a28]"
        aria-live="polite"
      >
        {errorMessage}
      </p>
    {/if}

    <nav
      aria-label="ZipList navigation"
      class="mt-5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 border-t border-[#1e1714]/10 pt-3 text-[11px] font-bold text-[#525252]"
    >
      <a href="/" class="hover:text-[#1e1714] hover:underline">Lists</a>
      <span aria-hidden="true">·</span>
      <a href="/about" class="hover:text-[#1e1714] hover:underline">About</a>
      <span aria-hidden="true">·</span>
      <a
        href="/privacy.html"
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-[#1e1714] hover:underline">Privacy</a
      >
    </nav>
  </div>

  {#if showConfetti}
    <Confetti duration={2200} on:complete={() => (showConfetti = false)} />
  {/if}
</main>

<style>
  .zl-passport-page-hero :global(.mascot) {
    --mascot-size-mobile: 64px;
    --mascot-size-sm: 64px;
    --mascot-size-md: 64px;
    --mascot-size-lg: 64px;
    --mascot-ink-pad: 0%;
    width: 64px;
    height: 64px;
    margin-bottom: 0;
  }
</style>
