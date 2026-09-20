<script>
  /* A use-case page: it describes one thing people do with ZipList and sends
     them to the app. It does not render the app. */
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/for/gigs";
  const title = "Band Load-In and Gear Checklist by Voice | ZipList";
  const description =
    "The gear list you check at 2am in a loading dock. Pedals, leads, the spare nine-volt, gaffer, the merch float. Share it live with the rest of the band. No accounts.";

  /* One array, two destinations: these questions are rendered on the page AND
     fed to the FAQPage markup. Google wants the answers visible, and a single
     source is the only way the two cannot drift apart. */
  const faqs = [
    {
      q: "Can the whole band see one list?",
      a: "Yes. Make it live, then let each phone scan the code with “QR this list”. Everyone is on the same list and every tick shows on the other phones.",
    },
    {
      q: "Do the others need accounts or the app installed?",
      a: "Neither. It opens in the browser they already have, with nothing to sign up for.",
    },
    {
      q: "Does it work in a venue with no reception?",
      a: "The list opens and ticks off offline. Adding items by voice needs a connection, so it is worth talking the list in before you get to the venue.",
    },
    {
      q: "Can I keep a standard gear list?",
      a: "Yes, and reuse it. Lists sit there until cleared, so the load-in list from the last gig is the one waiting at the next.",
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
  heading={"Load-in lists, for bands"}
  lede={"Pedals, leads, the spare nine-volt, gaffer, the merch float. The list you check at 2am in a loading dock with one hand full of cable."}
  currentUse={"gigs"}
>
  <section class="zl-prose-section">
    <h2>Gear lists are always read in the dark</h2>
    <p>
      Usually while holding something. Saying it is easier than typing in a
      loading dock, and ticking a big box with a thumb is easier than both.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>The whole band on one list</h2>
    <p>
      Share it live and everyone sees what is already in the van. The drummer
      ticks the hardware bag, you tick the pedalboard, nobody drives back for
      the stands. One list on every phone, rather than four screenshots in a
      group chat.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Pack-down is the same list, backwards</h2>
    <p>
      Untick as it goes back in the case, and whatever is still ticked at the
      end is sitting on the stage floor. That is the one that saves a cable.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Keep the one that works</h2>
    <p>
      The list stays until it is cleared, so a good load-in list survives to the
      next gig. No date on it, no reminder about it, and nothing asking why
      there has not been a show in five weeks.
    </p>
  </section>
</VerticalPage>
