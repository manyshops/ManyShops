import type { MetadataRoute } from 'next';
import { localeHreflang, locales, routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const languages = Object.fromEntries(
    locales.map((locale) => [localeHreflang[locale], `${SITE_URL}/${locale}`])
  );

  return locales.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: locale === routing.defaultLocale ? 1 : 0.9,
    alternates: { languages }
  }));
}
