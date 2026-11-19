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
    "Listas Compartidas para Parejas en Vivo · Cero Cuentas | ZipList";
  const description =
    "La lista de compras y pendientes compartida en vivo para dos teléfonos. Divide los pasillos del súper, planea viajes y tacha juntos por código QR sin cuentas.";
  const heading = "Listas Compartidas para Parejas en Vivo";

  const faqs = [
    {
      q: "¿Cómo compartimos una lista en pareja sin crear cuentas?",
      a: "Toca Compartir en la lista, elige iniciar lista en vivo y muestra el código QR para escanearlo con la cámara del otro teléfono. Cero correos, cero registros y cero contraseñas.",
    },
    {
      q: "¿Podemos tachar pendientes al mismo tiempo en distintos pasillos?",
      a: "Sí. Ambos teléfonos comparten la misma lista abierta: cuando alguien tacha la leche en un pasillo, desaparece de los pendientes en la otra pantalla enseguida.",
    },
    {
      q: "¿Podemos dictar por voz desde cualquiera de los dos teléfonos?",
      a: "Sí. Cualquiera de los dos puede tocar el micrófono y dictar compras, pendientes de la casa o cosas para el viaje, y aparecen como filas separadas para ambos.",
    },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: title,
        url: canonicalUrl,
        description,
        inLanguage: "es",
        isPartOf: {
          "@type": "WebSite",
          name: "ZipList",
          url: "https://ziplist.app",
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
  lede={"Una sola lista en dos teléfonos, sin cuentas compartidas ni aplicaciones que instalar primero."}
  {faqs}
  canonical={canonicalUrl}
  faqHeading={"Preguntas frecuentes"}
  ctaLabel={"Abrir ZipList"}
  ctaHref={"/es"}
  currentUse={"parejas"}
  moreHeading={"Más formas de usar ZipList"}
  ogLocale={"es_LA"}
  hreflangEn={"https://ziplist.app/for/couples"}
  hreflangEs={canonicalUrl}
>
  <section class="zl-prose-section">
    <h2>Escanear el código es toda la configuración</h2>
    <p>
      Abre la lista, inicia la sala en vivo y apunta la otra cámara al código QR
      o dicta las cuatro palabras de acceso. Sin invitaciones por correo ni
      pantallas de registro a mitad del pasillo.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Los dos al mismo tiempo</h2>
    <p>
      Uno agrega lo que falta desde el camión y el otro lo ve antes de llegar a
      la caja. Cada elemento tachado se refleja en ambos teléfonos sin recargar.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Cuando termina, vuelve a ser local</h2>
    <p>
      Al cerrar la sala en vivo desde Compartir, la lista deja de compartirse y
      se queda guardada tranquilamente en el teléfono.
    </p>
  </section>
</VerticalPage>
