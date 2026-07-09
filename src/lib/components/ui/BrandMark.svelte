<!--
  BrandMark — the tiny letterhead for standalone pages (share landing,
  live rooms): mini mascot + ZipList.app wordmark, linking home. Quiet,
  classy, and the recipient's breadcrumb back to the app.
-->
<script>
  import ThemeMascot from "../mainPage/settings/ThemeMascot.svelte";
</script>

<a class="zl-brandmark" href="/" aria-label="Open ZipList">
  <span class="zl-brandmark-icon" aria-hidden="true">
    <ThemeMascot theme="neo" size="22px" />
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
    color: var(--zl-text-color-primary, #444);
    text-decoration: none;
    opacity: 0.85;
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
    color: var(--zl-cta-color, #ffb000);
  }
</style>
