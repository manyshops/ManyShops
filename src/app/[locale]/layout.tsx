import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import {
  localeDirection,
  localeHreflang,
  locales,
  routing,
  type Locale
} from '@/i18n/routing';
import { SITE_URL } from '@/lib/site';
import '../globals.css';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const active = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: active, namespace: 'meta' });

  // Every locale advertises every other one, plus x-default on the root.
  const languages = Object.fromEntries(
    locales.map((option) => [localeHreflang[option], `/${option}`])
  );

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t('title'),
      template: `%s · ${t('siteName')}`
    },
    description: t('description'),
    applicationName: t('siteName'),
    alternates: {
      canonical: `/${active}`,
      languages: { ...languages, 'x-default': `/${routing.defaultLocale}` }
    },
    openGraph: {
      type: 'website',
      siteName: t('siteName'),
      title: t('title'),
      description: t('description'),
      url: `/${active}`,
      locale: active === 'ar' ? 'ar_LB' : 'en_US',
      images: [{ url: '/logo.svg', alt: t('ogAlt') }]
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: ['/logo.svg']
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' }
    },
    formatDetection: { telephone: false }
  };
}

export const viewport = {
  themeColor: '#0b2340',
  width: 'device-width',
  initialScale: 1
};

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for the statically rendered locale segments.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'common' });

  return (
    <html lang={localeHreflang[locale as Locale]} dir={localeDirection[locale as Locale]}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
