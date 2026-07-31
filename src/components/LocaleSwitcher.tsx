'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { localeLabel, locales, type Locale } from '@/i18n/routing';

export function LocaleSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      // `pathname` is already locale-stripped by next-intl's navigation helper,
      // so the visitor stays on the same page in the other language.
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-navy-900/12 bg-white p-1 shadow-sm"
      role="group"
      aria-label={t('language')}
    >
      <Languages
        aria-hidden="true"
        className="ms-2 size-4 shrink-0 text-navy-800/40"
      />
      {locales.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            onClick={() => switchTo(option)}
            disabled={isPending}
            aria-current={active ? 'true' : undefined}
            lang={option}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
              active
                ? 'bg-teal-500 text-white'
                : 'text-navy-800/70 hover:bg-sand-100 hover:text-navy-900'
            }`}
          >
            {localeLabel[option]}
          </button>
        );
      })}
    </div>
  );
}
