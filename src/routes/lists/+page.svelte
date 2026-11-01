<script>
  import VerticalPage from "$lib/components/layout/VerticalPage.svelte";

  const canonicalUrl = "https://ziplist.app/lists";
  const title = "The Infinity of Lists — Why Lists Feel Good | ZipList";
  const description =
    "Why humans have written lists for a thousand years: Sei Shōnagon, Leonardo, Franklin and Joan Didion, plus the psychology of why ticking something off feels so good.";

  /* Four small facts, kept short enough to remember and tell someone else. */
  const facts = [
    {
      who: "Sei Shōnagon, 1002",
      what: "Wrote lists of “Elegant Things” and “Depressing Things” — duck eggs, shaved ice in a new silver bowl, snow on plum blossoms.",
    },
    {
      who: "Leonardo da Vinci, 1490s",
      what: "Filled pocket notebooks with errands beside impossible questions: measure Milan, describe a woodpecker's tongue, learn to square a triangle.",
    },
    {
      who: "Benjamin Franklin, 1726",
      what: "Put thirteen virtues on one grid against seven days, and asked himself each morning what good he would do, each night what good he had done.",
    },
    {
      who: "Joan Didion, 1979",
      what: "Taped a packing list inside a closet door so she could leave for a story without thinking: two skirts, a typewriter, bourbon.",
    },
  ];

  const faqs = [
    {
      q: "Why do lists feel good to finish?",
      a: "Unfinished tasks keep a small amount of attention running in the background. Writing one down as a real plan is enough to release that attention, and keeping the finished item visible makes the progress feel real rather than imagined.",
    },
    {
      q: "Does ZipList keep finished items?",
      a: "Yes. Ticking something moves it into a done tray instead of deleting it, so the day's work stays visible. Clear and Reset are there when the tray has served its purpose.",
    },
    {
      q: "Is there a right way to keep a list?",
      a: "One that opens fast and can be trusted. If a list is slow, hidden, or might lose things, the mind keeps carrying the items anyway and none of the relief arrives.",
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

  // Assembled here rather than inline in markup: a literal <script> in a
  // component template makes svelte-eslint-parser read the rest of the file
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
  hreflangEn={canonicalUrl}
  heading="The infinity of lists"
  lede="Humanity makes lists because humanity does not want to die."
  faqHeading="Why this works"
  currentUse="lists"
  moreHeading="More about the thing"
>
  <section class="zl-prose-section" aria-label="Why lists exist">
    <h2>Order against chaos</h2>
    <p>
      Umberto Eco argued the list is where culture starts. When something is too
      big to hold — the stars, an empire, a Tuesday — the mind cannot grasp it
      whole, so it names the pieces one at a time. Enumeration is how a person
      gets a grip.
    </p>
    <p>
      He also had a darker answer for why we never stop. Lists suggest
      continuation. A list is a note to a future self, and writing one is a
      quiet claim that there will be a future self to read it.
    </p>
  </section>

  <section class="zl-prose-section" aria-label="Lists people have loved">
    <h2>The good ones are never task lists</h2>
    <p>
      A thousand years of lists survive, and almost none of them are
      productivity systems. They are inventories of attention: what a person
      noticed, wanted, intended, feared.
    </p>
    <ul class="zl-facts">
      {#each facts as fact (fact.who)}
        <li>
          <span class="zl-fact-who">{fact.who}</span>
          <span class="zl-fact-what">{fact.what}</span>
        </li>
      {/each}
    </ul>
  </section>

  <section class="zl-prose-section" aria-label="The psychology of ticking">
    <h2>Why the tick lands</h2>
    <p>
      An unfinished task keeps a thread of attention alive. Writing it down as a
      real plan is enough to let the thread go — that is the relief felt the
      moment an item is captured, before anything is done.
    </p>
    <p>
      Finishing it is the other half. Done items that vanish delete the evidence
      of effort; done items that stay visible turn a day into something with
      shape. It is the difference between a list of what is left and a record of
      what happened.
    </p>
    <p>
      There is one condition on all of it: the list has to be trustworthy. If it
      opens slowly, hides things, or might lose them, the mind keeps carrying
      every item anyway and none of the quiet arrives.
    </p>
  </section>

  <section class="zl-prose-section" aria-label="What ZipList does with this">
    <h2>What that looks like here</h2>
    <ul>
      <li>
        <strong>Voice first.</strong> Speaking a list is faster than typing one, and
        the shorter the distance between remembering and writing, the more the head
        lets go.
      </li>
      <li>
        <strong>A done tray, not a bin.</strong> Ticked items stay where they can
        be seen, until Clear or Reset says otherwise.
      </li>
      <li>
        <strong>No dates, no streaks, no nagging.</strong> Nothing turns red. A list
        is a list of things, not a system keeping score.
      </li>
      <li>
        <strong>Shared live lists.</strong> Two people, one list, changes landing
        as they happen — the shopping list that updates while someone is already at
        the shop.
      </li>
      <li>
        <strong>Four words to carry it.</strong> No account. A passphrase opens the
        same lists on any screen with a connection.
      </li>
    </ul>
  </section>
</VerticalPage>

<style>
  .zl-facts {
    display: grid;
    gap: 0.75rem;
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
  }

  .zl-facts li {
    background: var(--zl-card-cream, #fbf1e4);
    border: 2px solid var(--zl-ink, #1e1714);
    border-radius: 14px;
    padding: 0.7rem 0.85rem;
  }

  .zl-fact-who {
    display: block;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ad2770;
    margin-bottom: 0.15rem;
  }

  .zl-fact-what {
    display: block;
    font-size: 0.92rem;
    line-height: 1.45;
  }
</style>
