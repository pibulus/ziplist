<script>
  /* A use-case page: it describes one thing people do with ZipList and sends
     them to the app. It does not render the app. */
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/for/packing";
  const title = "Voice Packing List \u2014 Say It Before You Forget | ZipList";
  const description =
    "The packing list you make out loud, at the door, as things occur to you. Chargers, passport, the good jumper. Nothing to sign up for.";

  /* One array, two destinations: these questions are rendered on the page AND
     fed to the FAQPage markup. Google wants the answers visible, and a single
     source is the only way the two cannot drift apart. */
  const faqs = [
    {
      q: "Can I keep a list to reuse next trip?",
      a: "Yes. Lists stay until you clear them, so the camping one can sit there all year and be waiting next summer.",
    },
    {
      q: "Can two of us pack off the same list?",
      a: "Share it live — tap “QR this list” and let the other phone scan the code. Then both of you are ticking the same boxes.",
    },
    {
      q: "Does it work on a plane, or anywhere with no signal?",
      a: "The list opens and ticks off offline, since it is on the phone rather than a server. Adding new items by voice is the part that needs a connection.",
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
        inLanguage: "en",
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
  {faqs}
  canonical={canonicalUrl}
  heading={"The packing list you make out loud"}
  lede={"Said at the door as it occurs to you, not typed at midnight the day before."}
  currentUse={"packing"}
>
  <section class="zl-prose-section">
    <h2>Packing lists arrive in the wrong order</h2>
    <p>
      Charger. Passport. The good jumper. Toothbrush, obviously. That adaptor
      for the plugs. They turn up one at a time, usually while you are doing
      something else — so say them as they land and let the list catch them.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>The one you always forget</h2>
    <p>
      Tick things as they go in the bag, and whatever is left at the bottom is
      the thing you would have remembered on the plane. Last trip's list is
      still there too, which saves inventing it twice.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Festivals and small children</h2>
    <p>
      Both are packing with higher stakes. Gaffer tape, wet wipes, a second pair
      of socks, more water than seems reasonable. Share it live and whoever is
      loading the car ticks off their half.
    </p>
  </section>
</VerticalPage>
