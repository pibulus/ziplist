<script>
  /* A use-case page: it describes one thing people do with ZipList and sends
     them to the app. It does not render the app. */
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/for/moving";
  const title =
    "Moving House Checklist by Voice \u2014 No Spreadsheet | ZipList";
  const description =
    "Moving house without a spreadsheet. Talk in the bond, the boxes, the mail redirect and the bin night as each one occurs to you. Share it with whoever is helping.";

  /* One array, two destinations: these questions are rendered on the page AND
     fed to the FAQPage markup. Google wants the answers visible, and a single
     source is the only way the two cannot drift apart. */
  const faqs = [
    {
      q: "Can I keep a few lists going at once?",
      a: "Yes. Make as many as you need and flick sideways between them. They are colour-coded, so the kitchen one is not the admin one.",
    },
    {
      q: "Can I paste in a checklist I found somewhere?",
      a: "Yes — open the share tray and use “Paste things in”. A block of text arrives as separate rows rather than one long item.",
    },
    {
      q: "Will it nag me about dates?",
      a: "No. There are no due dates, no reminders and no streaks anywhere in it. It is a list of things, not a system keeping score of you.",
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
  heading={"Moving house without a spreadsheet"}
  lede={"The bond, the boxes, the mail redirect, the bin night you will absolutely forget. Talk them in as they occur to you."}
  currentUse={"moving"}
>
  <section class="zl-prose-section">
    <h2>Moving is a hundred small things</h2>
    <p>
      Almost none of which arrive at a convenient moment. The mail redirect
      turns up in the shower, the spare keys while carrying a lamp. A sentence
      is faster than a spreadsheet and it works with one hand.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Whoever is helping can see it too</h2>
    <p>
      Share the list live and the person with the van ticks off what is already
      loaded. Fewer phone calls from the kerb, and the same box does not get
      carried twice.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Separate lists for separate rooms</h2>
    <p>
      Or for before and after, or the old place and the new one. Flick sideways
      between them. No folders and no nesting, because a move is confusing
      enough already.
    </p>
  </section>
</VerticalPage>
