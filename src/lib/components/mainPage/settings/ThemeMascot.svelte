<!--
  ThemeMascot — a tiny ZipList speech-bubble mascot in a given theme's gradient,
  for the vibe picker tiles. Inlines the real ziplist-icon-base silhouette (bubble
  + list rows) plus the icon eyes, recolored with that theme's 3-stop palette.
  Each instance gets a unique gradient id so tiles don't share a fill.
-->
<script>
  export let theme = "highlighter";
  export let size = "38px";

  // Per-theme 3-stop palettes — "The Desk Drawer" roster (re-cut 2026-07-21),
  // matching the --zl-mascot-gradient-* stops in theme-variables.css exactly.
  const mascotThemes = {
    highlighter: { start: "#ffcc33", mid: "#ffa36f", end: "#ff6ac2" },
    "sticky-note": { start: "#fff95c", mid: "#ffe14d", end: "#ffb300" },
    "gel-pen": { start: "#ff4fa3", mid: "#ff2d87", end: "#e0006b" },
    "legal-pad": { start: "#c6f542", mid: "#a3e017", end: "#6fa300" },
  };

  const uid = Math.random().toString(36).slice(2, 8);
  $: pal = mascotThemes[theme] || mascotThemes.highlighter;
  $: gid = `tm-${theme}-${uid}`;
</script>

<svg
  viewBox="96 56 832 872"
  width={size}
  height={size}
  class="theme-mascot"
  aria-hidden="true"
  focusable="false"
>
  <defs>
    <linearGradient
      id={gid}
      x1="150"
      y1="130"
      x2="860"
      y2="820"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0" stop-color={pal.start} />
      <stop offset="0.5" stop-color={pal.mid} />
      <stop offset="1" stop-color={pal.end} />
    </linearGradient>
  </defs>

  <path
    d="M308 118H716C815 118 878 181 878 280V574C878 673 815 736 716 736H600L542 846C529 870 495 870 482 846L424 736H308C209 736 146 673 146 574V280C146 181 209 118 308 118Z"
    fill="url(#{gid})"
    stroke="#000000"
    stroke-width="54"
    stroke-linejoin="round"
  />

  <g fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round">
    <rect x="334" y="520" width="44" height="44" rx="6" stroke-width="18" />
    <path d="M430 542H690" stroke-width="21" />
    <rect x="334" y="598" width="44" height="44" rx="6" stroke-width="18" />
    <path d="M430 620H690" stroke-width="21" />
  </g>

  <ellipse cx="424" cy="326" rx="39" ry="60" fill="#000000" />
  <ellipse cx="600" cy="326" rx="39" ry="60" fill="#000000" />
</svg>

<style>
  .theme-mascot {
    display: block;
    overflow: visible;
  }
</style>
