<script>
  /* A vertical: it talks ABOUT the app and sends people to it. It does NOT
     render the app. All six SEO routes used to mount MainContainer, so every
     one of them shipped byte-identical visible text — six URLs, one page, and
     nothing for a crawler to tell apart.

     The FAQ below is the same copy that was already in this route's schema.
     It was written and then never rendered; one array now feeds both the page
     and the markup, which is also what Google's FAQPage rules require. */
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/es/parejas";
  const title =
    "Listas Compartidas para Parejas en Vivo — Cero Cuentas ni Contraseñas | ZipList";
  const description =
    "La lista de compras y tareas compartida en tiempo real para parejas. Divide los pasillos del súper, planea viajes y haz el súper juntos con sincronización QR instantánea.";
  const heading = "Listas Compartidas para Parejas en Vivo";

  const faqs = [
    {
      q: "¿Cómo compartimos una lista en pareja sin crear cuentas?",
      a: 'Tocas el botón "QR this list" para crear una sala en vivo. Tu pareja escanea el código con su cámara y se conectan al instante en tiempo real. Cero correos, cero registros, cero contraseñas.',
    },
    {
      q: "¿Podemos tachar pendientes al mismo tiempo en extremos opuestos del supermercado?",
      a: "¡Sí! La sincronización toma menos de 10 milisegundos mediante WebSockets. Cuando tu pareja tacha la leche en el pasillo 1, se actualiza en tu pantalla en el pasillo 8 al instante.",
    },
    {
      q: "¿Podemos dictar por voz los dos?",
      a: "Cualquiera de los dos puede pulsar el micrófono y dictar las compras del súper, la maleta del viaje o las tareas de la casa. ZipList convierte el audio en elementos individuales al vuelo.",
    },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "ZipList Listas Compartidas para Parejas",
        url: "https://ziplist.app/es/parejas",
        image: "https://ziplist.app/og-card.png",
        description:
          "La lista de compras y tareas compartida en tiempo real para parejas. Divide los pasillos del súper, planea viajes y haz el súper juntos con sincronización QR instantánea.",
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
  hreflangEn={"https://ziplist.app/for/couples"}
  hreflangEs={canonicalUrl}
/>
