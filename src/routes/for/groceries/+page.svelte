<script>
  /* A use-case page: it describes one thing people do with ZipList and sends
     them to the app. It does not render the app. */
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/for/groceries";
  const title =
    "Voice Grocery List App \u2014 Talk Your Shopping List | ZipList";
  const description =
    "Say the shopping list on the way out the door and it is waiting at the supermarket. Share it live so whoever is in aisle four ticks things off too. No account.";

  /* One array, two destinations: these questions are rendered on the page AND
     fed to the FAQPage markup. Google wants the answers visible, and a single
     source is the only way the two cannot drift apart. */
  const faqs = [
    {
      q: "Does it work in the supermarket, where the signal is terrible?",
      a: "The list does. It lives on the phone, so it opens and ticks off with no connection at all. Turning speech into new items is the one part that needs signal, since that happens off the phone.",
    },
    {
      q: "Can two of us shop the same list at once?",
      a: "Yes. Open the list, tap “QR this list”, and the other phone scans it. From then on both phones show the same list and every tick appears on the other one.",
    },
    {
      q: "Do I have to install something?",
      a: "No. It runs in the browser, and it can be added to a home screen afterwards if you want it sitting with your other apps.",
    },
    {
      q: "Where does the list go when I am done?",
      a: "Nowhere, unless you clear it. Lists stay on the device rather than on a server, which is also why there is nothing to log into.",
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
  heading={"The shopping list you talk into"}
  lede={"Hands full, trolley moving, and the list is already written. You said it on the way out the door."}
  currentUse={"groceries"}
  hreflangEn={canonicalUrl}
  hreflangEs="https://ziplist.app/es/mandado"
>
  <section class="zl-prose-section">
    <h2>One breath, a whole shop</h2>
    <p>
      Oat milk, sourdough, the good coffee, something for dinner Thursday, bin
      bags. It goes in as one sentence and comes out as separate lines, already
      split, in the order it fell out of your head.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Two trolleys, one list</h2>
    <p>
      Send it live and the other phone sees every tick. Whoever reaches the
      tinned tomatoes first takes them off, and nobody comes home with three
      jars of capers. No account between you — the link is the whole handshake.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>The aisle is a bad place to type</h2>
    <p>
      That is rather the point. The list is already on the phone, so it opens
      with no signal and no waiting, and adding one more thing takes a sentence
      instead of a keyboard and both thumbs.
    </p>
  </section>
</VerticalPage>
