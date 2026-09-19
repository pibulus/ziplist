<script>
  import { MainContainer } from "$lib/components/mainPage";

  const canonicalUrl = "https://ziplist.app/es/mandado";
  const title =
    "Lista del Mandado y Súper por Voz — Sin Registrar Cuentas | ZipList";
  const description =
    "Crea tu lista del mandado dictando por voz. Agrega jitomate, aguacate y tortillas sin escribir. Salas QR compartidas en vivo para ir al súper en pareja sin registrarse.";

  // Assembled here rather than inline in <svelte:head>: a literal
  // `<script>` in markup makes svelte-eslint-parser treat the rest of
  // the file as JS, which silently dropped this route from linting.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "ZipList Lista del Mandado por Voz",
        url: canonicalUrl,
        image: "https://ziplist.app/og-card.png",
        description: description,
        applicationCategory: "ShoppingApplication",
        operatingSystem: "Web",
        inLanguage: "es",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description:
            "Lista del mandado por voz gratuita con salas QR en vivo",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "¿Cómo funciona la lista del mandado por voz en ZipList?",
            acceptedAnswer: {
              "@type": "Answer",
              text: 'Dices todos tus ingredientes de corrido (ej. "jitomates, cebolla, cilantro, aguacate, tortillas, leche"). ZipList los organiza automáticamente en filas limpias con etiquetas de despensa.',
            },
          },
          {
            "@type": "Question",
            name: "¿Podemos usar la misma lista mi pareja y yo en el súper?",
            acceptedAnswer: {
              "@type": "Answer",
              text: '¡Sí! Presionas "Compartir QR" y tu pareja escanea el código con su cámara. Ambos teléfonos se sincronizan al instante en vivo sin tener que crear cuentas ni contraseñas.',
            },
          },
          {
            "@type": "Question",
            name: "¿Tengo que descargar una app de la App Store?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No necesitas descargar nada ni crear cuenta. Funciona directamente en Safari o Chrome y puedes guardarlo como app en tu pantalla de inicio en 1 toque.",
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
    hreflangEn: "https://ziplist.app/for/groceries",
    hreflangEs: canonicalUrl,
  }}
/>
