<!--
  ThemeMascot — a tiny ZipList speech-bubble mascot in a given theme's gradient,
  for the vibe picker tiles. Inlines the real ziplist-icon-base silhouette (bubble
  + list rows) plus the icon eyes, recolored with that theme's 3-stop palette.
  Each instance gets a unique gradient id so tiles don't share a fill.
-->
<script>
  export let theme = "neo";
  export let size = "38px";

  // Per-theme 3-stop palettes — sourced from the original vibe pill gradients
  // so each swatch matches the app's existing theme colors exactly.
  const mascotThemes = {
    neo: { start: "#ffe86b", mid: "#ff9a8c", end: "#76ead7" },
    focus: { start: "#ffcf9c", mid: "#ffab77", end: "#ff8a5b" },
    chill: { start: "#a5e3e0", mid: "#71c9ce", end: "#4da1a9" },
    nocturne: { start: "#d8a9e3", mid: "#c487d2", end: "#6ca4c2" },
  };

  const uid = Math.random().toString(36).slice(2, 8);
  $: pal = mascotThemes[theme] || mascotThemes.neo;
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
