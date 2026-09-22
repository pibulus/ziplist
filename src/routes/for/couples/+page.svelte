<script>
  /* A use-case page: it describes one thing people do with ZipList and sends
     them to the app. It does not render the app. */
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/for/couples";
  const title =
    "Shared List for Two People \u2014 One List, Two Phones | ZipList";
  const description =
    "A list both of you can see and tick off, live, on two phones. No shared account and no app to talk anyone into installing. Scan a code and you are on the same list.";

  /* One array, two destinations: these questions are rendered on the page AND
     fed to the FAQPage markup. Google wants the answers visible, and a single
     source is the only way the two cannot drift apart. */
  const faqs = [
    {
      q: "Do we need accounts?",
      a: "No. Neither of you. There is no sign-up anywhere in this, which is also why there is no shared login to argue about.",
    },
    {
      q: "Can we both tick things off at the same time?",
      a: "Yes, that is what a live list is for. Both phones hold the same list and each tick shows up on the other.",
    },
    {
      q: "What if they do not want another app?",
      a: "They do not need one. It opens in whatever browser is already on their phone.",
    },
    {
      q: "Does it stay shared forever?",
      a: "Only while you want it to. Live sharing can be stopped from the list header, and the list goes back to being yours alone.",
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
  heading={"One list, two phones"}
  lede={"The list your person can actually see. No account between you, and nothing to talk them into installing first."}
  currentUse={"couples"}
  hreflangEn={canonicalUrl}
  hreflangEs="https://ziplist.app/es/parejas"
>
  <section class="zl-prose-section">
    <h2>Scanning a code is the whole setup</h2>
    <p>
      Open the list, tap “QR this list”, they point a camera at it. No invite
      email, no “create an account to continue”, no standing there holding a
      phone while someone else finishes signing up.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Both of you, at the same time</h2>
    <p>
      They tick the milk while you are still in the car park and it goes
      through. Add something from the tram and it is on their screen before you
      get home. Same list, both ends, nothing to refresh.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Or just send a copy</h2>
    <p>
      Not everything needs to be live. A copy is a link holding the list exactly
      as it is now — good for handing someone the shopping and then forgetting
      about it.
    </p>
  </section>

  <section class="zl-prose-section">
    <h2>Four words instead of a link</h2>
    <p>
      Every live list also has a four-word phrase. It can be said down the
      phone, and the list opens on the other device. Nobody has to go looking
      for the message you sent.
    </p>
  </section>
</VerticalPage>
