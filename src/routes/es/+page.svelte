<script>
  import { MainContainer } from "$lib/components/mainPage";

  const canonicalUrl = "https://ziplist.app/es";
  const title =
    "ZipList en Español | Listas de Mandado y Tareas por Voz — Cero Rollos";
  const description =
    "Dicta tus listas de compras, mandado y pendientes al instante. Listas táctiles con físicas elásticas, dictado por voz y salas compartidas por código QR.";

  // Assembled here rather than inline in <svelte:head>: a literal
  // `<script>` in markup makes svelte-eslint-parser treat the rest of
  // the file as JS, which silently dropped this route from linting.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ZipList en Español",
    alternateName: "ZipList.app/es",
    url: canonicalUrl,
    image: "https://ziplist.app/og-card.png",
    description: description,
    applicationCategory: "UtilitiesApplication",
    applicationSubCategory: "Listas de tareas y compras por voz",
    operatingSystem: "Web",
    inLanguage: "es",
    isAccessibleForFree: true,
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Creación gratuita de listas por voz y salas compartidas",
      },
      {
        "@type": "Offer",
        price: "29",
        priceCurrency: "USD",
        description: "Pase Vitalicio de Contribuidor con listas ilimitadas",
      },
    ],
    keywords:
      "listas por voz, lista de compras, el mandado, listas compartidas qr, notas de voz, app de tareas sin cuenta",
  };
  const jsonLdScript =
    `<script type="application/ld+json">${JSON.stringify(structuredData)}` +
    // The escape stops this literal closing the module block it lives in.
    // eslint-disable-next-line no-useless-escape
    `<\/script>`;
</script>

<svelte:head>
  <!-- Structured Data -->
  <!-- Built from module constants above; no user input reaches it. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html jsonLdScript}
</svelte:head>

<MainContainer
  seo={{
    title,
    description,
    canonical: canonicalUrl,
    ogLocale: "es_LA",
    hreflangEn: "https://ziplist.app",
    hreflangEs: canonicalUrl,
  }}
/>
