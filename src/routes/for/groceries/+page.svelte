<script>
  /* A vertical: it talks ABOUT the app and sends people to it. It does NOT
     render the app. All six SEO routes used to mount MainContainer, so every
     one of them shipped byte-identical visible text — six URLs, one page, and
     nothing for a crawler to tell apart.

     The FAQ below is the same copy that was already in this route's schema.
     It was written and then never rendered; one array now feeds both the page
     and the markup, which is also what Google's FAQPage rules require. */
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/for/groceries";
  const title =
    "Hands-Free Voice Grocery List App — Supermarket Shopping | ZipList";
  const description =
    "Build and tick off grocery shopping lists by voice. Speak ingredients hands-free while walking aisles. Live QR rooms let your partner tick off aisle 4 in real-time with zero signups.";
  const heading = "Hands-Free Voice Grocery List App";

  const faqs = [
    {
      q: "How does hands-free voice grocery shopping work in ZipList?",
      a: 'You speak all your pantry items in one breath (e.g. "oat milk, sourdough, avocados, olive oil, coffee beans"). ZipList automatically structures them into distinct checklist rows with pantry tags.',
    },
    {
      q: "Can my partner and I shop the supermarket together on different phones?",
      a: 'Yes! Tap "QR this list" and let your partner scan the code. Both phones sync instantly in sub-10ms via WebSockets with zero account creation or logins.',
    },
    {
      q: "Do I need to install an app from the App Store?",
      a: "No app download or account required. It runs instantly in Safari or Chrome, and can be installed as an offline-capable PWA to your home screen in 1 tap.",
    },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "ZipList Voice Grocery & Shopping Lists",
        url: "https://ziplist.app/for/groceries",
        image: "https://ziplist.app/og-card.png",
        description:
          "Build and tick off grocery shopping lists by voice. Speak ingredients hands-free while walking aisles. Live QR rooms let your partner tick off aisle 4 in real-time with zero signups.",
        applicationCategory: "ShoppingApplication",
        operatingSystem: "Web",
        inLanguage: "en",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Free voice grocery lists with live QR sharing",
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
  hreflangEs={"https://ziplist.app/es/mandado"}
/>
