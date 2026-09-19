<script>
  import { MainContainer } from "$lib/components/mainPage";

  const canonicalUrl = "https://ziplist.app/es/parejas";
  const title =
    "Listas Compartidas para Parejas en Vivo — Cero Cuentas ni Contraseñas | ZipList";
  const description =
    "La lista de compras y tareas compartida en tiempo real para parejas. Divide los pasillos del súper, planea viajes y haz el súper juntos con sincronización QR instantánea.";

  // Assembled here rather than inline in <svelte:head>: a literal
  // `<script>` in markup makes svelte-eslint-parser treat the rest of
  // the file as JS, which silently dropped this route from linting.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "ZipList Listas Compartidas para Parejas",
        url: canonicalUrl,
        image: "https://ziplist.app/og-card.png",
        description: description,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        inLanguage: "es",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description:
            "Listas compartidas para parejas en vivo con emparejamiento QR",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "¿Cómo compartimos una lista en pareja sin crear cuentas?",
            acceptedAnswer: {
              "@type": "Answer",
              text: 'Tocas "Compartir QR" para crear una sala en vivo. Tu pareja escanea el código con su cámara y se conectan al instante en tiempo real. Cero correos, cero registros, cero contraseñas.',
            },
          },
          {
            "@type": "Question",
            name: "¿Podemos tachar pendientes al mismo tiempo en extremos opuestos del supermercado?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "¡Sí! La sincronización toma menos de 10 milisegundos mediante WebSockets. Cuando tu pareja tacha la leche en el pasillo 1, se actualiza en tu pantalla en el pasillo 8 al instante.",
            },
          },
          {
            "@type": "Question",
            name: "¿Podemos dictar por voz los dos?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Cualquiera de los dos puede pulsar el micrófono y dictar las compras del súper, la maleta del viaje o las tareas de la casa. ZipList convierte el audio en elementos individuales al vuelo.",
            },
          },
        ],
      },
    ],
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
  <link rel="alternate" hreflang="en" href="https://ziplist.app/for/couples" />

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
