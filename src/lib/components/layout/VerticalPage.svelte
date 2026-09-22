<script>
  /* The prose-page chassis: /about and every SEO vertical wear it, so there
     is one set of type, one FAQ treatment and one CTA rather than six that
     drift. The app itself lives at / — these pages talk ABOUT it and send
     people there. */
  import PageLayout from "./PageLayout.svelte";
  import Mascot from "$lib/components/ui/Mascot.svelte";
  import { USES, useHref } from "$lib/content/uses.js";

  export let title;
  export let description;
  export let canonical;
  export let heading;
  export let lede = description;
  /** [{ q, a }] — rendered here AND fed to the page's FAQPage schema, from
      one array, because Google requires the answers to be on the page. */
  export let faqs = [];
  export let faqHeading = "Questions people ask";
  export let ctaLabel = "Talk a list";
  export let ctaHref = "/";
  export let ogLocale = "en_US";
  export let hreflangEn = null;
  export let hreflangEs = null;
  /** Slug of the current use page, so it is left out of the row below. */
  export let currentUse = null;
  export let moreHeading = "Other things people talk into it";

  $: otherUses = USES.filter((u) => u.slug !== currentUse);
</script>

<PageLayout
  {title}
  {description}
  {canonical}
  {ogLocale}
  {hreflangEn}
  {hreflangEs}
  listFirst={true}
>
  <article class="zl-prose">
    <header class="zl-prose-head">
      <div class="zl-prose-mascot">
        <Mascot interactive={false} aura={false} />
      </div>
      <h1>{heading}</h1>
      <p class="zl-prose-lede">{lede}</p>
    </header>

    <slot />

    {#if faqs.length}
      <section class="zl-prose-faq" aria-labelledby="zl-faq-title">
        <h2 id="zl-faq-title">{faqHeading}</h2>
        <dl>
          {#each faqs as faq (faq.q)}
            <div>
              <dt>{faq.q}</dt>
              <dd>{faq.a}</dd>
            </div>
          {/each}
        </dl>
      </section>
    {/if}

    <p class="zl-prose-cta-row">
      <a class="zl-prose-cta" href={ctaHref}>{ctaLabel}</a>
    </p>

    {#if currentUse !== null}
      <!-- The pages point at each other. Cheap for search engines to follow,
           and it is genuinely the useful thing to show someone who landed on
           one of these: there are other ones. -->
      <nav class="zl-prose-more" aria-label={moreHeading}>
        <h2>{moreHeading}</h2>
        <ul>
          {#each otherUses as use (use.slug)}
            <li><a href={useHref(use.slug)}>{use.nav}</a></li>
          {/each}
          <li><a href="/about">How it works</a></li>
        </ul>
      </nav>
    {/if}
  </article>
</PageLayout>

<style>
  /* One column of prose on the same cream ground as the app. No second card
     language, no new surface. */
  .zl-prose {
    width: 100%;
    max-width: 44rem;
    margin: 0 auto;
    color: var(--zl-text-color-primary, #1e1714);
    text-align: left;
  }

  .zl-prose-head {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .zl-prose-mascot {
    width: 84px;
    margin: 0 auto 0.75rem;
  }

  .zl-prose :global(h1) {
    font-size: clamp(1.6rem, 3.5vw + 1rem, 2.3rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0 0 0.5rem;
    text-wrap: balance;
  }

  .zl-prose-lede {
    font-size: clamp(1rem, 1vw + 0.9rem, 1.12rem);
    line-height: 1.55;
    margin: 0;
    text-wrap: pretty;
    color: color-mix(
      in srgb,
      var(--zl-text-color-primary, #1e1714) 78%,
      transparent
    );
  }

  .zl-prose :global(h2) {
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    margin: 0 0 0.35rem;
  }

  .zl-prose :global(p),
  .zl-prose :global(dd) {
    line-height: 1.6;
    color: color-mix(
      in srgb,
      var(--zl-text-color-primary, #1e1714) 82%,
      transparent
    );
  }

  .zl-prose-faq,
  .zl-prose :global(.zl-prose-section) {
    margin-top: 2.5rem;
    padding-top: 1.75rem;
    border-top: 1.5px solid
      color-mix(in srgb, var(--zl-text-color-primary, #1e1714) 12%, transparent);
  }

  .zl-prose-faq dl {
    margin: 1.25rem 0 0;
    display: grid;
    gap: 1.25rem;
  }

  .zl-prose-faq dt {
    font-weight: 800;
    margin-bottom: 0.25rem;
  }

  .zl-prose-faq dd {
    margin: 0;
  }

  .zl-prose-cta-row {
    margin: 2.5rem 0 0;
    text-align: center;
  }

  /* The same flat brand yellow the record button wears, so the page ends on
     the control it has been describing. */
  .zl-prose-cta {
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

  .zl-prose-cta:active {
    transform: scale(0.96);
  }

  .zl-prose-more {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1.5px solid
      color-mix(in srgb, var(--zl-text-color-primary, #1e1714) 12%, transparent);
    text-align: center;
  }

  .zl-prose-more h2 {
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    opacity: 0.62;
    margin-bottom: 0.85rem;
  }

  .zl-prose-more ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }

  .zl-prose-more a {
    display: inline-block;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
    padding: 0.38rem 0.8rem;
    border-radius: 999px;
    color: color-mix(
      in srgb,
      var(--zl-text-color-primary, #1e1714) 76%,
      transparent
    );
    border: 2px solid
      color-mix(in srgb, var(--zl-text-color-primary, #1e1714) 14%, transparent);
    transition: all 0.16s ease;
  }

  .zl-prose-more a:hover {
    color: var(--zl-text-color-primary, #1e1714);
    border-color: color-mix(
      in srgb,
      var(--zl-text-color-primary, #1e1714) 38%,
      transparent
    );
  }

  @media (prefers-reduced-motion: reduce) {
    .zl-prose-cta {
      transition: none;
    }
  }
</style>
