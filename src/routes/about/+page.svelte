<script>
  import PageLayout from "$lib/components/layout/PageLayout.svelte";
  import Mascot from "$lib/components/ui/Mascot.svelte";

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

<PageLayout
  {title}
  {description}
  canonical={canonicalUrl}
  hreflangEs={null}
  listFirst={true}
>
  <article class="zl-about">
    <header class="zl-about-head">
      <div class="zl-about-mascot">
        <Mascot interactive={false} aura={false} />
      </div>
      <h1>How ZipList works</h1>
      <p class="zl-about-lede">
        Say the thing, and it's on the list. That's the whole trick.
      </p>
    </header>

    <section class="zl-about-steps" aria-label="The three steps">
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

    <section class="zl-about-not" aria-labelledby="zl-not-title">
      <h2 id="zl-not-title">What it doesn't do</h2>
      <p>
        No account. No sign-up. No upsell to use it. Lists live on the device,
        not on somebody's server. There are no due dates, no streaks and nothing
        keeping score — the list is finished when the things are done, not when
        an app says so.
      </p>
    </section>

    <section class="zl-about-faq" aria-labelledby="zl-faq-title">
      <h2 id="zl-faq-title">Questions people actually ask</h2>
      <dl>
        {#each faqs as faq (faq.q)}
          <div class="zl-faq-item">
            <dt>{faq.q}</dt>
            <dd>{faq.a}</dd>
          </div>
        {/each}
      </dl>
    </section>

    <p class="zl-about-cta-row">
      <a class="zl-about-cta" href="/">Talk a list</a>
    </p>

    <p class="zl-about-colophon">
      Made by <a
        href="https://madebypablo.app"
        target="_blank"
        rel="noopener noreferrer">Pablo</a
      > in Melbourne.
    </p>
  </article>
</PageLayout>

<style>
  /* Reads as one column of prose on the cream ground the rest of the app
     uses — no second card language, no new surface. */
  .zl-about {
    width: 100%;
    max-width: 44rem;
    margin: 0 auto;
    color: var(--zl-text-color-primary, #1e1714);
    text-align: left;
  }

  .zl-about-head {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .zl-about-mascot {
    width: 84px;
    margin: 0 auto 0.75rem;
  }

  .zl-about h1 {
    font-size: clamp(1.7rem, 4vw + 1rem, 2.4rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0 0 0.5rem;
  }

  .zl-about-lede {
    font-size: clamp(1rem, 1vw + 0.9rem, 1.15rem);
    line-height: 1.5;
    margin: 0;
    color: color-mix(
      in srgb,
      var(--zl-text-color-primary, #1e1714) 78%,
      transparent
    );
  }

  .zl-about h2 {
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    margin: 0 0 0.35rem;
  }

  .zl-about p,
  .zl-about dd {
    line-height: 1.6;
    color: color-mix(
      in srgb,
      var(--zl-text-color-primary, #1e1714) 82%,
      transparent
    );
  }

  .zl-about-steps ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1.75rem;
  }

  .zl-about-steps li {
    position: relative;
    padding-left: 3rem;
  }

  /* The numeral is the only place the brand yellow appears on this page.
     One flat CTA colour per screen, and the button below is the CTA — so
     these sit at the accent's quieter weight rather than competing. */
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

  .zl-about-not,
  .zl-about-faq {
    margin-top: 2.5rem;
    padding-top: 1.75rem;
    border-top: 1.5px solid
      color-mix(in srgb, var(--zl-text-color-primary, #1e1714) 12%, transparent);
  }

  .zl-about-faq dl {
    margin: 1.25rem 0 0;
    display: grid;
    gap: 1.25rem;
  }

  .zl-about-faq dt {
    font-weight: 800;
    margin-bottom: 0.25rem;
  }

  .zl-about-faq dd {
    margin: 0;
  }

  .zl-about-cta-row {
    margin: 2.5rem 0 0;
    text-align: center;
  }

  /* The same flat brand yellow the record button wears, so the page ends on
     the control it is describing. */
  .zl-about-cta {
    display: inline-block;
    background: var(--zl-cta-color, #ffb000);
    color: #1e1714;
    font-weight: 800;
    font-size: 1.05rem;
    text-decoration: none;
    padding: 0.8rem 2rem;
    border-radius: 999px;
    box-shadow: 0 4px 14px
      color-mix(in srgb, var(--zl-cta-color, #ffb000) 45%, transparent);
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .zl-about-cta:active {
    transform: scale(0.96);
  }

  .zl-about-colophon {
    margin: 1.5rem 0 0;
    text-align: center;
    font-size: 0.8rem;
    opacity: 0.7;
  }

  @media (prefers-reduced-motion: reduce) {
    .zl-about-cta {
      transition: none;
    }
  }
</style>
