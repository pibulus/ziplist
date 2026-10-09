<script>
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { ANIMATION } from "$lib/constants";

  // A selector, or a list of them: the burst comes from the first one on screen.
  export let targetSelector = null;
  export let duration = ANIMATION.CONFETTI.ANIMATION_DURATION;
  export let colors = ANIMATION.CONFETTI.COLORS;
  export let particleCount = ANIMATION.CONFETTI.PIECE_COUNT;
  // 'confetti' (paper bits), 'stars' / 'mascots', or an emoji party: 'hearts' or 'tacos'.
  export let kind = "confetti";

  const EMOJI = {
    hearts: ["💖", "🩷", "💛", "🧡", "💜"],
    tacos: ["🌮", "🌮", "🌮", "🌮", "🌶️", "🌵"],
  };

  $: glyph = Boolean(EMOJI[kind]);

  const dispatch = createEventDispatcher();

  let pieces = [];
  let origin = { x: 0, y: 0 };
  let timeoutId;

  onMount(() => {
    updateOrigin();
    pieces = Array.from({ length: particleCount }, (_, index) =>
      createPiece(index),
    );

    timeoutId = setTimeout(() => {
      dispatch("complete");
    }, duration);
  });

  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  function updateOrigin() {
    if (typeof window === "undefined") {
      return;
    }

    const windowWidth = window.innerWidth || 1;
    const windowHeight = window.innerHeight || 1;
    const fallbackOrigin = {
      x: windowWidth / 2,
      y: Math.min(170, windowHeight * 0.24),
    };

    if (!targetSelector || typeof document === "undefined") {
      origin = fallbackOrigin;
      return;
    }

    const burstPoint = (rect) => ({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height * 0.22,
    });
    const onScreen = ({ x, y }) =>
      x > 24 && x < windowWidth - 24 && y > 52 && y < windowHeight - 96;
    const selectors = Array.isArray(targetSelector)
      ? targetSelector
      : [targetSelector];
    const point = selectors
      .map((selector) => {
        if (!selector) return null;
        if (typeof selector === "string")
          return document.querySelector(selector)?.getBoundingClientRect();
        if (typeof selector.getBoundingClientRect === "function")
          return selector.getBoundingClientRect();
        return null;
      })
      .filter(Boolean)
      .map(burstPoint)
      .find(onScreen);

    if (!point) {
      origin = fallbackOrigin;
      return;
    }

    origin = {
      x: clamp(point.x, 28, windowWidth - 28),
      y: clamp(point.y, 52, windowHeight - 96),
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function createPiece(id) {
    const size = randomBetween(
      ANIMATION.CONFETTI.MIN_SIZE,
      ANIMATION.CONFETTI.MAX_SIZE,
    );
    const shapeSeed = Math.random();
    const shape = glyph
      ? "glyph"
      : shapeSeed > 0.82
        ? "streamer"
        : shapeSeed > 0.68
          ? "dot"
          : "rect";
    const width =
      shape === "glyph"
        ? size * 1.6
        : shape === "streamer"
          ? size * 0.58
          : size;
    const height =
      shape === "glyph"
        ? width
        : shape === "dot"
          ? size
          : shape === "streamer"
            ? size * randomBetween(2.1, 3.1)
            : size * randomBetween(1.05, 1.65);
    const fanPosition = id / Math.max(1, particleCount - 1);
    const burstX = (fanPosition - 0.5) * 210 + randomBetween(-30, 30);
    const burstY = randomBetween(-118, -42);
    const finalX = burstX + burstX * 0.18 + randomBetween(-54, 54);
    const finalY = randomBetween(74, 210);

    return {
      id,
      color: colors[id % colors.length],
      emoji: EMOJI[kind]?.[Math.floor(Math.random() * EMOJI[kind].length)] || "",
      shape,
      width,
      height,
      radius: shape === "dot" || shape === "streamer" ? "999px" : "3px",
      delay: Math.random() * 0.1,
      duration: randomBetween(0.95, 1.45),
      startX: randomBetween(-12, 12),
      startY: randomBetween(-10, 10),
      burstX,
      burstY,
      finalX,
      finalY,
      rotateStart: glyph ? randomBetween(-30, 30) : Math.random() * 360,
      rotateMid: glyph ? randomBetween(-90, 90) : randomBetween(120, 520),
      rotateEnd: glyph ? randomBetween(-200, 200) : randomBetween(520, 980),
    };
  }
</script>

<div class="confetti-overlay" aria-hidden="true">
  {#each pieces as piece (piece.id)}
    <span
      class="confetti-piece"
      class:is-glyph={glyph}
      style={`--origin-x:${origin.x}px; --origin-y:${origin.y}px; --start-x:${piece.startX}px; --start-y:${piece.startY}px; --burst-x:${piece.burstX}px; --burst-y:${piece.burstY}px; --final-x:${piece.finalX}px; --final-y:${piece.finalY}px; --piece-width:${piece.width}px; --piece-height:${piece.height}px; --piece-radius:${piece.radius}; --delay:${piece.delay}s; --duration:${piece.duration}s; --rotate-start:${piece.rotateStart}deg; --rotate-mid:${piece.rotateMid}deg; --rotate-end:${piece.rotateEnd}deg; ${glyph ? "" : `background:${piece.color};`}`}
    >
      {#if piece.emoji}
        {piece.emoji}
      {/if}
    </span>
  {/each}
</div>

<style>
  .confetti-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 120;
    overflow: hidden;
  }

  .confetti-piece {
    position: absolute;
    top: 0;
    left: 0;
    width: var(--piece-width);
    height: var(--piece-height);
    border-radius: var(--piece-radius);
    opacity: 0;
    will-change: transform, opacity;
    animation: confettiBurst var(--duration) cubic-bezier(0.16, 1, 0.3, 1)
      forwards;
    animation-delay: var(--delay);
    transform: translate(
        calc(var(--origin-x) + var(--start-x)),
        calc(var(--origin-y) + var(--start-y))
      )
      rotate(var(--rotate-start)) scale(0.5);
  }

  .confetti-piece.is-glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--piece-height);
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .confetti-piece {
      display: none;
    }
  }

  @keyframes confettiBurst {
    0% {
      opacity: 0;
      transform: translate(
          calc(var(--origin-x) + var(--start-x)),
          calc(var(--origin-y) + var(--start-y))
        )
        rotate(var(--rotate-start)) scale(0.48);
    }

    10% {
      opacity: 1;
    }

    36% {
      opacity: 1;
      transform: translate(
          calc(var(--origin-x) + var(--burst-x)),
          calc(var(--origin-y) + var(--burst-y))
        )
        rotate(var(--rotate-mid)) scale(1);
    }

    100% {
      opacity: 0;
      transform: translate(
          calc(var(--origin-x) + var(--final-x)),
          calc(var(--origin-y) + var(--final-y))
        )
        rotate(var(--rotate-end)) scale(0.86);
    }
  }
</style>
