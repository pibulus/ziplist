<script>
  import { onMount } from "svelte";
  import { generateMemberIdentity } from "./identityUtils.js";
  import { hexToRgba, mixHex } from "./passportPalettes.js";
  import { buildPassportAvatar } from "./passportAvatar.js";
  import {
    selectSkin,
    selectNamedSkin,
    shuffleSkinSeed,
  } from "./passportSkins.js";
  import {
    buildDeviceSyncUrl,
    renderQrDataUrl,
  } from "$lib/services/qrHandshakeService.js";
  import { readStoredSupporterCode } from "$lib/services/vaultHashStorage.js";
  import { deviceSyncStore } from "$lib/services/realtime/deviceSyncStore.js";
  import Confetti from "$lib/components/ui/effects/Confetti.svelte";
  import { soundService } from "$lib/services/infrastructure/soundService.js";
  import { hapticService } from "$lib/services/infrastructure/hapticService.js";

  export let vaultHash = "";
  export let passportCode = "";
  // Optional: override private sync phrase; falls back to deviceSyncStore.privatePhrase
  export let privatePhrase = "";
  // Optional: force a named skin (e.g. 'hacker') for preview/dev.
  export let skinName = "";

  let storedPassportCode = "";
  let cardEl;
  let shuffleSeed = 0;
  let showTapBurst = false;
  let tapBurstKey = 0;
  // Pointer-driven holofoil state (0-100 across the card face).
  let mouseX = 50;
  let mouseY = 50;
  let isHovered = false;
  let qrHasLoaded = false;
  let qrHasFailed = false;
  let previousQrImageUrl = "";
  let passportQrImageUrl = "";

  // rAF throttle so we only touch the DOM once per frame while moving.
  let rafId = null;
  let pendingX = 50;
  let pendingY = 50;

  // Gyroscope (mobile tilt) state.
  let gyroSupported = false;
  let gyroEnabled = false;
  let removeGyroListener = null;
  let reducedMotion = false;

  const clamp = (value, min = 0, max = 100) =>
    Math.min(max, Math.max(min, value));

  $: if (cardEl)
    cardEl.style.setProperty("--hovered", isHovered || gyroEnabled ? "1" : "0");

  $: identity = generateMemberIdentity(vaultHash);
  $: hasVaultHash = !identity.isFallback;

  $: skin =
    shuffleSeed > 0
      ? shuffleSkinSeed(shuffleSeed)
      : skinName
        ? selectNamedSkin(skinName, vaultHash)
        : selectSkin(vaultHash);
  $: palette = skin.palette;
  $: avatarUri = buildPassportAvatar(vaultHash || "ziplist", skin.avatarStyle);

  // Dark-substrate frames (terminal) force light ink so text stays legible.
  $: isDarkSubstrate = skin.choices.frame === "terminal";
  $: inkColor = isDarkSubstrate ? "#e8fff0" : palette.ink;
  $: inkSoftColor = isDarkSubstrate
    ? "rgba(232, 255, 240, 0.66)"
    : palette.inkSoft;

  $: cardStyle = [
    `--p-bg-1: ${palette.bg[0]}`,
    `--p-bg-2: ${palette.bg[1]}`,
    `--p-bg-3: ${palette.bg[2] || palette.bg[1]}`,
    `--p-accent: ${palette.accent}`,
    `--p-ink: ${inkColor}`,
    `--p-ink-soft: ${inkSoftColor}`,
    `--p-glow: ${palette.glow}`,
    `--p-glow-16: ${hexToRgba(palette.glow, 0.16)}`,
    `--p-glow-20: ${hexToRgba(palette.glow, 0.2)}`,
    `--p-glow-22: ${hexToRgba(palette.glow, 0.22)}`,
    `--p-glow-24: ${hexToRgba(palette.glow, 0.24)}`,
    `--p-glow-28: ${hexToRgba(palette.glow, 0.28)}`,
    `--p-glow-32: ${hexToRgba(palette.glow, 0.32)}`,
    `--p-glow-38: ${hexToRgba(palette.glow, 0.38)}`,
    `--p-accent-18: ${hexToRgba(palette.accent, 0.18)}`,
    `--p-accent-22: ${hexToRgba(palette.accent, 0.22)}`,
    `--p-accent-40: ${hexToRgba(palette.accent, 0.4)}`,
    `--p-accent-w22: ${mixHex(palette.accent, 0.22)}`,
    `--p-accent-w42: ${mixHex(palette.accent, 0.42)}`,
    `--p-accent-w45: ${mixHex(palette.accent, 0.45)}`,
    `--p-accent-w86: ${mixHex(palette.accent, 0.86)}`,
    `--f-glow-38: ${hexToRgba(palette.glow, 0.38)}`,
    `--f-glow-20: ${hexToRgba(palette.glow, 0.2)}`,
    skin.varString,
  ].join("; ");

  $: effectivePassportCode = passportCode || storedPassportCode;
  $: effectivePrivatePhrase =
    privatePhrase || $deviceSyncStore.privatePhrase || "";
  $: passportSyncUrl =
    hasVaultHash && effectivePassportCode
      ? buildDeviceSyncUrl({
          code: effectivePassportCode,
          phrase: effectivePrivatePhrase,
        })
      : "";

  $: if (passportSyncUrl !== previousQrImageUrl) {
    previousQrImageUrl = passportSyncUrl;
    qrHasLoaded = false;
    qrHasFailed = false;
    if (passportSyncUrl) {
      renderQrDataUrl(passportSyncUrl, { size: 256 })
        .then((dataUrl) => {
          passportQrImageUrl = dataUrl;
        })
        .catch((error) => {
          console.warn("[MembershipCard] Local QR render failed:", error);
          passportQrImageUrl = "";
          qrHasFailed = true;
        });
    } else {
      passportQrImageUrl = "";
    }
  }

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
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    schedulePointer(
      ((e.clientX - rect.left) / rect.width) * 100,
      ((e.clientY - rect.top) / rect.height) * 100,
    );
  }

  function settleToCenter() {
    isHovered = false;
    schedulePointer(50, 50);
  }

  function handleOrientation(event) {
    const gamma = event.gamma ?? 0;
    const beta = event.beta ?? 0;
    schedulePointer(
      50 + clamp(gamma, -35, 35) * (50 / 35),
      50 + clamp(beta - 45, -35, 35) * (50 / 35),
    );
  }

  function attachGyro() {
    window.addEventListener("deviceorientation", handleOrientation, true);
    gyroEnabled = true;
    removeGyroListener = () =>
      window.removeEventListener("deviceorientation", handleOrientation, true);
  }

  async function enableGyro() {
    const evt =
      typeof DeviceOrientationEvent !== "undefined"
        ? DeviceOrientationEvent
        : null;
    if (!evt) return;
    try {
      if (typeof evt.requestPermission === "function") {
        const state = await evt.requestPermission();
        if (state !== "granted") return;
      }
      attachGyro();
    } catch (error) {
      console.warn("Passport tilt permission denied:", error);
    }
  }

  onMount(() => {
    storedPassportCode = readStoredSupporterCode();
    writePointerVars(50, 50);

    reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return cleanup;

    const hasMotion =
      typeof window !== "undefined" && "DeviceOrientationEvent" in window;
    const isTouch =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;
    gyroSupported = hasMotion && isTouch;

    const needsPermission =
      gyroSupported &&
      typeof DeviceOrientationEvent.requestPermission === "function";
    if (gyroSupported && !needsPermission) attachGyro();

    return cleanup;
  });

  function cleanup() {
    if (rafId !== null && typeof cancelAnimationFrame === "function")
      cancelAnimationFrame(rafId);
    if (removeGyroListener) removeGyroListener();
    if (squishTimer) clearTimeout(squishTimer);
    if (idCopiedTimer) clearTimeout(idCopiedTimer);
  }

  let isSquishing = false;
  let squishTimer = null;
  let idCopied = false;
  let idCopiedTimer = null;

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

  async function handleCopyCode(e) {
    if (e) e.stopPropagation();
    const toCopy = effectivePassportCode || identity.memberId;
    if (!toCopy) return;
    try {
      await navigator.clipboard.writeText(toCopy);
      idCopied = true;
      soundService?.play?.("bloom") || soundService?.copySuccess?.();
      hapticService?.notification?.("success") ||
        hapticService?.impact?.("medium");
      if (idCopiedTimer) clearTimeout(idCopiedTimer);
      idCopiedTimer = setTimeout(() => {
        idCopied = false;
      }, 2200);
    } catch (err) {
      console.warn("[MembershipCard] Copy failed:", err);
    }
  }

  function handleCardClick(e) {
    if (e.target && e.target.closest && e.target.closest(".passport-qr-stamp"))
      return;
    if (gyroSupported && !gyroEnabled) {
      void enableGyro();
    }
    cycleSkin();
  }
</script>

<div
  bind:this={cardEl}
  class="passport-card relative flex aspect-[1.586/1] w-full max-w-[342px] cursor-pointer select-none flex-col justify-between overflow-hidden p-5"
  class:is-placeholder={!hasVaultHash}
  class:is-squishing={isSquishing}
  class:reduced-motion={reducedMotion}
  style={cardStyle}
  role="button"
  tabindex="0"
  aria-label={hasVaultHash
    ? `ZipList contributor passport for ${identity.name}. Tap to cycle look.`
    : "ZipList contributor passport placeholder"}
  on:click={handleCardClick}
  on:keydown={(e) => (e.key === "Enter" || e.key === " ") && cycleSkin()}
  on:pointermove={handlePointerMove}
  on:pointerenter={() => (isHovered = true)}
  on:pointerleave={settleToCenter}
>
  <div class="passport-substrate pointer-events-none absolute inset-0"></div>
  <div class="passport-glow pointer-events-none absolute inset-0"></div>
  <div class="holofoil pointer-events-none absolute inset-0"></div>
  <div class="passport-glare pointer-events-none absolute inset-0"></div>
  <div class="passport-texture pointer-events-none absolute inset-0"></div>
  <div class="passport-laminate pointer-events-none absolute inset-0"></div>
  <div
    class="passport-pattern pointer-events-none absolute right-0 top-0 h-full w-28"
  ></div>
  <div class="passport-edge pointer-events-none absolute inset-0"></div>

  <div class="relative z-10 flex items-start justify-between gap-3">
    <div class="min-w-0">
      <h3 class="passport-kicker text-[11px] font-black uppercase">
        ZipList Passport
      </h3>
      <p class="passport-name mt-1 max-w-[190px] font-black">
        {identity.name}
      </p>
    </div>

    <!-- Avatar chip: DiceBear SVG with initials fallback -->
    <div
      class="avatar-chip grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl font-black"
      aria-hidden="true"
    >
      {#if avatarUri}
        <img
          src={avatarUri}
          alt=""
          class="avatar-img h-full w-full object-cover"
          draggable="false"
        />
      {:else}
        <span class="avatar-initials">{identity.initials}</span>
      {/if}
    </div>
  </div>

  <div class="relative z-10 flex items-end justify-between gap-4">
    <div
      class="passport-id-chip -mx-1.5 -my-1 min-w-0 rounded-lg p-1.5 transition-all duration-150 hover:bg-black/5 active:scale-95"
      on:click={handleCopyCode}
      on:keydown={(e) =>
        (e.key === "Enter" || e.key === " ") && handleCopyCode(e)}
      role="button"
      tabindex="0"
      title="Click to copy pass code"
      aria-label="Click to copy pass code"
    >
      <p
        class="passport-label flex items-center gap-1.5 text-[10px] font-bold uppercase"
      >
        <span>Passport ID</span>
        {#if idCopied}
          <span
            class="shadow-xs rounded bg-emerald-500/90 px-1 py-0.5 text-[9px] font-black text-white"
          >
            Copied! ✨
          </span>
        {:else}
          <span class="text-[9px] font-semibold lowercase opacity-60"
            >tap to copy</span
          >
        {/if}
      </p>
      <p
        class="passport-member-id mt-0.5 font-mono text-sm font-black tracking-normal"
      >
        {identity.memberId}
      </p>
      {#if hasVaultHash && identity.phrase}
        <p class="passport-phrase mt-0.5 italic">{identity.phrase}</p>
      {/if}
    </div>

    {#if passportQrImageUrl}
      <a
        class="passport-qr-stamp"
        class:is-loading={!qrHasLoaded && !qrHasFailed}
        class:is-fallback={qrHasFailed}
        href={passportSyncUrl}
        aria-label={`Open ZipList on another device with ${identity.memberId}`}
      >
        {#if !qrHasFailed}
          <img
            src={passportQrImageUrl}
            alt=""
            decoding="async"
            referrerpolicy="no-referrer"
            on:load={() => (qrHasLoaded = true)}
            on:error={() => {
              qrHasFailed = true;
              qrHasLoaded = false;
            }}
          />
        {/if}
        {#if qrHasFailed}
          <span class="passport-link-fallback" aria-hidden="true">
            <span class="fallback-word">SYNC</span>
          </span>
        {/if}
        <span class="qr-tap-hint" aria-hidden="true">tap to sync</span>
      </a>
    {:else}
      <div
        class="ghost-seal grid h-12 w-12 shrink-0 place-items-center rounded-full"
        aria-hidden="true"
      >
        <span class="text-xl">✦</span>
      </div>
    {/if}
  </div>
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

<style>
  .passport-card {
    --mx: 50%;
    --my: 50%;
    --pointer-x: 50%;
    --pointer-y: 50%;
    --bg-x: 50%;
    --bg-y: 50%;
    --from-center: 0;
    --hovered: 0;
    border-radius: var(--f-radius, 1.55rem);
    background:
      radial-gradient(
        circle at 12% 14%,
        rgba(255, 255, 255, 0.32),
        transparent 38%
      ),
      linear-gradient(
        135deg,
        var(--p-bg-1) 0%,
        var(--p-bg-2) 48%,
        var(--p-bg-3) 100%
      );
    border: var(--f-border, 2px solid rgba(255, 255, 255, 0.38));
    box-shadow: var(
      --f-shadow,
      0 24px 48px var(--f-glow-38),
      0 8px 18px var(--f-glow-20)
    );
    filter: var(--f-filter, none);
    font-family: var(--t-font, inherit);
    color: var(--p-ink);
    transform-origin: center;
    isolation: isolate;
  }

  .passport-card.is-placeholder {
    border-style: dashed;
    box-shadow: 0 14px 32px rgba(79, 70, 68, 0.08);
  }

  .passport-substrate {
    background: var(--f-substrate, transparent);
    border-radius: inherit;
  }

  .passport-glow {
    background:
      radial-gradient(
        circle at 18% 22%,
        rgba(255, 255, 255, 0.44),
        transparent 32%
      ),
      linear-gradient(
        115deg,
        transparent 0%,
        var(--p-glow-22) 46%,
        transparent 72%
      );
    mix-blend-mode: overlay;
    opacity: 0.52;
  }

  .holofoil {
    background: repeating-linear-gradient(
      var(--holo-angle, 110deg),
      var(--holo-c1) 0%,
      var(--holo-c2) 14%,
      var(--holo-c3) 28%,
      var(--holo-c4) 42%,
      var(--holo-c5) 56%,
      var(--holo-c6) 70%,
      var(--holo-c1) 84%
    );
    background-size: var(--holo-size, 400% 400%);
    background-position: var(--bg-x) var(--bg-y);
    mix-blend-mode: var(--holo-blend, color-dodge);
    filter: var(--holo-filter, brightness(0.9) contrast(1.4) saturate(1.6));
    -webkit-mask-image: radial-gradient(
      farthest-corner circle at var(--pointer-x) var(--pointer-y),
      rgba(0, 0, 0, 1) 0%,
      rgba(0, 0, 0, 0.85) 30%,
      rgba(0, 0, 0, 0.5) 65%,
      rgba(0, 0, 0, 0.28) 100%
    );
    mask-image: radial-gradient(
      farthest-corner circle at var(--pointer-x) var(--pointer-y),
      rgba(0, 0, 0, 1) 0%,
      rgba(0, 0, 0, 0.85) 30%,
      rgba(0, 0, 0, 0.5) 65%,
      rgba(0, 0, 0, 0.28) 100%
    );
    opacity: calc(
      var(--holo-rest, 0.26) + (var(--from-center) * var(--holo-bloom, 0.5)) +
        (var(--hovered) * 0.34)
    );
    transition: opacity 280ms ease;
    border-radius: inherit;
  }

  .passport-glare {
    background: radial-gradient(
      farthest-corner ellipse at var(--pointer-x) var(--pointer-y),
      rgba(255, 255, 255, 0.34) 0%,
      rgba(255, 255, 255, 0.12) 32%,
      transparent 68%
    );
    mix-blend-mode: soft-light;
    opacity: calc(0.18 + (var(--from-center) * 0.3) + (var(--hovered) * 0.28));
    transition: opacity 220ms ease;
    border-radius: inherit;
  }

  .passport-texture {
    background-image: var(--tx-image, none);
    background-size: var(--tx-size, auto);
    mix-blend-mode: var(--tx-blend, normal);
    opacity: var(--tx-opacity, 0);
    border-radius: inherit;
  }

  .passport-laminate {
    background:
      linear-gradient(
        118deg,
        transparent 5%,
        rgba(255, 255, 255, 0.34) 21%,
        transparent 38%
      ),
      linear-gradient(
        28deg,
        transparent 20%,
        rgba(255, 255, 255, 0.18) 48%,
        transparent 70%
      ),
      repeating-linear-gradient(
        118deg,
        rgba(255, 255, 255, 0) 0 18px,
        rgba(255, 255, 255, 0.18) 19px 20px,
        rgba(255, 255, 255, 0) 21px 38px
      );
    opacity: 0.54;
    mix-blend-mode: soft-light;
  }

  .passport-edge {
    border-radius: inherit;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.62),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.86);
  }

  .passport-kicker,
  .passport-label {
    letter-spacing: 0;
    color: var(--p-ink-soft);
  }

  .passport-phrase {
    font-size: 0.64rem;
    line-height: 1.3;
    color: var(--p-ink-soft);
    max-width: 160px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .passport-name {
    font-size: var(--t-name-size, 1.56rem);
    font-weight: var(--t-name-weight, 900);
    text-transform: var(--t-transform, none);
    letter-spacing: var(--t-tracking, 0);
    line-height: 1.08;
    overflow-wrap: break-word;
    color: var(--p-ink);
    text-shadow:
      0 1px 0 rgba(255, 255, 255, 0.28),
      0 8px 20px var(--p-glow-16);
    text-wrap: balance;
  }

  .passport-member-id {
    color: var(--p-ink);
  }

  .passport-pattern {
    background: repeating-linear-gradient(
      135deg,
      var(--p-accent-w86) 0 5px,
      rgba(255, 255, 255, 0.18) 5px 10px,
      rgba(255, 255, 255, 0.06) 10px 15px
    );
    clip-path: polygon(24% 0, 100% 0, 100% 100%, 0 100%);
    opacity: 0.72;
    filter: saturate(1.12);
  }

  .passport-card.is-placeholder .passport-pattern {
    opacity: 0.24;
  }

  .avatar-chip {
    background: rgba(255, 255, 255, 0.22);
    border: 2.5px solid rgba(255, 255, 255, 0.72);
    box-shadow:
      0 8px 20px var(--p-glow-32),
      0 2px 0 rgba(255, 255, 255, 0.52) inset;
  }

  .avatar-img {
    border-radius: inherit;
  }

  .avatar-initials {
    font-size: 1.1rem;
    font-weight: 900;
    color: var(--p-ink);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .ghost-seal {
    background: rgba(255, 255, 255, 0.22);
    border: 2px solid rgba(255, 255, 255, 0.52);
    box-shadow: 0 6px 14px var(--p-glow-24);
  }

  .passport-qr-stamp {
    display: grid;
    width: 5.1rem;
    height: 5.1rem;
    flex-shrink: 0;
    place-items: center;
    overflow: hidden;
    position: relative;
    margin: 0.15rem 0.15rem 0 0;
    rotate: -2deg;
    border-radius: 1.02rem;
    border: 2px solid rgba(255, 255, 255, 0.72);
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.88),
      rgba(255, 255, 255, 0.72)
    );
    padding: 0.2rem;
    box-shadow:
      0 13px 26px var(--p-glow-28),
      0 2px 0 rgba(255, 255, 255, 0.72) inset,
      inset 0 -1px 0 rgba(0, 0, 0, 0.06);
    transition:
      transform 150ms ease,
      box-shadow 150ms ease;
  }

  .passport-qr-stamp::before {
    content: "";
    position: absolute;
    inset: 0.28rem;
    border-radius: 0.74rem;
    background:
      linear-gradient(90deg, var(--p-accent-18), transparent 42%),
      repeating-linear-gradient(
        135deg,
        var(--p-accent-18) 0 3px,
        rgba(255, 255, 255, 0) 3px 7px
      );
    opacity: 0;
    transition: opacity 160ms ease;
    pointer-events: none;
  }

  .passport-qr-stamp.is-loading::before,
  .passport-qr-stamp.is-fallback::before {
    opacity: 1;
  }

  .passport-qr-stamp:hover,
  .passport-qr-stamp:focus-visible {
    transform: translateY(-1px) scale(1.02) rotate(1deg);
    box-shadow:
      0 16px 30px var(--p-glow-32),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    outline: none;
  }

  .passport-qr-stamp:focus-visible {
    box-shadow:
      0 0 0 3px var(--p-accent-40),
      0 10px 22px var(--p-glow-24);
  }

  .passport-qr-stamp img {
    position: relative;
    z-index: 1;
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 0.78rem;
    object-fit: cover;
  }

  .qr-tap-hint {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    z-index: 2;
    display: none;
    padding: 0.12rem 0;
    background: rgba(0, 0, 0, 0.46);
    color: #fff;
    font-size: 0.46rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
    pointer-events: none;
  }

  @media (hover: none) and (pointer: coarse) {
    .qr-tap-hint {
      display: block;
    }
  }

  .passport-link-fallback {
    position: relative;
    z-index: 1;
    display: grid;
    height: 100%;
    width: 100%;
    place-items: center;
    border-radius: 0.78rem;
    background:
      radial-gradient(
        circle at 30% 24%,
        rgba(255, 255, 255, 0.86),
        transparent 45%
      ),
      linear-gradient(135deg, rgba(255, 255, 255, 0.9), var(--p-accent-w22));
    color: var(--p-ink);
  }

  .fallback-word {
    font-size: 0.7rem;
    font-weight: 900;
    letter-spacing: 0;
    color: var(--p-ink);
  }

  @media (max-width: 360px) {
    .passport-card {
      padding: 1rem;
    }

    .passport-name {
      font-size: 1.3rem;
      line-height: 1.12;
    }

    .passport-qr-stamp {
      width: 3.55rem;
      height: 3.55rem;
      border-radius: 0.8rem;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .passport-card {
      animation: passportReveal 520ms cubic-bezier(0.16, 1.25, 0.3, 1) both;
    }

    .passport-card:not([style*="--hovered: 1"]) .holofoil {
      animation: foilDrift 7s ease-in-out infinite alternate;
    }
  }

  .passport-card:not(.is-placeholder) {
    will-change: transform;
    transition:
      transform 160ms ease,
      box-shadow 120ms ease;
    transform: perspective(620px) rotateX(calc((var(--my) - 50) * -0.36deg))
      rotateY(calc((var(--mx) - 50) * 0.36deg));
  }

  .passport-card:active {
    transform: perspective(620px) rotateX(calc((var(--my) - 50) * -0.36deg))
      rotateY(calc((var(--mx) - 50) * 0.36deg)) scale(0.92) !important;
    transition: transform 70ms cubic-bezier(0.34, 1.56, 0.64, 1) !important;
  }

  .passport-card.is-squishing:not(.reduced-motion) {
    animation: passportSquish 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes passportSquish {
    0% {
      transform: perspective(620px) scale(0.92)
        rotateX(calc((var(--my) - 50) * -0.36deg))
        rotateY(calc((var(--mx) - 50) * 0.36deg));
    }
    42% {
      transform: perspective(620px) scale(1.05)
        rotateX(calc((var(--my) - 50) * -0.36deg))
        rotateY(calc((var(--mx) - 50) * 0.36deg));
    }
    72% {
      transform: perspective(620px) scale(0.985)
        rotateX(calc((var(--my) - 50) * -0.36deg))
        rotateY(calc((var(--mx) - 50) * 0.36deg));
    }
    100% {
      transform: perspective(620px) scale(1)
        rotateX(calc((var(--my) - 50) * -0.36deg))
        rotateY(calc((var(--mx) - 50) * 0.36deg));
    }
  }

  .passport-card.reduced-motion:not(.is-placeholder) {
    will-change: auto;
    transform: perspective(620px);
  }

  @keyframes passportReveal {
    from {
      opacity: 0;
      transform: perspective(620px) translateY(14px) scale(0.92) rotate(-1.5deg);
    }
    to {
      opacity: 1;
      transform: perspective(620px) translateY(0) scale(1) rotate(0);
    }
  }

  @keyframes foilDrift {
    0% {
      background-position: 0% 35%;
    }
    100% {
      background-position: 100% 65%;
    }
  }
</style>
