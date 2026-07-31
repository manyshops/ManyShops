import type { FaqItem } from './FaqSection';

/**
 * Structured data for search and answer engines.
 *
 * The pricing figures come from the same constants the quote engine uses, so
 * anything a generative engine quotes back matches what the app charges. Both
 * locales emit their own graph with the correct `inLanguage`.
 */

type Props = {
  locale: string;
  siteUrl: string;
  name: string;
  description: string;
  faq: FaqItem[];
  howTo: { title: string; description: string; steps: Array<{ name: string; text: string }> };
};

export function JsonLd({
  locale,
  siteUrl,
  name,
  description,
  faq,
  howTo
}: Props) {
  const localeUrl = `${siteUrl}/${locale}`;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}#organization`,
        name,
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo.svg`,
          caption: name
        },
        areaServed: { '@type': 'Country', name: 'Lebanon' },
        knowsLanguage: ['en', 'ar']
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        url: siteUrl,
        name,
        description,
        inLanguage: locale,
        publisher: { '@id': `${siteUrl}#organization` }
      },
      {
        '@type': 'Service',
        '@id': `${siteUrl}#service`,
        name: `${name} proxy shopping`,
        serviceType: 'Proxy shopping and parcel forwarding',
        description,
        provider: { '@id': `${siteUrl}#organization` },
        areaServed: { '@type': 'Country', name: 'Lebanon' },
        availableChannel: {
          '@type': 'ServiceChannel',
          serviceUrl: localeUrl,
          availableLanguage: ['en', 'ar']
        },
        // Deliberately describes the offer without publishing the rate card —
        // the internal cost structure is not customer-facing, and structured
        // data is the most machine-readable surface there is.
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          availableDeliveryMethod: 'https://schema.org/ParcelService',
          acceptedPaymentMethod: {
            '@type': 'PaymentMethod',
            name: 'Cash on delivery'
          },
          description:
            'A single all-inclusive price in USD covering the product, sourcing, air freight to Lebanon and packaging. Quoted before you order, fixed until delivery, and paid in cash on arrival.'
        }
      },
      {
        '@type': 'HowTo',
        '@id': `${localeUrl}#howto`,
        name: howTo.title,
        description: howTo.description,
        inLanguage: locale,
        totalTime: 'PT3M',
        estimatedCost: {
          '@type': 'MonetaryAmount',
          currency: 'USD',
          description: 'Product price plus service fee, shipping and packaging.'
        },
        step: howTo.steps.map((step, index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          name: step.name,
          text: step.text
        }))
      },
      {
        '@type': 'FAQPage',
        '@id': `${localeUrl}#faq`,
        inLanguage: locale,
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a }
        }))
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      // Values are ours, not user input; the escape guards against a stray
      // "</script>" in translated copy closing the tag early.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph).replace(/</g, '\\u003c')
      }}
    />
  );
}
