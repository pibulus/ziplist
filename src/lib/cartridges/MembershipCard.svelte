<script>
  /**
   * ZipList's Passport card wrapper.
   *
   * Everything visual — markup, CSS, skins, palette, avatar, identity — comes
   * from `$lib/softstack-passport`. This file only owns Svelte state, events and
   * ZipList's adapters (sync URL, QR, clipboard, sound, haptics, confetti,
   * storage). Keep it that way: a visual change belongs in the shared module.
   */
  import { afterUpdate, onMount } from "svelte";
  import { generateMemberIdentity } from "$lib/softstack-passport/index.js";
  import {
    selectSkin,
    selectNamedSkin,
    shuffleSkinSeed,
  } from "$lib/softstack-passport/skins.js";
  import { renderMembershipCard } from "$lib/softstack-passport/card.html.js";
  import {
    buildPassportAvatar,
    clearCustomPassportAvatar,
    compressAvatarImageFile,
    readCustomPassportAvatar,
    saveCustomPassportAvatar,
  } from "$lib/softstack-passport/avatar.js";
  import "$lib/softstack-passport/card.css";
  import {
    buildDeviceSyncUrl,
    renderQrDataUrl,
  } from "$lib/services/qrHandshakeService.js";
  import { readStoredSupporterCode } from "$lib/services/vaultHashStorage.js";
  import { deviceSyncStore } from "$lib/services/realtime/deviceSyncStore.js";
  import Confetti from "$lib/components/ui/effects/Confetti.svelte";
  import { soundService } from "$lib/services/infrastructure/soundService.js";
  import { hapticService } from "$lib/services/infrastructure/hapticService.js";
  import { copyTextToClipboard } from "$lib/services/infrastructure/clipboard.js";

  export let vaultHash = "";
  export let passportCode = "";
  export let passportPhrase = "";
  // Optional: override private sync phrase; falls back to deviceSyncStore.privatePhrase
  export let privatePhrase = "";
  // Optional: force a named skin (e.g. 'hacker') for preview/dev.
  export let skinName = "";
  export let isPreview = false;

  const AVATAR_KEY = "ziplist_passport_custom_avatar_v1";

  let hostEl;
  let cardEl = null;
  let avatarInputEl = null;
  let storedPassportCode = "";
  let customAvatarUri = "";
  let shuffleSeed = 0;
  let showTapBurst = false;
  let tapBurstKey = 0;
  let reducedMotion = false;
  let isSquishing = false;
  let squishTimer = null;
  let idCopied = false;
  let idCopiedTimer = null;
  let revealed = false;
  let revealTimer = null;
  let showQr = false;
  let qrTimer = null;
  let passportQrImageUrl = "";
  let previousQrUrl = "";

  // Pointer-driven holofoil state (0-100 across the card face).
  let mouseX = 50;
  let mouseY = 50;
  let isHovered = false;
  let rafId = null;
  let pendingX = 50;
  let pendingY = 50;

  const clamp = (value, min = 0, max = 100) =>
    Math.min(max, Math.max(min, value));

  $: effectivePassportCode = passportCode || storedPassportCode;
  $: identity = generateMemberIdentity(vaultHash, effectivePassportCode, {
    phrase: passportPhrase,
  });
  $: hasVaultHash = !identity.isFallback;

  // One coordinate in the modular axis space, deterministic from the hash.
  $: skin =
    shuffleSeed > 0
      ? shuffleSkinSeed(shuffleSeed)
      : skinName
        ? selectNamedSkin(skinName, vaultHash)
        : selectSkin(vaultHash);
  $: avatarUri =
    (!isPreview && customAvatarUri) ||
    buildPassportAvatar(vaultHash || "ziplist", skin.avatarStyle);

  // The displayed passkey IS the code. Adding it as an implicit *second*
  // secret changes the room and strands devices paired before this card existed.
  $: resolvedPhrase = privatePhrase || $deviceSyncStore.privatePhrase || "";
  $: passportSyncUrl =
    !isPreview && hasVaultHash && (identity.phrase || effectivePassportCode)
      ? buildDeviceSyncUrl(
          identity.phrase || effectivePassportCode,
          resolvedPhrase,
        )
      : "";

  $: if (passportSyncUrl !== previousQrUrl) {
    previousQrUrl = passportSyncUrl;
    if (passportSyncUrl) {
      renderQrDataUrl(passportSyncUrl, { size: 256 })
        .then((dataUrl) => {
          passportQrImageUrl = dataUrl;
        })
        .catch((error) => {
          console.warn("[MembershipCard] Local QR render failed:", error);
          passportQrImageUrl = "";
        });
    } else {
      passportQrImageUrl = "";
    }
  }

  $: markup = renderMembershipCard({
    identity,
    skin,
    appName: "ZipList",
    isPreview,
    avatarUri,
    customAvatar: Boolean(customAvatarUri),
    qrUrl: passportSyncUrl,
    qrImageUrl: passportQrImageUrl,
    reducedMotion,
    revealed,
    showQr,
  });

  function writePointerVars(x, y) {
    if (!cardEl) return;
    const s = cardEl.style;
    s.setProperty("--mx", `${x}%`);
    s.setProperty("--my", `${y}%`);
    s.setProperty("--pointer-x", `${x}%`);
    s.setProperty("--pointer-y", `${y}%`);
    s.setProperty("--bg-x", `${50 + (x - 50) * 0.5}%`);
    s.setProperty("--bg-y", `${50 + (y - 50) * 0.5}%`);
    s.setProperty(
      "--from-center",
      `${clamp(Math.hypot(y - 50, x - 50) / 50, 0, 1)}`,
    );
  }

  function commitPointer() {
    rafId = null;
    mouseX = pendingX;
    mouseY = pendingY;
    writePointerVars(mouseX, mouseY);
  }

  function schedulePointer(x, y) {
    pendingX = clamp(x);
    pendingY = clamp(y);
    if (rafId === null && typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(commitPointer);
    }
  }

  function handlePointerMove(e) {
    if (!cardEl || reducedMotion || e.pointerType !== "mouse") return;
    const rect = cardEl.getBoundingClientRect();
    schedulePointer(
      ((e.clientX - rect.left) / rect.width) * 100,
      ((e.clientY - rect.top) / rect.height) * 100,
    );
  }

  function handlePointerEnter(e) {
    isHovered = !reducedMotion && e.pointerType === "mouse";
    if (cardEl) cardEl.style.setProperty("--hovered", isHovered ? "1" : "0");
  }

  function settleToCenter() {
    isHovered = false;
    if (cardEl) cardEl.style.setProperty("--hovered", "0");
    schedulePointer(50, 50);
  }

  function syncCard() {
    const next = hostEl?.querySelector(".passport-card") || null;
    if (next !== cardEl) {
      if (cardEl) {
        cardEl.removeEventListener("pointermove", handlePointerMove);
        cardEl.removeEventListener("pointerenter", handlePointerEnter);
        cardEl.removeEventListener("pointerleave", settleToCenter);
      }
      cardEl = next;
      if (cardEl) {
        cardEl.addEventListener("pointermove", handlePointerMove);
        cardEl.addEventListener("pointerenter", handlePointerEnter);
        cardEl.addEventListener("pointerleave", settleToCenter);
        writePointerVars(mouseX, mouseY);
      }
    }
    avatarInputEl = hostEl?.querySelector(".avatar-input") || null;
    if (cardEl) {
      cardEl.classList.toggle("is-squishing", isSquishing);
      cardEl.classList.toggle("is-copied", idCopied);
      cardEl.style.setProperty("--hovered", isHovered ? "1" : "0");
    }
  }

  afterUpdate(syncCard);

  // These two live outside the markup so copying/squishing never re-renders
  // the card. Svelte only schedules updates for template variables, hence the
  // explicit reactive statements.
  $: if (cardEl) cardEl.classList.toggle("is-copied", idCopied);
  $: if (cardEl) cardEl.classList.toggle("is-squishing", isSquishing);

  onMount(() => {
    storedPassportCode = readStoredSupporterCode();
    customAvatarUri = readCustomPassportAvatar(undefined, AVATAR_KEY);
    reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return cleanup;
  });

  function cleanup() {
    if (rafId !== null && typeof cancelAnimationFrame === "function")
      cancelAnimationFrame(rafId);
    if (squishTimer) clearTimeout(squishTimer);
    if (idCopiedTimer) clearTimeout(idCopiedTimer);
    if (revealTimer) clearTimeout(revealTimer);
    if (qrTimer) clearTimeout(qrTimer);
    if (cardEl) {
      cardEl.removeEventListener("pointermove", handlePointerMove);
      cardEl.removeEventListener("pointerenter", handlePointerEnter);
      cardEl.removeEventListener("pointerleave", settleToCenter);
    }
  }

  function cycleSkin() {
    shuffleSeed = (shuffleSeed + 1) % 50;
    soundService?.play?.("bloom") || soundService?.select?.();
    hapticService?.impact?.("light") || hapticService?.selection?.();
    tapBurstKey += 1;
    showTapBurst = true;
    isSquishing = true;
    if (squishTimer) clearTimeout(squishTimer);
    squishTimer = setTimeout(() => {
      isSquishing = false;
    }, 360);
  }

  async function handleCopyCode() {
    if (isPreview) return;
    const toCopy =
      identity.phrase || effectivePassportCode || identity.memberId;
    if (!toCopy) return;
    const success = await copyTextToClipboard(toCopy);
    if (success) {
      idCopied = true;
      soundService?.copySuccess?.({ force: true });
      hapticService?.notification?.("success") ||
        hapticService?.impact?.("medium");
      if (idCopiedTimer) clearTimeout(idCopiedTimer);
      idCopiedTimer = setTimeout(() => {
        idCopied = false;
      }, 2200);
      window.dispatchEvent(
        new CustomEvent("ziplist:toast", {
          detail: { message: "4-word passkey copied", type: "success" },
        }),
      );
    } else {
      soundService?.locked?.();
      window.dispatchEvent(
        new CustomEvent("ziplist:toast", {
          detail: {
            message: "Copy unavailable — select passkey manually",
            type: "warning",
          },
        }),
      );
    }
  }

  function handleAvatarClick() {
    if (isPreview) return;
    avatarInputEl?.click();
  }

  async function handleAvatarFileChange(input) {
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (!file) return;
    try {
      const dataUri = await compressAvatarImageFile(file, 128);
      customAvatarUri = saveCustomPassportAvatar(
        dataUri,
        undefined,
        AVATAR_KEY,
      );
      window.dispatchEvent(new CustomEvent("ziplist-passport-avatar-changed"));
      soundService?.play?.("bloom") || soundService?.select?.();
      hapticService?.impact?.("light") || hapticService?.selection?.();
    } catch (err) {
      console.warn("[MembershipCard] Custom avatar upload failed:", err);
    }
  }

  function handleResetAvatar() {
    clearCustomPassportAvatar(undefined, AVATAR_KEY);
    customAvatarUri = "";
    window.dispatchEvent(new CustomEvent("ziplist-passport-avatar-changed"));
    soundService?.play?.("bloom") || soundService?.select?.();
    hapticService?.impact?.("light") || hapticService?.selection?.();
  }

  function toggleReveal() {
    if (isPreview) return;
    revealed = !revealed;
    if (revealTimer) clearTimeout(revealTimer);
    if (revealed) {
      revealTimer = setTimeout(() => {
        revealed = false;
      }, 10000);
    }
  }

  function toggleQr() {
    if (isPreview) return;
    showQr = !showQr;
    if (qrTimer) clearTimeout(qrTimer);
    if (showQr) {
      qrTimer = setTimeout(() => {
        showQr = false;
      }, 60000);
    }
  }

  function handleClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".avatar-reset")) {
      e.stopPropagation();
      handleResetAvatar();
      return;
    }
    if (target.closest(".avatar-chip")) {
      e.stopPropagation();
      handleAvatarClick();
      return;
    }
    if (target.closest(".avatar-input")) return;
    if (target.closest("[data-passport-qr-toggle]")) {
      e.stopPropagation();
      toggleQr();
      return;
    }
    if (target.closest("[data-passport-reveal]")) {
      e.stopPropagation();
      toggleReveal();
      return;
    }
    // The QR stamp is an anchor when revealed; let it navigate.
    if (target.closest(".passport-qr-stamp")) return;
    if (target.closest(".passport-id-chip")) {
      e.stopPropagation();
      handleCopyCode();
      return;
    }
    cycleSkin();
  }

  function handleChange(e) {
    const target = e.target;
    if (target instanceof Element && target.matches(".avatar-input")) {
      handleAvatarFileChange(target);
    }
  }

  function handleKeydown(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.matches("[data-passport-qr-toggle]")) {
      e.preventDefault();
      toggleQr();
    } else if (target.matches("[data-passport-reveal]")) {
      e.preventDefault();
      toggleReveal();
    } else if (target.matches(".passport-id-chip")) {
      e.preventDefault();
      handleCopyCode();
    } else if (target.matches(".passport-card")) {
      e.preventDefault();
      cycleSkin();
    }
  }
</script>

<div
  bind:this={hostEl}
  style="display: contents"
  on:click={handleClick}
  on:change={handleChange}
  on:keydown={handleKeydown}
>
  {@html markup}
</div>

{#if showTapBurst}
  {#key tapBurstKey}
    <Confetti
      targetSelector={cardEl}
      kind="confetti"
      particleCount={14}
      duration={1200}
      on:complete={() => (showTapBurst = false)}
    />
  {/key}
{/if}
