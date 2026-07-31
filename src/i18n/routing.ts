import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always'
});

export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl'
};

/** Native label for each locale, used by the switcher so each option reads in its own script. */
export const localeLabel: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية'
};

/** BCP-47 tags for <html lang> and hreflang. */
export const localeHreflang: Record<Locale, string> = {
  en: 'en',
  ar: 'ar'
};
