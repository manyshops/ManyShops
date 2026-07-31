import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FaqSection, type FaqItem } from '@/components/FaqSection';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { JsonLd } from '@/components/JsonLd';
import { PricingSection } from '@/components/PricingSection';
import { SITE_URL } from '@/lib/site';

const HOW_TO_STEPS = ['paste', 'price', 'confirm', 'receive'] as const;

export default async function HomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const meta = await getTranslations({ locale, namespace: 'meta' });
  const faqT = await getTranslations({ locale, namespace: 'faq' });
  const howT = await getTranslations({ locale, namespace: 'howItWorks' });

  // Read once on the server so the visible FAQ and the FAQPage graph are the
  // same strings — an answer engine and a reader never see different copy.
  const faqItems = faqT.raw('items') as FaqItem[];

  const howToSteps = HOW_TO_STEPS.map((key) => ({
    name: howT(`steps.${key}.title`),
    text: howT(`steps.${key}.body`)
  }));

  return (
    <>
      <JsonLd
        locale={locale}
        siteUrl={SITE_URL}
        name={meta('siteName')}
        description={meta('description')}
        faq={faqItems}
        howTo={{
          title: meta('howTitle'),
          description: meta('howDescription'),
          steps: howToSteps
        }}
      />

      <Header />

      <main id="main">
        <Hero />
        <HowItWorks />
        <PricingSection />
        <FaqSection items={faqItems} />
      </main>

      <Footer />
    </>
  );
}
