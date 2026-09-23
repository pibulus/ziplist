<script>
  import QRCode from "qrcode";
  import { ModalCloseButton } from "./index.js";
  import { Mascot } from "$lib/components/ui";
  import { soundService, hapticService } from "$lib/services/infrastructure";

  export let closeModal;
  export let shareUrl = "";
  export let title = "Scan QR Code";
  export let subtitle = "Scan with any phone camera to join";
  export let syncPhrase = "";
  export let isLive = false;

  let qrDataUrl = "";
  let qrError = false;
  let copied = false;
  let copyTimer = null;

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
        errorCorrectionLevel: "M",
      });
    } catch (err) {
      console.error("[QrShareModal] QR generation failed:", err);
      qrError = true;
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      soundService.copySuccess({ force: true });
      hapticService.selection();
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copied = false;
        copyTimer = null;
      }, 2200);
    } catch (err) {
      console.error("[QrShareModal] Copy failed:", err);
    }
  }

  function openInQrBuddy() {
    if (!shareUrl) return;
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
  class="modal modal-middle fixed z-50 overflow-hidden"
  style="overflow-y: hidden!important;"
  aria-labelledby="qr_modal_title"
  aria-modal="true"
>
  <div
    class="modal-box max-h-[85vh] max-w-sm overflow-y-auto rounded-3xl border-2 border-[#1e1714]/15 bg-gradient-to-br from-[#fffaef] to-[#fff6e6] p-6 text-center shadow-2xl"
  >
    <form method="dialog">
      <ModalCloseButton
        {closeModal}
        label="Close QR modal"
        modalId="qr_modal"
      />
    </form>

    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-center gap-2.5 pl-2 pr-8">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center">
          <Mascot interactive={false} aura={false} />
        </div>
        <h3
          id="qr_modal_title"
          class="text-left text-xl font-black tracking-tight text-[#1e1714]"
        >
          {title}
        </h3>
      </div>

      <p class="text-xs font-medium leading-relaxed text-[#1e1714]/70">
        {subtitle}
      </p>

      <!-- Sync Phrase Pill (if live) -->
      {#if syncPhrase}
        <div
          class="inline-flex items-center gap-1.5 rounded-full border border-pink-300 bg-pink-100/90 px-3 py-1 text-xs font-black text-pink-950 shadow-sm"
        >
          <span class="h-2 w-2 animate-pulse rounded-full bg-pink-500"></span>
          <span>Room:</span>
          <code class="font-mono">{syncPhrase}</code>
        </div>
      {/if}

      <!-- QR Card Container -->
      <div
        class="border-[#1e1714]/12 relative mx-auto flex h-64 w-64 items-center justify-center rounded-2xl border-2 bg-[#fffef7] p-3 shadow-[3px_3px_0px_rgba(30,23,20,0.08)]"
      >
        {#if qrDataUrl}
          <img
            src={qrDataUrl}
            alt="QR Code for {title}"
            class="h-full w-full rounded-lg object-contain"
          />
        {:else if qrError}
          <div class="p-4 text-xs font-bold text-rose-600">
            Could not generate QR code.
          </div>
        {:else}
          <div class="animate-pulse text-xs text-[#1e1714]/50">
            Generating QR code...
          </div>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col gap-2 pt-2">
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1e1714] px-4 py-2.5 text-xs font-black shadow-[2px_2px_0px_#1e1714] transition-all duration-150 active:scale-95 {copied
            ? 'bg-emerald-300 text-emerald-950'
            : 'bg-amber-300 text-[#1e1714] hover:bg-amber-400'}"
          on:click={copyLink}
        >
          {#if copied}
            <span aria-hidden="true">✓</span><span>Copied Link!</span>
          {:else}
            <span aria-hidden="true">📋</span><span>Copy Join Link</span>
          {/if}
        </button>

        <button
          type="button"
          class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#1e1714]/20 bg-[#fffef7]/80 px-3 py-2 text-xs font-bold text-[#1e1714]/80 transition-all duration-150 hover:border-[#1e1714]/50 hover:bg-pink-50/80 hover:text-[#1e1714]"
          on:click={openInQrBuddy}
          title="Open in QRBuddy to customize gradients and download high-res stickers"
        >
          <span aria-hidden="true">🎨</span><span>Open in QRBuddy</span>
          <span class="text-[10px] opacity-60">↗</span>
        </button>
      </div>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop bg-black/40 backdrop-blur-sm">
    <button on:click={closeModal}>close</button>
  </form>
</dialog>
