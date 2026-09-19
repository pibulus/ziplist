<script>
  import { MainContainer } from "$lib/components/mainPage";

  const canonicalUrl = "https://ziplist.app/for/groceries";
  const title =
    "Hands-Free Voice Grocery List App — Supermarket Shopping | ZipList";
  const description =
    "Build and tick off grocery shopping lists by voice. Speak ingredients hands-free while walking aisles. Live QR rooms let your partner tick off aisle 4 in real-time with zero signups.";

  // Assembled here rather than inline in <svelte:head>: a literal
  // `<script>` in markup makes svelte-eslint-parser treat the rest of
  // the file as JS, which silently dropped this route from linting.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "ZipList Voice Grocery & Shopping Lists",
        url: canonicalUrl,
        image: "https://ziplist.app/og-card.png",
        description: description,
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
        mainEntity: [
          {
            "@type": "Question",
            name: "How does hands-free voice grocery shopping work in ZipList?",
            acceptedAnswer: {
              "@type": "Answer",
              text: 'You speak all your pantry items in one breath (e.g. "oat milk, sourdough, avocados, olive oil, coffee beans"). ZipList automatically structures them into distinct checklist rows with pantry tags.',
            },
          },
          {
            "@type": "Question",
            name: "Can my partner and I shop the supermarket together on different phones?",
            acceptedAnswer: {
              "@type": "Answer",
              text: 'Yes! Tap "Share QR" and let your partner scan the code. Both phones sync instantly in sub-10ms via WebSockets with zero account creation or logins.',
            },
          },
          {
            "@type": "Question",
            name: "Do I need to install an app from the App Store?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No app download or account required. It runs instantly in Safari or Chrome, and can be installed as an offline-capable PWA to your home screen in 1 tap.",
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
    hreflangEs: "https://ziplist.app/es/mandado",
  }}
/>
