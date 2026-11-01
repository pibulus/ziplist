<script>
  import { MainContainer } from "$lib/components/mainPage";
  import { PRICING } from "$lib/config/pricing.js";

  const canonicalUrl = "https://ziplist.app/";
  const title = "ZipList — Talk it into a list. Tick it off.";
  const description =
    "Talk groceries, errands, and chores into a checklist. Tick things off together in a live shared list, or type items by hand. Free to start, no account.";

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
        description:
          "Free voice checklists, 3 lists, and one live shared list at a time",
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
          "ZipList Passport, A$29 for a year — 12 lists, private device sync, and 12 live shared lists at once",
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
