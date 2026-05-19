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
  class="bg-gradient-mesh main center hero page-shell grid min-h-[100dvh] gap-8 px-4 py-6 pb-0 pt-[clamp(4rem,12vh,8rem)] font-sans text-gray-800 antialiased sm:px-6 md:px-10 lg:pb-0"
>
  <main
    id="main-content"
    class="mx-auto flex w-full max-w-md flex-col items-center sm:max-w-lg md:max-w-2xl lg:max-w-3xl"
  >
    <slot />
  </main>

  <!-- Footer section with attribution and Chrome extension info -->
  <footer
    class="sticky bottom-0 z-10 box-border w-full border-t border-pink-200/80 bg-gradient-to-r from-[#fff6e6]/90 via-[#ffead8]/90 to-[#fff1df]/90 pb-2 pt-3 text-center text-xs text-gray-600 shadow-[0_-4px_15px_rgba(249,168,212,0.3)] backdrop-blur-[3px] sm:pb-3 sm:pt-4"
  >
    <div
      class="container mx-auto flex flex-col flex-wrap items-center justify-between gap-2 sm:flex-row sm:gap-3"
    >
      <div
        class="copyright ml-4 flex flex-wrap items-center justify-center sm:ml-6 md:ml-8"
      >
        <span
          class="hidden text-xs font-medium tracking-tight text-gray-500 sm:inline-block sm:text-sm"
        >
          © {footerYear} ZipList
        </span>
        <span class="hidden mx-1 text-pink-300 sm:inline-block sm:mx-2">•</span>
        <span class="text-xs font-light text-gray-600 sm:text-sm"> </span>
      </div>
      <div class="mr-4 flex items-center sm:mr-6 md:mr-8">
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
    background-attachment: fixed;
  }

  footer {
    margin-inline: -1rem;
    width: calc(100% + 2rem);
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
  }

  @media (min-width: 640px) {
    footer {
      margin-inline: -1.5rem;
      width: calc(100% + 3rem);
    }
  }

  @media (min-width: 768px) {
    footer {
      margin-inline: -2.5rem;
      width: calc(100% + 5rem);
    }
  }

  /* Media queries for mobile optimization */
  @media (max-width: 640px) {
    .page-shell {
      padding-top: 6vh !important;
      padding-bottom: 0 !important;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }

    footer {
      padding-top: 0.5rem;
      padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
    }

    footer .container {
      gap: 0.75rem;
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
      padding-top: 15vh !important;
      padding-bottom: 0 !important;
    }
  }
</style>
