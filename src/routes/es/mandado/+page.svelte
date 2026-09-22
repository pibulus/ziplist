<script>
  /* A vertical: it talks ABOUT the app and sends people to it. It does NOT
     render the app. All six SEO routes used to mount MainContainer, so every
     one of them shipped byte-identical visible text — six URLs, one page, and
     nothing for a crawler to tell apart.

     The FAQ below is the same copy that was already in this route's schema.
     It was written and then never rendered; one array now feeds both the page
     and the markup, which is also what Google's FAQPage rules require. */
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/es/mandado";
  const title =
    "Lista del Mandado y Súper por Voz — Sin Registrar Cuentas | ZipList";
  const description =
    "Crea tu lista del mandado dictando por voz. Agrega jitomate, aguacate y tortillas sin escribir. Salas QR compartidas en vivo para ir al súper en pareja sin registrarse.";
  const heading = "Lista del Mandado y Súper por Voz";

  const faqs = [
    {
      q: "¿Cómo funciona la lista del mandado por voz en ZipList?",
      a: 'Dices todos tus ingredientes de corrido (ej. "jitomates, cebolla, cilantro, aguacate, tortillas, leche"). ZipList los organiza automáticamente en filas limpias con etiquetas de despensa.',
    },
    {
      q: "¿Podemos usar la misma lista mi pareja y yo en el súper?",
      a: '¡Sí! Presionas el botón "QR this list" y tu pareja escanea el código con su cámara. Ambos teléfonos se sincronizan al instante en vivo sin tener que crear cuentas ni contraseñas.',
    },
    {
      q: "¿Tengo que descargar una app de la App Store?",
      a: "No necesitas descargar nada ni crear cuenta. Funciona directamente en Safari o Chrome y puedes guardarlo como app en tu pantalla de inicio en 1 toque.",
    },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "ZipList Lista del Mandado por Voz",
        url: "https://ziplist.app/es/mandado",
        image: "https://ziplist.app/og-card.png",
        description:
          "Crea tu lista del mandado dictando por voz. Agrega jitomate, aguacate y tortillas sin escribir. Salas QR compartidas en vivo para ir al súper en pareja sin registrarse.",
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
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  // Assembled here rather than inline in markup: a literal `<script>` in a
  // template makes svelte-eslint-parser read the rest of the file as JS.
  const jsonLdScript =
    `<script type="application/ld+json">${JSON.stringify(structuredData)}` +
    // The escape stops this literal closing the module block it lives in.
    // eslint-disable-next-line no-useless-escape
    `<\/script>`;
</script>

<svelte:head>
  <!-- Built from module constants above; no user input reaches it. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html jsonLdScript}
</svelte:head>

<VerticalPage
  {title}
  {description}
  {heading}
  {faqs}
  canonical={canonicalUrl}
  faqHeading={"Preguntas frecuentes"}
  ctaLabel={"Abrir ZipList"}
  ogLocale={"es_LA"}
  hreflangEn={"https://ziplist.app/for/groceries"}
  hreflangEs={canonicalUrl}
/>
