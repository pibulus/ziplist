<script>
  import { onDestroy } from "svelte";
  import { listsStore } from "$lib/services/lists/listsStore";
  import { hapticService } from "$lib/services/infrastructure/hapticService";
  import { soundService } from "$lib/services/infrastructure/soundService";
  import SingleList from "./SingleList.svelte";

  // Subscribe to lists store
  let lists = [];
  let activeListId = null;

  const unsubscribe = listsStore.subscribe((state) => {
    lists = state.lists;
    activeListId = state.activeListId;
  });

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // ── Physics ─────────────────────────────────────────────────────────────
  // Hand-rolled because the feel lives in VELOCITY INJECTION and MODES:
  //  - spring mode: damped spring to a card (170/26, react-spring default),
  //    seeded with the finger's release velocity so a flick sails.
  //  - spin mode: a hard flick spins the carousel like a globe — pure
  //    friction decay, wrapping around the ends, ratchet haptic per card —
  //    until it slows enough to catch the nearest card, or a finger lands.
  // The track is CIRCULAR when there are 2+ lists: positions live on an
  // unbounded number line and each card renders at its congruent position
  // nearest the viewport (mod L), so there are no edges to hit.
  // Units: x in % of viewport width (x = -pos*100), v in %/s.
  const STIFFNESS = 170;
  const DAMPING = 26;
  const SETTLE_X = 0.05; // %
  const SETTLE_V = 0.5; // %/s
  const FLICK_VELOCITY = 0.4; // px/ms — commits a one-card flick
  const SPIN_VELOCITY = 1.6; // px/ms — throws the carousel into a spin
  const FRICTION_TAU = 0.8; // s — spin velocity e-folding time (glide length)
  const LAND_SPEED = 180; // %/s — below this, the spin catches a card
  const DISTANCE_COMMIT = 0.3; // fraction of width for slow drags

  let x = 0; // rendered offset (%; unbounded when wrapping)
  let v = 0; // velocity (%/s)
  let targetPos = 0; // resting card on the unbounded line (integer)
  let spinning = false; // friction mode (globe spin) vs spring mode
  let rafId = null;
  let lastTick = 0;
  let lastRatchet = 0; // last whole card position we ticked past mid-spin

  const mod = (n, m) => ((n % m) + m) % m;
  $: L = lists.length;
  $: wraps = L > 1;

  function currentPos() {
    return -x / 100;
  }

  function landOn(pos) {
    // Choosing the landing card is the moment of commitment: update the
    // store here so the dots + aria flip while the card settles in.
    targetPos = pos;
    spinning = false;
    const list = lists[mod(pos, L)];
    if (list && list.id !== activeListId) {
      listsStore.setActiveList(list.id);
      hapticService.impact("medium");
      soundService.select();
    }
  }

  function tick(now) {
    const dt = Math.min(32, now - lastTick) / 1000;
    lastTick = now;

    if (spinning) {
      // Globe mode: exponential friction, no destination yet.
      v *= Math.exp(-dt / FRICTION_TAU);
      x += v * dt;

      // Ratchet: a soft tick each time a card boundary flies past.
      const passed = Math.round(currentPos());
      if (passed !== lastRatchet) {
        lastRatchet = passed;
        hapticService.impact?.("light");
      }

      if (Math.abs(v) < LAND_SPEED) {
        // Slow enough to catch one — the next card in the direction of
        // travel (projected slightly ahead so it never reverses to land).
        landOn(Math.round(currentPos() - (v / 100) * 0.15));
      }
      rafId = requestAnimationFrame(tick);
      return;
    }

    const target = -targetPos * 100;
    const a = STIFFNESS * (target - x) - DAMPING * v;
    v += a * dt;
    x += v * dt;
    if (Math.abs(target - x) < SETTLE_X && Math.abs(v) < SETTLE_V) {
      x = target;
      v = 0;
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (!rafId) {
      lastTick = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }

  function springTo(pos, initialV = null) {
    targetPos = pos;
    spinning = false;
    if (initialV !== null) v = initialV;
    if (prefersReducedMotion) {
      x = -pos * 100;
      v = 0;
      return;
    }
    startLoop();
  }

  function startSpin(initialV) {
    if (prefersReducedMotion || !wraps) return false;
    spinning = true;
    // Cap the throw (~2.5 revolutions of a 3-list shelf) — keeps monster
    // flicks fun instead of interminable.
    v = Math.max(-2500, Math.min(2500, initialV));
    lastRatchet = Math.round(currentPos());
    startLoop();
    return true;
  }

  function stopFlight() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    spinning = false;
    v = 0;
  }

  // ── Gesture state ───────────────────────────────────────────────────────
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;
  let hasDirectionLock = false;
  let isHorizontalSwipe = false;
  let wasMidFlight = false;
  let samples = []; // recent {t, x(px)} for release velocity
  const SAMPLE_WINDOW_MS = 100;
  const SWIPE_IGNORE_SELECTOR =
    'input, textarea, select, a, label, [data-swipe-ignore="true"]';

  // External switches (dot taps, list created/deleted elsewhere): retarget
  // to the nearest congruent copy of that card — never the long way round.
  $: if (L > 0 && activeListId) {
    const index = lists.findIndex((l) => l.id === activeListId);
    if (index !== -1 && !isSwiping && !spinning) {
      if (mod(targetPos, L) !== index) {
        springTo(index + (wraps ? L * Math.round((targetPos - index) / L) : 0));
      }
    }
  }

  function pushSample(px) {
    const now = performance.now();
    samples.push({ t: now, x: px });
    while (samples.length && now - samples[0].t > SAMPLE_WINDOW_MS) {
      samples.shift();
    }
  }

  function releaseVelocity() {
    if (samples.length < 2) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    return dt > 0 ? (last.x - first.x) / dt : 0;
  }

  function handleTouchStart(e) {
    if (e.target.closest(SWIPE_IGNORE_SELECTOR)) {
      isSwiping = false;
      hasDirectionLock = false;
      isHorizontalSwipe = false;
      return;
    }

    // Interruptible: a finger mid-spin CATCHES the carousel — like putting
    // your finger on a spinning globe.
    wasMidFlight = rafId !== null;
    stopFlight();

    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    samples = [];
    pushSample(touchStartX);
    isSwiping = true;
    hasDirectionLock = false;
    isHorizontalSwipe = false;
  }

  function handleTouchMove(e) {
    if (!isSwiping) return;
    const touch = e.changedTouches[0];
    const diffX = touch.screenX - touchStartX;
    const diffY = touch.screenY - touchStartY;

    pushSample(touch.screenX);

    if (!hasDirectionLock) {
      if (Math.abs(diffX) < 8 && Math.abs(diffY) < 8) return;

      isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY) * 1.1;
      hasDirectionLock = true;

      if (!isHorizontalSwipe) {
        isSwiping = false;
        springTo(targetPos);
        return;
      }
    }

    if (!isHorizontalSwipe) return;

    e.preventDefault();

    const screenWidth = window.innerWidth;
    let percentShift = (diffX / screenWidth) * 100;

    // Only a single lonely list has edges — the circular track has none.
    if (!wraps) {
      const over = Math.abs(percentShift);
      percentShift = Math.sign(percentShift) * ((over * 0.5) / (1 + over / 40));
    }

    // Track the finger 1:1; physics take over on release.
    x = -targetPos * 100 + percentShift;
  }

  function handleTouchEnd(e) {
    if (!isSwiping && !isHorizontalSwipe) return;

    const endX = e.changedTouches[0].screenX;
    pushSample(endX);
    isSwiping = false;
    const handledSwipe = isHorizontalSwipe;
    hasDirectionLock = false;
    isHorizontalSwipe = false;

    if (!handledSwipe) {
      // A plain tap that caught a mid-flight carousel: land on the nearest
      // card — finger on the globe.
      if (wasMidFlight) {
        wasMidFlight = false;
        landOn(Math.round(currentPos()));
        startLoop();
      }
      return;
    }
    wasMidFlight = false;

    const screenWidth = window.innerWidth;
    const diffPx = endX - touchStartX;
    const velPxMs = releaseVelocity();
    const velPctS = (velPxMs / screenWidth) * 100 * 1000;

    // A real throw spins the globe.
    if (Math.abs(velPxMs) > SPIN_VELOCITY && startSpin(velPctS)) return;

    let next = targetPos;
    if (Math.abs(velPxMs) > FLICK_VELOCITY) {
      next = targetPos + (velPxMs < 0 ? 1 : -1);
    } else if (Math.abs(diffPx) > screenWidth * DISTANCE_COMMIT) {
      next = targetPos + (diffPx < 0 ? 1 : -1);
    }
    if (!wraps) next = Math.max(0, Math.min(L - 1, next));

    if (next !== targetPos) {
      landOn(next);
    }
    springTo(next, velPctS);
  }

  function handleTouchCancel() {
    isSwiping = false;
    hasDirectionLock = false;
    isHorizontalSwipe = false;
    wasMidFlight = false;
    springTo(targetPos);
  }

  function setActiveList(index) {
    if (index >= 0 && index < L) {
      const pos = wraps
        ? index + L * Math.round((targetPos - index) / L)
        : index;
      landOn(pos);
      springTo(pos);
    }
  }

  // Where each card renders: its congruent position nearest the viewport.
  // (With one list this is just the identity.)
  function slideX(i, xNow) {
    const p = i * 100 + xNow;
    if (!wraps) return p;
    const strip = L * 100;
    return p - strip * Math.round(p / strip);
  }

  // Micro-tilt: cards lean into the throw (capped ~1.3°) and stand upright
  // as the physics calm — tilt just reads velocity.
  $: tilt = prefersReducedMotion ? 0 : Math.max(-1.3, Math.min(1.3, v * 0.004));

  onDestroy(() => {
    stopFlight();
    unsubscribe();
  });
</script>

<div
  class="swipe-container"
  role="region"
  aria-label="Swipe between lists"
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
  on:touchcancel={handleTouchCancel}
>
  <div class="lists-wrapper" style="--tilt: {tilt}deg;">
    {#each lists as list, i (list.id)}
      {@const sx = slideX(i, x)}
      <div
        id="list-slide-{list.id}"
        class="list-slide"
        class:active={list.id === activeListId}
        inert={list.id !== activeListId}
        aria-hidden={list.id !== activeListId}
        style="--list-primary: {list.primaryColor}; --list-accent: {list.accentColor}; --list-glow: {list.glowColor}; --sx: {sx}%; --away: {Math.min(
          1,
          Math.abs(sx) / 100,
        )}"
      >
        <div class="list-content-wrapper">
          <SingleList listId={list.id} />
        </div>
      </div>
    {/each}
  </div>

  <!-- Pagination Indicators -->
  <div class="pagination-dots" role="navigation" aria-label="List picker">
    {#each lists as list, i}
      <button
        type="button"
        class="dot"
        class:active={list.id === activeListId}
        style="--dot-primary: {list.primaryColor}; --dot-accent: {list.accentColor}; --dot-glow: {list.glowColor}"
        on:click={() => setActiveList(i)}
        aria-label="Switch to {list.name}"
        aria-current={list.id === activeListId ? "true" : undefined}
        aria-controls="list-slide-{list.id}"
      ></button>
    {/each}
  </div>
</div>

<style>
  .swipe-container {
    width: 100%;
    max-width: 100%;
    overflow-x: clip;
    overflow-y: visible;
    position: relative;
    display: flex;
    flex-direction: column;
    touch-action: pan-y pinch-zoom;
  }

  /* All slides stack in one grid cell and place themselves via --sx (their
     wrapped position on the circular track) — the wrapper itself no longer
     translates, which is what lets the ends join up seamlessly. */
  .lists-wrapper {
    display: grid;
    width: 100%;
    max-width: 100%;
  }

  .list-slide {
    grid-area: 1 / 1;
    width: 100%;
    max-width: 100%;
    padding: 0 4px;
    box-sizing: border-box;
    opacity: calc(1 - 0.6 * var(--away, 1));
    transform: translateX(var(--sx, 0%))
      scale(calc(1 - 0.05 * var(--away, 1))) rotate(var(--tilt, 0deg));
    will-change: transform;
    pointer-events: none;
  }

  .list-slide.active {
    pointer-events: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .list-slide {
      transform: translateX(var(--sx, 0%));
    }
  }

  .list-content-wrapper {
    width: 100%;
    max-width: 600px; /* Match SingleList max-width */
    margin: 0 auto;
    height: 100%;
  }

  .pagination-dots {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin-top: 0.25rem;
    margin-bottom: 0;
  }

  .dot {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: transparent;
    border: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }

  .dot::before {
    content: "";
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: var(--dot-accent);
    opacity: 0.4;
    transition: all 0.22s linear(0, 0.5 15%, 1.15 40%, 0.97 65%, 1);
  }

  .dot.active {
    transform: none;
  }

  .dot.active::before {
    transform: scale(1.5);
    background-color: var(--dot-primary);
    opacity: 1;
    box-shadow:
      0 2px 8px var(--dot-glow),
      0 0 12px var(--dot-glow);
  }

  .dot:hover:not(.active)::before {
    opacity: 0.7;
    transform: scale(1.2);
  }
</style>
