<script>
  import { MainContainer } from '$lib/components/mainPage';

  const canonicalUrl = 'https://ziplist.app/es';
  const title = 'ZipList en Español | Listas de Mandado y Tareas por Voz — Cero Rollos';
  const description =
    'Dicta tus listas de compras, mandado y pendientes al instante. Listas táctiles con físicas elásticas, dictado por voz y salas compartidas por código QR.';

  // Assembled here rather than inline in <svelte:head>: a literal
  // `<script>` in markup makes svelte-eslint-parser treat the rest of
  // the file as JS, which silently dropped this route from linting.
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'ZipList en Español',
    alternateName: 'ZipList.app/es',
    url: canonicalUrl,
    image: 'https://ziplist.app/og-card.png',
    description: description,
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Listas de tareas y compras por voz',
    operatingSystem: 'Web',
    inLanguage: 'es',
    isAccessibleForFree: true,
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Creación gratuita de listas por voz y salas compartidas'
      },
      {
        '@type': 'Offer',
        price: '19',
        priceCurrency: 'USD',
        description: 'Pase Vitalicio de Contribuidor con listas ilimitadas'
      }
    ],
    keywords:
      'listas por voz, lista de compras, el mandado, listas compartidas qr, notas de voz, app de tareas sin cuenta'
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
  <link rel="alternate" hreflang="es" href={canonicalUrl} />
  <link rel="alternate" hreflang="en" href="https://ziplist.app" />

  <!-- OpenGraph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ZipList" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content="https://ziplist.app/og-card.png" />
  <meta property="og:locale" content="es_LA" />

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
