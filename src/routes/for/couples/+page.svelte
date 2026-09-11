<script>
  import { MainContainer } from '$lib/components/mainPage';

  const canonicalUrl = 'https://ziplist.app/for/couples';
  const title = 'Shared Grocery & Chores List App for Couples — Instant QR Sync | ZipList';
  const description =
    'Real-time shared checklist for couples. Plan dinner, split supermarket aisles, and pack for trips together with instant QR pairing and zero accounts or signups.';
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />
  <link rel="alternate" hreflang="en" href={canonicalUrl} />
  <link rel="alternate" hreflang="es" href="https://ziplist.app/es/parejas" />

  <!-- OpenGraph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ZipList" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content="https://ziplist.app/og-card.png" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content={canonicalUrl} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content="https://ziplist.app/og-card.png" />

  <!-- Structured Data -->
  {@html `<script type="application/ld+json">
  ${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'ZipList Shared Lists for Couples',
        url: canonicalUrl,
        image: 'https://ziplist.app/og-card.png',
        description: description,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        inLanguage: 'en',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free shared real-time lists with instant QR pairing'
        }
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How do couples share a list in ZipList without accounts?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Tap "Share QR" to generate a live room. Your partner scans it with their phone camera and you are instantly connected in real-time. No emails, no passwords, no logins.'
            }
          },
          {
            '@type': 'Question',
            name: 'Can we tick off items simultaneously at opposite ends of the supermarket?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes! Updates sync across both phones in sub-10 milliseconds via WebSockets. When your partner grabs oat milk in aisle 1, it checks off on your phone in aisle 8 immediately.'
            }
          },
          {
            '@type': 'Question',
            name: 'Can we use voice dictation together?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Either person can tap the microphone button and dictate grocery items, packing gear, or weekend chores. ZipList parses spoken phrases into discrete checklist items automatically.'
            }
          }
        ]
      }
    ]
  })}
  </script>`}
</svelte:head>

<MainContainer />
