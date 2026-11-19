<script>
  import { onMount, onDestroy } from "svelte";
  import { installMomentTick } from "$lib/services/pwa/installMoments.js";
  import { getInAppBrowserName } from "$lib/services/audio/inAppBrowser.js";

  // A quiet corner suggestion after two useful moments; three asks max,
  // four days apart, and never before an actual install path exists.

  export let appName = "ZipList";
  export let tagline = "";
  export let iconSrc = "/icons/icon-192x192.png";
  /** localStorage key prefix, e.g. "ziplist" */
  export let storagePrefix = "ziplist";

  const K = {
    MOMENTS: `${storagePrefix}-pwa-moments`,
    ASKS: `${storagePrefix}-pwa-asks`,
    LAST_ASK: `${storagePrefix}-pwa-last-ask`,
    INSTALLED: `${storagePrefix}-pwa-installed`,
  };

  const MOMENTS_TO_EARN = 2; // two successful uses before we ever ask
  const MAX_ASKS = 3; // then never again
  const COOLDOWN_DAYS = 4;
  const SETTLE_MS = 2500; // let the "done" moment land before appearing

  let visible = false;
  let closing = false;
  let installEvent = null;
  let isIOS = false;
  let showTimer = null;
  let closeTimer = null;
  let unsubMoment = null;

  const num = (k) => {
    try {
      return parseInt(localStorage.getItem(k) || "0", 10);
    } catch {
      return 0;
    }
  };
  const set = (k, v) => {
    try {
      localStorage.setItem(k, String(v));
    } catch {
      /* ignore */
    }
  };

  function isStandalone() {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      navigator.standalone === true ||
      document.referrer?.startsWith("android-app://")
    );
  }

  function canAsk() {
    try {
      if (localStorage.getItem(K.INSTALLED) === "true") return false;
      if (isStandalone()) return false;
      if (getInAppBrowserName()) return false;
      if (num(K.MOMENTS) < MOMENTS_TO_EARN) return false;
      if (num(K.ASKS) >= MAX_ASKS) return false;
      const last = localStorage.getItem(K.LAST_ASK);
      const days = last
        ? (Date.now() - new Date(last).getTime()) / 86400000
        : 999;
      if (days < COOLDOWN_DAYS) return false;
      // Only appear when we have a real path to offer: the native prompt,
      // or iOS (where Share → Add to Home Screen instructions ARE the path).
      return !!installEvent || isIOS;
    } catch {
      return false;
    }
  }

  function maybeShow() {
    if (visible || closing || !canAsk()) return;
    clearTimeout(showTimer);
    // Let the success moment (confetti, download chime) finish first.
    showTimer = setTimeout(() => {
      if (!canAsk()) return;
      visible = true;
      set(K.ASKS, num(K.ASKS) + 1);
      set(K.LAST_ASK, new Date().toISOString());
    }, SETTLE_MS);
  }

  function dismiss() {
    if (closing || !visible) return;
    closing = true;
    // Matches the 180ms pop-out in this file's <style> (modal DNA timing).
    closeTimer = setTimeout(() => {
      visible = false;
      closing = false;
    }, 180);
  }

  async function handleInstall() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = installEvent.userChoice
        ? await installEvent.userChoice
        : null;
      if (choice?.outcome === "accepted") set(K.INSTALLED, "true");
    } catch {
      /* the card's iOS-style fallback isn't useful here; just close */
    }
    installEvent = null;
    dismiss();
  }

  function onBeforeInstall(e) {
    e.preventDefault();
    installEvent = e;
    maybeShow();
  }

  onMount(() => {
    const ua = navigator.userAgent.toLowerCase();
    isIOS =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Each notePwaMoment() bumps the counter; crossing the threshold arms us.
    unsubMoment = installMomentTick.subscribe((n) => {
      if (n === 0) return; // initial subscription, not a real moment
      set(K.MOMENTS, num(K.MOMENTS) + 1);
      maybeShow();
    });
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    }
    clearTimeout(showTimer);
    clearTimeout(closeTimer);
    unsubMoment?.();
  });
</script>

{#if visible}
  <aside
    class="pwa-card"
    class:closing
    aria-label="Add {appName} to home screen"
  >
    <button
      type="button"
      class="pwa-dismiss"
      on:click={dismiss}
      aria-label="Dismiss"
    >
      ✕
    </button>

    <div class="pwa-head">
      <img class="pwa-icon" src={iconSrc} alt="" width="44" height="44" />
      <div class="pwa-titles">
        <p class="pwa-title">Keep {appName} handy</p>
        {#if tagline}<p class="pwa-tagline">{tagline}</p>{/if}
      </div>
    </div>

    {#if isIOS}
      <ol class="pwa-steps">
        <li><span class="pwa-step-n">1</span> Tap the Share button</li>
        <li>
          <span class="pwa-step-n">2</span> Choose <b>Add to Home Screen</b>
        </li>
      </ol>
      <button type="button" class="pwa-cta ghost" on:click={dismiss}>
        Got it
      </button>
    {:else}
      <p class="pwa-line">
        Opens straight from the home screen and works offline.
      </p>
      <button type="button" class="pwa-cta" on:click={handleInstall}>
        Add to home screen
      </button>
    {/if}
  </aside>
{/if}

<style>
  /* Soft Neo Toybrut surface, floats clear of the fixed footer. */
  .pwa-card {
    position: fixed;
    right: 1rem;
    bottom: 5.5rem;
    z-index: 900; /* under modals (9999), over page content */
    width: min(20rem, calc(100vw - 2rem));
    padding: 1rem 1rem 0.9rem;
    border: 2px solid #1e1714;
    border-radius: 18px;
    background: var(--zl-card-bg, #fffdf5);
    color: var(--zl-text-color-primary, #1e1714);
    box-shadow: 4px 4px 0 #1e1714;
    /* Modal DNA physics: rise with one small overshoot, no rotation. */
    animation: pwa-pop-in 280ms cubic-bezier(0.16, 0.84, 0.24, 1.06) both;
  }
  .pwa-card.closing {
    animation: pwa-pop-out 180ms cubic-bezier(0.4, 0, 0.24, 1) forwards;
    pointer-events: none;
  }

  .pwa-dismiss {
    position: absolute;
    top: 0.45rem;
    right: 0.45rem;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1.5px solid #1e1714;
    background: #fbf1e4;
    font-size: 0.72rem;
    font-weight: 900;
    line-height: 1;
    color: #1e1714;
    cursor: pointer;
    transition:
      background 0.15s ease,
      transform 0.22s linear(0, 0.5 15%, 1.15 40%, 0.97 65%, 1);
  }
  .pwa-dismiss:hover {
    background: #f3e4cf;
    transform: scale(1.08);
  }
  .pwa-dismiss:active {
    transform: scale(0.9);
  }
  @media (pointer: coarse) {
    .pwa-dismiss {
      width: 34px;
      height: 34px;
    }
  }

  .pwa-head {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin-bottom: 0.55rem;
    padding-right: 2rem;
  }
  .pwa-icon {
    width: 44px;
    height: 44px;
    border-radius: 11px;
    border: 1.5px solid #1e1714;
  }
  .pwa-title {
    font-size: 0.95rem;
    font-weight: 900;
    letter-spacing: -0.01em;
  }
  .pwa-tagline {
    font-size: 0.75rem;
    opacity: 0.72;
    margin-top: 0.1rem;
  }

  .pwa-line {
    font-size: 0.8rem;
    line-height: 1.45;
    opacity: 0.82;
    margin-bottom: 0.7rem;
  }

  .pwa-steps {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin: 0 0 0.7rem;
    padding: 0.6rem 0.7rem;
    list-style: none;
    font-size: 0.8rem;
    border-radius: 12px;
    border: 1.5px solid rgba(30, 23, 20, 0.16);
    background: #fbf1e4;
  }
  .pwa-steps li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .pwa-step-n {
    display: inline-flex;
    width: 20px;
    height: 20px;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 999px;
    border: 1.5px solid #1e1714;
    background: #fffef7;
    font-size: 0.7rem;
    font-weight: 900;
  }

  .pwa-cta {
    width: 100%;
    min-height: 44px;
    padding: 0.55rem 0.9rem;
    border-radius: 12px;
    border: 2px solid #1e1714;
    font-size: 0.85rem;
    font-weight: 900;
    color: #1e1714;
    background: var(--zl-cta-color, #ffb000);
    box-shadow: 2.5px 2.5px 0 #1e1714;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }
  .pwa-cta:hover {
    transform: translateY(-1px);
    box-shadow: 3.5px 3.5px 0 #1e1714;
  }
  .pwa-cta:active {
    transform: translateY(1px);
    box-shadow: 1px 1px 0 #1e1714;
  }
  .pwa-cta.ghost {
    color: #1e1714;
    background: #fbf1e4;
    box-shadow: 2px 2px 0 #1e1714;
  }

  /* Phones: full-width strip above the footer, safe-area aware. */
  @media (max-width: 480px) {
    .pwa-card {
      right: 0.75rem;
      left: 0.75rem;
      width: auto;
      bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
    }
  }

  @keyframes pwa-pop-in {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @keyframes pwa-pop-out {
    from {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    to {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pwa-card,
    .pwa-card.closing {
      animation: none;
    }
    .pwa-dismiss:hover,
    .pwa-cta:hover,
    .pwa-cta:active {
      transform: none;
    }
  }
</style>
