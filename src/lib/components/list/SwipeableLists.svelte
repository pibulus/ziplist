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

  // ── Spring physics ──────────────────────────────────────────────────────
  // A hand-rolled damped spring instead of svelte/motion because the feel
  // lives in VELOCITY INJECTION: the finger's release velocity becomes the
  // spring's initial velocity, so a flick sails and settles instead of
  // dying at release and re-accelerating from rest (svelte's spring can't
  // take an initial velocity). Units: x in % of viewport width, v in %/s.
  // 170/26 is the react-spring "default" — a whisker of overshoot, ~400ms.
  const STIFFNESS = 170;
  const DAMPING = 26;
  const SETTLE_X = 0.05; // %
  const SETTLE_V = 0.5; // %/s

  let x = 0; // rendered position (% — 0, -100, -200…)
  let v = 0; // spring velocity (%/s)
  let target = 0;
  let rafId = null;
  let lastTick = 0;

  function tick(now) {
    const dt = Math.min(32, now - lastTick) / 1000;
    lastTick = now;
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

  function springTo(t, initialV = null) {
    target = t;
    if (initialV !== null) v = initialV;
    if (prefersReducedMotion) {
      x = t;
      v = 0;
      return;
    }
    if (!rafId) {
      lastTick = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }

  function stopSpring() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    v = 0;
  }

  // ── Gesture state ───────────────────────────────────────────────────────
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;
  let hasDirectionLock = false;
  let isHorizontalSwipe = false;
  let activeIndex = 0;
  let samples = []; // recent {t, x(px)} for release-velocity
  const SAMPLE_WINDOW_MS = 100;
  const FLICK_VELOCITY = 0.4; // px/ms — a flick commits regardless of distance
  const DISTANCE_COMMIT = 0.3; // fraction of width — a slow drag commits here
  const SWIPE_IGNORE_SELECTOR =
    'input, textarea, select, a, label, [data-swipe-ignore="true"]';

  $: if (lists.length > 0 && activeListId) {
    const index = lists.findIndex((l) => l.id === activeListId);
    if (index !== -1 && index !== activeIndex) {
      activeIndex = index;
      if (!isSwiping) springTo(-activeIndex * 100);
    }
  }

  function pushSample(px) {
    const now = performance.now();
    samples.push({ t: now, x: px });
    while (samples.length && now - samples[0].t > SAMPLE_WINDOW_MS) {
      samples.shift();
    }
  }

  // px/ms over the recent window — the finger's intent at the moment of release
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

    // Interruptible: grabbing mid-flight takes over from wherever the
    // spring is right now — no waiting for the animation to finish.
    stopSpring();

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
        springTo(-activeIndex * 100);
        return;
      }
    }

    if (!isHorizontalSwipe) return;

    e.preventDefault();

    const screenWidth = window.innerWidth;
    let percentShift = (diffX / screenWidth) * 100;

    // Asymptotic rubber-band past the ends — resistance grows with how far
    // you pull (iOS-style), instead of a flat ratio that lets the last card
    // travel a full width.
    const atStartEdge = activeIndex === 0 && diffX > 0;
    const atEndEdge = activeIndex === lists.length - 1 && diffX < 0;
    if (atStartEdge || atEndEdge) {
      const over = Math.abs(percentShift);
      percentShift = Math.sign(percentShift) * ((over * 0.5) / (1 + over / 40));
    }

    // Track the finger 1:1 while dragging — the spring only takes over on release.
    x = -activeIndex * 100 + percentShift;
  }

  function handleTouchEnd(e) {
    if (!isSwiping && !isHorizontalSwipe) return;

    const endX = e.changedTouches[0].screenX;
    pushSample(endX);
    isSwiping = false;
    const shouldHandleSwipe = isHorizontalSwipe;
    hasDirectionLock = false;
    isHorizontalSwipe = false;

    if (!shouldHandleSwipe) return;

    const screenWidth = window.innerWidth;
    const diffPx = endX - touchStartX;
    const velPxMs = releaseVelocity();
    // Convert release velocity into the spring's units so the card keeps
    // sailing at the speed the finger left it — this is the whole feel.
    const velPctS = (velPxMs / screenWidth) * 100 * 1000;

    let nextIndex = activeIndex;
    if (Math.abs(velPxMs) > FLICK_VELOCITY) {
      // Flick: obey the finger's LAST intent (velocity direction), even if
      // the net displacement points the other way after a mid-drag reversal.
      nextIndex = activeIndex + (velPxMs < 0 ? 1 : -1);
    } else if (Math.abs(diffPx) > screenWidth * DISTANCE_COMMIT) {
      nextIndex = activeIndex + (diffPx < 0 ? 1 : -1);
    }

    nextIndex = Math.max(0, Math.min(lists.length - 1, nextIndex));

    if (nextIndex !== activeIndex) {
      activeIndex = nextIndex;
      listsStore.setActiveList(lists[nextIndex].id);
      hapticService.impact("medium");
      soundService.select();
    }
    springTo(-nextIndex * 100, velPctS);
  }

  function handleTouchCancel() {
    isSwiping = false;
    hasDirectionLock = false;
    isHorizontalSwipe = false;
    springTo(-activeIndex * 100);
  }

  function setActiveList(index) {
    if (index >= 0 && index < lists.length) {
      activeIndex = index;
      springTo(-index * 100);
      listsStore.setActiveList(lists[index].id);
      hapticService.impact("medium");
      soundService.select();
    }
  }

  // Micro-tilt: the cards lean into the throw (capped ~1.3°) and stand back
  // upright as the spring calms, because tilt just reads spring velocity.
  $: tilt = prefersReducedMotion ? 0 : Math.max(-1.3, Math.min(1.3, v * 0.004));

  onDestroy(() => {
    stopSpring();
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
  <div
    class="lists-wrapper"
    style="transform: translateX({x}%); --tilt: {tilt}deg;"
  >
    {#each lists as list, i (list.id)}
      <div
        id="list-slide-{list.id}"
        class="list-slide"
        class:active={list.id === activeListId}
        inert={list.id !== activeListId}
        aria-hidden={list.id !== activeListId}
        style="--list-primary: {list.primaryColor}; --list-accent: {list.accentColor}; --list-glow: {list.glowColor}; --away: {Math.min(
          1,
          Math.abs(x + i * 100) / 100,
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
        class:active={i === activeIndex}
        style="--dot-primary: {list.primaryColor}; --dot-accent: {list.accentColor}; --dot-glow: {list.glowColor}"
        on:click={() => setActiveList(i)}
        aria-label="Switch to {list.name}"
        aria-current={i === activeIndex ? "true" : undefined}
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

  .lists-wrapper {
    display: flex;
    width: 100%;
    max-width: 100%;
    /* Transformed via inline style every spring frame */
    will-change: transform;
  }

  /* Neighbor choreography rides the live spring position (--away: 0 = in
     view, 1 = a full card away), so scale and fade track the finger
     continuously instead of jumping when the active class flips. */
  .list-slide {
    width: 100%;
    max-width: 100%;
    flex-shrink: 0;
    padding: 0 4px; /* Tiny padding between slides */
    box-sizing: border-box;
    opacity: calc(1 - 0.6 * var(--away, 1));
    transform: scale(calc(1 - 0.05 * var(--away, 1))) rotate(var(--tilt, 0deg));
    pointer-events: none; /* Disable interaction on non-active slides */
  }

  .list-slide.active {
    pointer-events: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .list-slide {
      opacity: calc(1 - 0.6 * var(--away, 1));
      transform: none;
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
