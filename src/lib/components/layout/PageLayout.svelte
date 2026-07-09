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
  export let appName = "ZipList";
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
    class="footer-component zl-app-footer fixed bottom-0 left-0 right-0 z-10 box-border border-t pb-2 pt-3 text-center text-xs backdrop-blur-[3px] sm:pb-4 sm:pt-6"
  >
    <div
      class="container mx-auto flex flex-row items-center justify-center gap-1 sm:justify-between sm:gap-3"
    >
      <div
        class="copyright ml-4 hidden flex-wrap items-center justify-center sm:ml-6 sm:flex md:ml-8"
      >
        <span class="mr-1 text-sm font-medium tracking-normal">
          © {footerYear} {appName}
        </span>
        <span class="footer-dot mx-2">•</span>
        <span class="footer-meta text-sm font-light">
          <span
            class="footer-heart animate-pulse hover:scale-110"
            aria-label="love"
          >❤️</span>
          in Melbourne
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

  /* The cream ground is the brand's constant — themes express through the
     card, mascot, and accents, never by repainting the page. One stable
     ground keeps theme-switching calm instead of a full costume change. */
  :global(.bg-gradient-mesh) {
    background-color: #fff6e6;
    background-image: radial-gradient(
      circle at 50% 35%,
      #fff8ed 0%,
      #fff6e6 52%,
      #fff3df 82%,
      #ffefda 100%
    );
    /* background-attachment: fixed is intentionally omitted —
       iOS Safari renders it as a flat color on non-viewport elements. */
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
    /* THE BUG FIX: resting text color is a TOKEN (defined per-theme in
       theme-variables.css), not the hardcoded text-gray-600 Tailwind literal —
       so it stays readable on every theme. */
    color: var(--footer-text-color, #4b5563);
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }

  .zl-app-footer {
    border-color: var(--zl-footer-border-color);
    box-shadow: var(--zl-footer-shadow);
  }

  .footer-dot {
    color: var(--zl-footer-dot-color);
  }

  .footer-heart {
    color: var(--footer-heart-color, var(--zl-accent-color, #ff6ac2));
    display: inline-block;
  }

  @media (prefers-reduced-motion: reduce) {
    .footer-heart {
      animation: none;
    }
  }

  /* Short viewports (SE-class phones, landscape): compress the hero
     stack so the record button never needs a scroll to reach. */
  @media (max-height: 700px) {
    .page-shell {
      gap: 1.25rem;
      padding-top: max(env(safe-area-inset-top), 1.5rem) !important;
    }
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

  /* Desktop layout - start from top */
  @media (min-width: 1024px) {
    .page-shell {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      padding-top: clamp(1.5rem, 3.5vh, 3rem) !important;
      padding-bottom: 7rem !important;
    }

    .page-shell.list-first-shell {
      padding-top: clamp(1.5rem, 4vh, 3rem) !important;
    }
  }
</style>
