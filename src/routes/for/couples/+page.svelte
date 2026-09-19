<script>
  import { MainContainer } from "$lib/components/mainPage";

  const canonicalUrl = "https://ziplist.app/for/couples";
  const title =
    "Shared Grocery & Chores List App for Couples — Instant QR Sync | ZipList";
  const description =
    "Real-time shared checklist for couples. Plan dinner, split supermarket aisles, and pack for trips together with instant QR pairing and zero accounts or signups.";

  // Assembled here rather than inline in <svelte:head>: a literal
  // `<script>` in markup makes svelte-eslint-parser treat the rest of
  // the file as JS, which silently dropped this route from linting.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "ZipList Shared Lists for Couples",
        url: canonicalUrl,
        image: "https://ziplist.app/og-card.png",
        description: description,
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
        mainEntity: [
          {
            "@type": "Question",
            name: "How do couples share a list in ZipList without accounts?",
            acceptedAnswer: {
              "@type": "Answer",
              text: 'Tap "Share QR" to generate a live room. Your partner scans it with their phone camera and you are instantly connected in real-time. No emails, no passwords, no logins.',
            },
          },
          {
            "@type": "Question",
            name: "Can we tick off items simultaneously at opposite ends of the supermarket?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes! Updates sync across both phones in sub-10 milliseconds via WebSockets. When your partner grabs oat milk in aisle 1, it checks off on your phone in aisle 8 immediately.",
            },
          },
          {
            "@type": "Question",
            name: "Can we use voice dictation together?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Either person can tap the microphone button and dictate grocery items, packing gear, or weekend chores. ZipList parses spoken phrases into discrete checklist items automatically.",
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
    ogLocale: "en_US",
    hreflangEn: canonicalUrl,
    hreflangEs: "https://ziplist.app/es/parejas",
  }}
/>
