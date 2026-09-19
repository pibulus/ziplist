<script>
  import { MainContainer } from '$lib/components/mainPage';

  const canonicalUrl = 'https://ziplist.app';
  const title = 'ZipList — Talk it into a list. Tick it off.';
  const description =
    'A warm, tactile voice checklist for groceries, errands, packing, and chores. No dates, no streaks, no pressure.';

  // Assembled here rather than inline in <svelte:head>: a literal
  // `<script>` in markup makes svelte-eslint-parser treat the rest of
  // the file as JS, which silently dropped this route from linting.
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'ZipList',
    alternateName: 'ZipList.app',
    url: canonicalUrl,
    image: 'https://ziplist.app/og-card.png',
    description: description,
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Voice checklist and todo lists',
    operatingSystem: 'Web',
    inLanguage: 'en',
    isAccessibleForFree: true,
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free voice checklist creation and live QR rooms'
      },
      {
        '@type': 'Offer',
        price: '19',
        priceCurrency: 'USD',
        description: 'Lifetime Supporter Pass with unlimited lists'
      }
    ],
    keywords:
      'voice checklist, grocery list, talk to list, hands-free list, live shared todo, tactile checklist, no account todo'
  };
  const jsonLdScript =
    `<script type="application/ld+json">${JSON.stringify(structuredData)}` +
    // The escape stops this literal closing the module block it lives in.
    // eslint-disable-next-line no-useless-escape
    `<\/script>`;
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />
  <link rel="alternate" hreflang="en" href={canonicalUrl} />
  <link rel="alternate" hreflang="es" href="https://ziplist.app/es" />

  <!-- OpenGraph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ZipList" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content="https://ziplist.app/og-card.png" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content={canonicalUrl} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content="https://ziplist.app/og-card.png" />

  <!-- Structured Data -->
  <!-- Built from module constants above; no user input reaches it. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html jsonLdScript}
</svelte:head>

<MainContainer />
