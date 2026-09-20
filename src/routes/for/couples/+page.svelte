<script>
  /* A vertical: it talks ABOUT the app and sends people to it. It does NOT
     render the app. All six SEO routes used to mount MainContainer, so every
     one of them shipped byte-identical visible text — six URLs, one page, and
     nothing for a crawler to tell apart.

     The FAQ below is the same copy that was already in this route's schema.
     It was written and then never rendered; one array now feeds both the page
     and the markup, which is also what Google's FAQPage rules require. */
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/for/couples";
  const title =
    "Shared Grocery & Chores List App for Couples — Instant QR Sync | ZipList";
  const description =
    "Real-time shared checklist for couples. Plan dinner, split supermarket aisles, and pack for trips together with instant QR pairing and zero accounts or signups.";
  const heading = "Shared Grocery & Chores List App for Couples";

  const faqs = [
    {
      q: "How do couples share a list in ZipList without accounts?",
      a: 'Tap "QR this list" to generate a live room. Your partner scans it with their phone camera and you are instantly connected in real-time. No emails, no passwords, no logins.',
    },
    {
      q: "Can we tick off items simultaneously at opposite ends of the supermarket?",
      a: "Yes! Updates sync across both phones in sub-10 milliseconds via WebSockets. When your partner grabs oat milk in aisle 1, it checks off on your phone in aisle 8 immediately.",
    },
    {
      q: "Can we use voice dictation together?",
      a: "Either person can tap the microphone button and dictate grocery items, packing gear, or weekend chores. ZipList parses spoken phrases into discrete checklist items automatically.",
    },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "ZipList Shared Lists for Couples",
        url: "https://ziplist.app/for/couples",
        image: "https://ziplist.app/og-card.png",
        description:
          "Real-time shared checklist for couples. Plan dinner, split supermarket aisles, and pack for trips together with instant QR pairing and zero accounts or signups.",
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        inLanguage: "en",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Free shared real-time lists with instant QR pairing",
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
  faqHeading={"Questions people ask"}
  ctaLabel={"Talk a list"}
  ogLocale={"en_US"}
  hreflangEn={canonicalUrl}
  hreflangEs={"https://ziplist.app/es/parejas"}
/>
