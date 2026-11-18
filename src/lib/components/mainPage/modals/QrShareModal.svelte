<script>
  import QRCode from "qrcode";
  import { theme } from "$lib";
  import { ModalCloseButton } from "./index.js";
  import ThemeMascot from "../settings/ThemeMascot.svelte";
  import {
    soundService,
    hapticService,
    copyTextToClipboard,
  } from "$lib/services/infrastructure";

  export let closeModal;
  export let shareUrl = "";
  export let title = "Scan QR Code";
  export let subtitle = "Scan with any phone camera to join";
  export let syncPhrase = "";
  export let isLive = false;
  export let onStartLive = null;

  let qrDataUrl = "";
  let qrError = false;
  let copied = false;
  let copyTimer = null;
  let phraseCopied = false;
  let phraseTimer = null;
  let isStartingLive = false;

  $: if (shareUrl) {
    generateQr(shareUrl);
  }

  async function generateQr(url) {
    if (!url) return;
    try {
      qrError = false;
      qrDataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: "#1e1714",
          light: "#fffef7",
        },
        errorCorrectionLevel: url.length > 800 ? "L" : "M",
      });
    } catch (err) {
      console.error("[QrShareModal] QR generation failed:", err);
      qrDataUrl = "";
      qrError = true;
    }
  }

  async function handleStartLiveForQr() {
    if (!onStartLive || isStartingLive) return;
    isStartingLive = true;
    try {
      await onStartLive();
    } finally {
      isStartingLive = false;
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    const success = await copyTextToClipboard(shareUrl);
    if (success) {
      copied = true;
      soundService.copySuccess({ force: true });
      hapticService.selection();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ziplist:toast", {
            detail: {
              message: isLive ? "Live link copied" : "List link copied",
              type: "success",
            },
          }),
        );
      }
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copied = false;
        copyTimer = null;
      }, 2200);
    } else {
      soundService.locked({ force: true });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ziplist:toast", {
            detail: {
              message: "Copy needs browser permission",
              type: "warning",
            },
          }),
        );
      }
    }
  }

  async function copyPhrase() {
    if (!syncPhrase) return;
    const success = await copyTextToClipboard(syncPhrase);
    if (success) {
      phraseCopied = true;
      soundService.copySuccess({ force: true });
      hapticService.selection();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ziplist:toast", {
            detail: {
              message: `Room words "${syncPhrase}" copied`,
              type: "success",
            },
          }),
        );
      }
      if (phraseTimer) clearTimeout(phraseTimer);
      phraseTimer = setTimeout(() => {
        phraseCopied = false;
        phraseTimer = null;
      }, 2200);
    } else {
      soundService.locked({ force: true });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ziplist:toast", {
            detail: {
              message: "Copy needs browser permission",
              type: "warning",
            },
          }),
        );
      }
    }
  }

  function openInQrBuddy() {
    if (!shareUrl || qrError) return;
    const style = isLive ? "candy" : "sunset";
    window.open(
      `https://qrbuddy.app/q?d=${encodeURIComponent(shareUrl)}&s=${style}`,
      "_blank",
      "noopener",
    );
    soundService.select();
  }
</script>

<dialog
  id="qr_modal"
  class="modal"
  aria-labelledby="qr_modal_title"
  aria-modal="true"
>
  <div class="zl-modal-sm zl-modal-contained modal-box relative text-center">
    <form method="dialog">
      <ModalCloseButton
        {closeModal}
        label="Close QR modal"
        modalId="qr_modal"
      />
    </form>

    <div
      class="zl-modal-scroll-area min-h-0 space-y-3 overflow-y-auto overflow-x-hidden pb-1 pr-1"
    >
      <!-- Header -->
      <div class="flex items-center justify-center gap-2.5 px-9 pt-0.5">
        <div class="qr-mascot-badge shrink-0" aria-hidden="true">
          <ThemeMascot theme={$theme} size="24px" />
        </div>
        <h3
          id="qr_modal_title"
          class="min-w-0 truncate text-center text-lg font-black tracking-tight text-[#1e1714] sm:text-xl"
        >
          {title}
        </h3>
      </div>

      <p class="px-2 text-xs font-bold leading-snug text-[#525252]">
        {subtitle}
      </p>

      <!-- Sync Phrase Pill (if live) -->
      {#if syncPhrase}
        <button
          type="button"
          class="group inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border-2 border-[#1e1714] bg-[#fbf1e4] px-3.5 py-1.5 text-xs font-black text-[#1e1714] shadow-[1.5px_1.5px_0px_#1e1714] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#f5ead8] hover:shadow-[2.5px_2.5px_0px_#1e1714] active:translate-y-0 active:shadow-none"
          on:click={copyPhrase}
          title="Tap to copy 4-word room code"
          aria-label="Room words {syncPhrase}. Tap to copy."
        >
          <span
            class="h-2 w-2 shrink-0 animate-pulse rounded-full"
            style:background="var(--zl-vibe-accent, #ff6ac2)"
          ></span>
          <code class="truncate font-mono text-xs">{syncPhrase}</code>
          {#if phraseCopied}
            <span class="ml-0.5 shrink-0 text-[11px] text-emerald-800">✓</span>
          {:else}
            <svg
              class="ml-0.5 h-3.5 w-3.5 shrink-0 opacity-65 transition-opacity group-hover:opacity-100"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path
                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              />
            </svg>
          {/if}
        </button>
      {/if}

      <!-- QR Card or Compact Fallback -->
      {#if qrError}
        <div
          class="mx-auto flex flex-col items-center gap-2.5 rounded-2xl border-2 border-[#1e1714] bg-[#fbf1e4] p-4 text-center shadow-[2px_2px_0px_#1e1714]"
        >
          <p class="text-sm font-black text-[#1e1714]">
            Too many items for a static QR
          </p>
          <p class="text-xs font-bold leading-snug text-[#525252]">
            Start a Live List to mint a short 4-word QR any camera scans
            instantly, or copy the link below.
          </p>
          {#if onStartLive && !isLive}
            <button
              type="button"
              disabled={isStartingLive}
              class="mt-0.5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1e1714] px-4 py-2.5 text-xs font-black text-[#1e1714] shadow-[2px_2px_0px_#1e1714] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#1e1714] active:translate-y-0 active:shadow-none disabled:opacity-60"
              style:background="var(--zl-cta-color, #ffb000)"
              on:click={handleStartLiveForQr}
            >
              <svg
                class="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
                <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
              </svg>
              <span>
                {isStartingLive ? "Starting Live List..." : "Start Live List"}
              </span>
            </button>
          {/if}
        </div>
      {:else}
        <div
          class="relative mx-auto flex h-60 w-60 items-center justify-center rounded-2xl border-2 border-[#1e1714] bg-[#fffef7] p-3 shadow-[3px_3px_0px_#1e1714] sm:h-64 sm:w-64"
        >
          {#if qrDataUrl}
            <img
              src={qrDataUrl}
              alt="QR Code for {title}"
              class="h-full w-full rounded-lg object-contain"
            />
          {:else}
            <div class="animate-pulse text-xs font-bold text-[#525252]">
              Drawing QR...
            </div>
          {/if}
        </div>
      {/if}

      <!-- Action Buttons -->
      <div class="flex flex-col gap-2 pt-1">
        <button
          type="button"
          class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1e1714] px-4 py-2.5 text-xs font-black text-[#1e1714] shadow-[2px_2px_0px_#1e1714] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#1e1714] active:translate-y-0 active:shadow-none {copied
            ? 'bg-emerald-300 text-emerald-950'
            : ''}"
          style:background={copied ? undefined : "var(--zl-cta-color, #ffb000)"}
          on:click={copyLink}
        >
          {#if copied}
            <span aria-hidden="true">✓</span>
            <span>Link Copied</span>
          {:else}
            <svg
              class="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
              />
              <path
                d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
              />
            </svg>
            <span>{isLive ? "Copy Live Link" : "Copy List Link"}</span>
          {/if}
        </button>

        {#if !qrError}
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[#1e1714] bg-[#fffef7] px-3 py-2 text-xs font-bold text-[#1e1714] shadow-[1.5px_1.5px_0px_#1e1714] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#fbf1e4] hover:shadow-[2.5px_2.5px_0px_#1e1714] active:translate-y-0 active:shadow-none"
            on:click={openInQrBuddy}
            title="Open in QRBuddy to style and download stickers"
          >
            <svg
              class="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.3"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path
                d="m17.5 14 .9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"
              />
            </svg>
            <span>Style in QRBuddy</span>
            <span class="text-[10px] opacity-65" aria-hidden="true">↗</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
  <button
    type="button"
    class="modal-backdrop"
    on:click={closeModal}
    on:keydown={(e) => e.key === "Enter" && closeModal()}
    aria-label="Close QR modal"
  ></button>
</dialog>

<style>
  .qr-mascot-badge {
    display: flex;
    width: 2.25rem;
    height: 2.25rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.75rem;
    border: 2px solid #1e1714;
    background: linear-gradient(
      145deg,
      #fffef7 0%,
      color-mix(in srgb, var(--zl-vibe-control-bg, #ffb000) 24%, #fbf1e4) 100%
    );
    box-shadow: 1.5px 1.5px 0 #1e1714;
  }
</style>
