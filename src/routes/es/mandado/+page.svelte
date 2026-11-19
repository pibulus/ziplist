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
    "Lista del Mandado y Súper por Voz · Sin Registrar Cuentas | ZipList";
  const description =
    "Crea la lista del mandado dictando por voz. Agrega jitomate, aguacate y tortillas sin escribir. Salas QR compartidas en vivo para ir al súper en pareja sin registrarse.";
  const heading = "Lista del Mandado y Súper por Voz";

  const faqs = [
    {
      q: "¿Cómo funciona la lista del mandado por voz en ZipList?",
      a: 'Dices los ingredientes de corrido (por ejemplo: "jitomates, cebolla, cilantro, aguacate, tortillas, leche") y cada uno aparece en su propia fila listo para tachar.',
    },
    {
      q: "¿Podemos usar la misma lista dos personas en el súper?",
      a: "Sí. Toca Compartir en la lista, elige iniciar lista en vivo y la otra persona escanea el código QR o escribe las cuatro palabras de la sala. Ambos teléfonos ven cada cambio al momento, sin cuentas ni contraseñas.",
    },
    {
      q: "¿Hace falta descargar una app de la tienda?",
      a: "No hace falta descargar nada ni crear cuenta. Abre directo en Safari o Chrome y también se puede guardar en la pantalla de inicio.",
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
  lede={"Dila saliendo de casa y táchala en el pasillo con una sola mano."}
  {faqs}
  canonical={canonicalUrl}
  faqHeading={"Preguntas frecuentes"}
  ctaLabel={"Abrir ZipList"}
  ctaHref={"/es"}
  currentUse={"mandado"}
  moreHeading={"Más formas de usar ZipList"}
  ogLocale={"es_LA"}
  hreflangEn={"https://ziplist.app/for/groceries"}
  hreflangEs={canonicalUrl}
>
  <section class="zl-prose-section">
    <h2>Todo el mandado en una sola frase</h2>
    <p>
      Jitomate, cebolla, aguacate, tortillas, café y bolsas para la basura. Se
      dicta de corrido como sale de la cabeza y aterriza separado renglón por
      renglón, sin frenar a teclear.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Dos carritos, una misma lista</h2>
    <p>
      Al abrir una sala en vivo, el otro teléfono ve cada palomita al momento.
      Quien pasa primero por la verdura la tacha y nadie regresa a casa con dos
      paquetes de lo mismo.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Funciona aunque adentro no haya señal</h2>
    <p>
      Las listas guardadas viven en el teléfono, así que abren y se tachan aún
      en el fondo del supermercado donde los datos desaparecen.
    </p>
  </section>
</VerticalPage>
