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
  class="modal modal-middle overflow-hidden fixed z-50"
  style="overflow-y: hidden!important;"
  aria-labelledby="qr_modal_title"
  aria-modal="true"
>
  <div
    class="modal-box bg-gradient-to-br from-[#fffaef] to-[#fff6e6] shadow-2xl border-2 border-[#1e1714]/15 rounded-3xl overflow-y-auto max-h-[85vh] max-w-sm text-center p-6"
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
      <div class="flex items-center justify-center gap-2.5 pr-8 pl-2">
        <div class="w-8 h-8 shrink-0 flex items-center justify-center">
          <Mascot interactive={false} aura={false} />
        </div>
        <h3
          id="qr_modal_title"
          class="font-black text-xl text-[#1e1714] tracking-tight text-left"
        >
          {title}
        </h3>
      </div>

      <p class="text-xs text-[#1e1714]/70 leading-relaxed font-medium">
        {subtitle}
      </p>

      <!-- Sync Phrase Pill (if live) -->
      {#if syncPhrase}
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-100/90 border border-pink-300 text-pink-950 text-xs font-black shadow-sm">
          <span class="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
          <span>Room:</span>
          <code class="font-mono">{syncPhrase}</code>
        </div>
      {/if}

      <!-- QR Card Container -->
      <div class="relative mx-auto w-64 h-64 p-3 bg-[#fffef7] rounded-2xl border-2 border-[#1e1714]/12 shadow-[3px_3px_0px_rgba(30,23,20,0.08)] flex items-center justify-center">
        {#if qrDataUrl}
          <img
            src={qrDataUrl}
            alt="QR Code for {title}"
            class="w-full h-full object-contain rounded-lg"
          />
        {:else if qrError}
          <div class="text-xs text-rose-600 font-bold p-4">
            Could not generate QR code.
          </div>
        {:else}
          <div class="text-xs text-[#1e1714]/50 animate-pulse">
            Generating QR code...
          </div>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col gap-2 pt-2">
        <button
          type="button"
          class="w-full py-2.5 px-4 rounded-xl border-2 border-[#1e1714] font-black text-xs transition-all duration-150 active:scale-95 shadow-[2px_2px_0px_#1e1714] flex items-center justify-center gap-2 {copied
            ? 'bg-emerald-300 text-emerald-950'
            : 'bg-amber-300 text-[#1e1714] hover:bg-amber-400'}"
          on:click={copyLink}
        >
          {#if copied}
            <span>✓ Copied Link!</span>
          {:else}
            <span>📋 Copy Join Link</span>
          {/if}
        </button>

        <button
          type="button"
          class="w-full py-2 px-3 rounded-xl border border-[#1e1714]/20 bg-white/80 font-bold text-xs text-[#1e1714]/80 hover:text-[#1e1714] hover:border-[#1e1714]/50 hover:bg-pink-50/80 transition-all duration-150 flex items-center justify-center gap-1.5"
          on:click={openInQrBuddy}
          title="Open in QRBuddy to customize gradients and download high-res stickers"
        >
          <span>🎨 Open in QRBuddy</span>
          <span class="text-[10px] opacity-60">↗</span>
        </button>
      </div>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop bg-black/40 backdrop-blur-sm">
    <button on:click={closeModal}>close</button>
  </form>
</dialog>
