<!--
  BrandMark — the tiny letterhead for standalone pages (share landing,
  live rooms) and list-first mode: mini mascot + ZipList.app wordmark,
  following the active Desk Drawer vibe.
-->
<script>
  import { theme } from "$lib";
  import ThemeMascot from "../mainPage/settings/ThemeMascot.svelte";

  export let href = "/";
</script>

<a class="zl-brandmark" {href} aria-label="Open ZipList">
  <span class="zl-brandmark-icon" aria-hidden="true">
    <ThemeMascot theme={$theme} size="22px" />
  </span>
  <span>
    ZipList<span class="zl-brandmark-suffix" aria-hidden="true">.app</span>
  </span>
</a>

<style>
  .zl-brandmark {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: "Space Mono", monospace;
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--zl-text-color-primary, #1e1714);
    text-decoration: none;
    opacity: 0.9;
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
  }

  .zl-brandmark:hover,
  .zl-brandmark:focus-visible {
    opacity: 1;
    transform: translateY(-1px);
    outline: none;
  }

  .zl-brandmark-icon {
    display: inline-flex;
    align-items: center;
  }

  .zl-brandmark-suffix {
    background: var(
      --app-suffix-gradient,
      linear-gradient(to right, #ffcc33, #ff6ac2)
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
</style>
