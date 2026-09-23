<script>
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/about";
  const title = "How ZipList Works — Voice Checklists, No Account | ZipList";
  const description =
    "How the talkable list works: say it, it sorts itself, tick it off. No account, no dates, no streaks. Lists live on your device.";

  /* The FAQ is written ONCE, here, and rendered into both the page and the
     schema below. Google's FAQPage guidelines require the answers to be
     visible on the page that carries the markup — generating both from one
     array is the only way they cannot drift apart. */
  const faqs = [
    {
      q: "Do I need an account?",
      a: "No. There is no sign-up, no login and no email box. The app opens and works.",
    },
    {
      q: "Where do my lists live?",
      a: "On the device, in its own storage. They are not held on a server, which is also why clearing site data clears them.",
    },
    {
      q: "How does sharing work?",
      a: "Two ways. A copy is a link holding the list as it is now, frozen at the moment it was sent. A live list is a room two phones can tick at the same time, and it carries a four-word phrase that opens the same room on another device.",
    },
    {
      q: "Does it work without signal?",
      a: "The lists do. They are on the device, so they open and edit offline, and the app can be installed to a home screen. Turning speech into items needs a connection, since that part happens away from the phone.",
    },
    {
      q: "What does it cost?",
      a: "Nothing. There is a one-off supporter pass for people who want to chip in, and it unlocks nothing that was previously withheld.",
    },
    {
      q: "Can it do reminders and due dates?",
      a: "No, and that is deliberate. No dates, no streaks, no nagging. It is a list of things, not a system that keeps score.",
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
  // component's template makes svelte-eslint-parser read the rest of the file
  // as JS and silently drops the route from linting.
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
  heading="How ZipList works"
  lede="Say the thing, and it's on the list."
  faqHeading="Questions people actually ask"
  currentUse="about"
  moreHeading="What people talk into it"
>
  <section class="zl-prose-section" aria-label="The three steps">
    <ol>
      <li>
        <span class="zl-step-n" aria-hidden="true">1</span>
        <h2>One breath is enough</h2>
        <p>
          Milk, sourdough, the thing for the sink, call Mum. It all goes in as
          one sentence, at the speed of remembering.
        </p>
      </li>
      <li>
        <span class="zl-step-n" aria-hidden="true">2</span>
        <h2>It sorts itself out</h2>
        <p>
          The sentence arrives as separate rows, already split. Saying that
          something is done ticks it off, rather than adding it again.
        </p>
      </li>
      <li>
        <span class="zl-step-n" aria-hidden="true">3</span>
        <h2>Then it's just a list</h2>
        <p>
          Tap to tick. Drag to reorder. Flick sideways between lists. Send a
          copy, or open it live so two phones tick the same boxes.
        </p>
      </li>
    </ol>
  </section>

  <section class="zl-prose-section" aria-labelledby="zl-not-title">
    <h2 id="zl-not-title">What it doesn't do</h2>
    <p>
      No account. No sign-up. No upsell to use it. Lists live on the device, not
      on somebody's server. There are no due dates, no streaks and nothing
      keeping score — the list is finished when the things are done, not when an
      app says so.
    </p>
  </section>
</VerticalPage>

<style>
  /* Only what the shared chassis does not already provide: the numbered
     steps. Everything else — type, FAQ, CTA — comes from VerticalPage. */
  .zl-prose-section ol {
    list-style: none;
    margin: 1.25rem 0 0;
    padding: 0;
    display: grid;
    gap: 1.75rem;
  }

  .zl-prose-section li {
    position: relative;
    padding-left: 3rem;
  }

  .zl-step-n {
    position: absolute;
    left: 0;
    top: -0.15rem;
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 0.95rem;
    background: color-mix(
      in srgb,
      var(--zl-cta-color, #ffb000) 26%,
      transparent
    );
    color: #1e1714;
  }
</style>
