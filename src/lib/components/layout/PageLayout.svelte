<script>
  export let title = "ZipList | Talk a List. Tick It Off.";
  export let description =
    "Make a checklist by talking. ZipList is a warm little web app for groceries, errands, packing, gear, chores, and quick shared lists.";
  export let keywords =
    "voice checklist app, talk to list, voice to list, grocery checklist, shared checklist, packing checklist, web checklist app";
  export let canonical = "https://ziplist.app/";
  export let robots = "index, follow, max-image-preview:large";
  export let ogTitle = "";
  export let ogDescription = "";
  export let ogUrl = "";
  export let ogImage = "https://ziplist.app/og-image.png";
  export let ogImageAlt = "ZipList warm voice checklist app preview";
  export let ogType = "website";
  export let footerYear = new Date().getFullYear();
  export let listFirst = false;

  $: resolvedOgTitle = ogTitle || title;
  $: resolvedOgDescription = ogDescription || description;
  $: resolvedOgUrl = ogUrl || canonical;
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta name="keywords" content={keywords} />
  <meta name="robots" content={robots} />
  {#if canonical}
    <link rel="canonical" href={canonical} />
  {/if}

  <meta property="og:type" content={ogType} />
  <meta property="og:site_name" content="ZipList" />
  <meta property="og:locale" content="en_US" />
  {#if resolvedOgUrl}
    <meta property="og:url" content={resolvedOgUrl} />
  {/if}
  <meta property="og:title" content={resolvedOgTitle} />
  <meta property="og:description" content={resolvedOgDescription} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:secure_url" content={ogImage} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={ogImageAlt} />

  <meta name="twitter:card" content="summary_large_image" />
  {#if resolvedOgUrl}
    <meta name="twitter:url" content={resolvedOgUrl} />
  {/if}
  <meta name="twitter:title" content={resolvedOgTitle} />
  <meta name="twitter:description" content={resolvedOgDescription} />
  <meta name="twitter:image" content={ogImage} />
  <meta name="twitter:image:alt" content={ogImageAlt} />
</svelte:head>

<a class="skip-link" href="#main-content">Skip to lists</a>

<div
  class="bg-gradient-mesh main center hero page-shell grid min-h-[100dvh] gap-8 px-4 py-6 pt-[clamp(4rem,12vh,8rem)] font-sans text-gray-800 antialiased sm:px-6 md:px-10"
  class:list-first-shell={listFirst}
>
  <main
    id="main-content"
    class="mx-auto flex w-full max-w-md flex-col items-center sm:max-w-lg md:max-w-2xl lg:max-w-3xl"
  >
    <slot />
  </main>

  <!-- Footer section with attribution and Chrome extension info -->
  <footer
    class="footer-component zl-app-footer fixed bottom-0 left-0 right-0 z-10 box-border border-t pb-2 pt-3 text-center text-xs text-gray-600 backdrop-blur-[3px] sm:pb-4 sm:pt-6"
  >
    <div
      class="container mx-auto flex flex-row items-center justify-center gap-1 sm:justify-between sm:gap-3"
    >
      <div
        class="copyright ml-4 hidden flex-wrap items-center justify-center sm:ml-6 sm:flex md:ml-8"
      >
        <span class="mr-1 text-sm font-medium tracking-normal text-gray-500">
          © {footerYear} ZipList
        </span>
        <span class="footer-dot mx-2">•</span>
        <span class="text-sm font-light text-gray-600">
          Melbourne
        </span>
      </div>
      <div class="flex items-center sm:mr-6 md:mr-8">
        <slot name="footer-buttons" />
      </div>
    </div>
  </footer>
</div>

<style>
  .skip-link {
    position: fixed;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 1000;
    transform: translateY(-150%);
    border: 3px solid #000000;
    border-radius: 12px;
    background: #ffb000;
    color: #000000;
    font-family: "Space Mono", monospace;
    font-weight: 800;
    padding: 0.65rem 0.9rem;
    box-shadow: 4px 4px 0 #000000;
    transition: transform 0.15s ease;
  }

  .skip-link:focus {
    transform: translateY(0);
    outline: none;
  }

  :global(.bg-gradient-mesh) {
    background-color: #fff6e6;
    background-image: radial-gradient(
      circle at center,
      #fff6e6 0%,
      #fff6e6 40%,
      #fff0d4 70%,
      #ffe8c8 100%
    );
    /* background-attachment: fixed is intentionally omitted —
       iOS Safari renders it as a flat color on non-viewport elements. */
  }

  /* Page background adapts to cool/dark themes */
  :global(html[data-theme="chill"] .bg-gradient-mesh) {
    background-color: #e5f9f6;
    background-image: radial-gradient(
      circle at center,
      #e5f9f6 0%,
      #e5f9f6 40%,
      #d0f0f0 70%,
      #b7e5e5 100%
    );
  }

  :global(html[data-theme="zen"] .bg-gradient-mesh) {
    background-color: #f4eeff;
    background-image: radial-gradient(
      circle at center,
      #f4eeff 0%,
      #f4eeff 40%,
      #ebe0ff 70%,
      #d0bfff 100%
    );
  }

  :global(html[data-theme="nocturne"] .bg-gradient-mesh) {
    background-color: #dbeaf3;
    background-image: radial-gradient(
      circle at center,
      #dbeaf3 0%,
      #dbeaf3 40%,
      #c8dde9 70%,
      #b5cfe0 100%
    );
  }

  .page-shell {
    padding-bottom: calc(5.75rem + env(safe-area-inset-bottom));
  }

  .page-shell.list-first-shell {
    gap: 1.25rem;
    padding-top: max(env(safe-area-inset-top), clamp(2rem, 6svh, 4rem));
  }

  footer {
    --footer-surface-rgb: 255, 246, 230;
    --zl-footer-border-color: rgba(
      var(--zl-primary-color-rgb, 255, 176, 0),
      0.26
    );
    --zl-footer-shadow: 0 -4px 15px
      rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.14);
    --zl-footer-bg-image: linear-gradient(
      90deg,
      rgba(var(--footer-surface-rgb), 0.92),
      rgba(var(--footer-surface-rgb), 0.88),
      rgba(var(--footer-surface-rgb), 0.92)
    );
    --zl-footer-dot-color: rgba(
      var(--zl-accent-color-rgb, 255, 106, 194),
      0.78
    );
    background: var(--zl-footer-bg-image);
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }

  .zl-app-footer {
    border-color: var(--zl-footer-border-color);
    box-shadow: var(--zl-footer-shadow);
  }

  .footer-dot {
    color: var(--zl-footer-dot-color);
  }

  /* Media queries for mobile optimization */
  @media (max-width: 640px) {
    .page-shell {
      padding-top: max(
        env(safe-area-inset-top),
        clamp(3rem, 7svh, 4.5rem)
      ) !important;
      padding-bottom: max(
        4.75rem,
        calc(env(safe-area-inset-bottom) + 4.25rem)
      ) !important;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }

    .page-shell.list-first-shell {
      padding-top: max(
        env(safe-area-inset-top),
        clamp(1.5rem, 5svh, 2.75rem)
      ) !important;
      gap: 1rem;
    }

    footer {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
    }

    footer .container {
      gap: 0.5rem;
    }

    footer .container > div.copyright {
      margin-left: 1rem;
    }

    footer .container > div:last-child {
      margin-right: 1rem;
    }
  }

  :global(html[data-theme="chill"]) footer {
    --footer-surface-rgb: 229, 249, 246;
  }

  :global(html[data-theme="zen"]) footer {
    --footer-surface-rgb: 244, 238, 255;
  }

  :global(html[data-theme="nocturne"]) footer {
    --footer-surface-rgb: 219, 234, 243;
  }

  /* Desktop layout - start from top */
  @media (min-width: 1024px) {
    .page-shell {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      padding-top: 15vh !important;
      padding-bottom: 10vh !important;
    }

    .page-shell.list-first-shell {
      padding-top: 7vh !important;
    }
  }
</style>
