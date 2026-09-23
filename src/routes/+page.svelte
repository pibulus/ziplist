<script>
  import { MainContainer } from "$lib/components/mainPage";
  import { PRICING } from "$lib/config/pricing.js";

  const canonicalUrl = "https://ziplist.app";
  const title = "ZipList — Talk it into a list. Tick it off.";
  const description =
    "A warm, tactile voice checklist for groceries, errands, packing, and chores. No dates, no streaks, no pressure.";

  // Assembled here rather than inline in <svelte:head>: a literal
  // `<script>` in markup makes svelte-eslint-parser treat the rest of
  // the file as JS, which silently dropped this route from linting.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ZipList",
    alternateName: "ZipList.app",
    url: canonicalUrl,
    image: "https://ziplist.app/og-card.png",
    description: description,
    applicationCategory: "UtilitiesApplication",
    applicationSubCategory: "Voice checklist and todo lists",
    operatingSystem: "Web",
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: PRICING.currency,
        description: "Free voice checklist creation and live QR rooms",
      },
      {
        "@type": "Offer",
        // Both of these used to be wrong where it matters most — this is the
        // machine-readable claim search engines quote. It said "unlimited
        // lists" (it is 12) and USD (Square charges AUD), so the advertised
        // price was a different currency from the one taken at checkout.
        price: String(PRICING.currentPrice),
        priceCurrency: PRICING.currency,
        description:
          "Lifetime Supporter Pass — 12 lists, live rooms, every device",
      },
    ],
    keywords:
      "voice checklist, grocery list, talk to list, hands-free list, live shared todo, tactile checklist, no account todo",
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
    hreflangEs: "https://ziplist.app/es",
  }}
/>
