'use client';

import { useTranslations } from 'next-intl';
import { Marquee } from '@/components/ui/marquee';

/**
 * Social proof for "any Turkish store".
 *
 * These are domains, not endorsements or a supported-store list — the app has
 * no store registry and works from whatever link is pasted. They are rendered
 * as plain text rather than logos precisely so they read as examples of the
 * kind of link that works, not as partner branding.
 */
const EXAMPLE_STORES = [
  'trendyol.com',
  'hepsiburada.com',
  'lcw.com',
  'koton.com',
  'defacto.com.tr',
  'boyner.com.tr',
  'mavi.com',
  'ciceksepeti.com',
  'n11.com',
  'beymen.com',
  'gratis.com',
  'vatanbilgisayar.com'
];

export function StoreMarquee() {
  const t = useTranslations('hero');

  return (
    <div className="relative mt-14 sm:mt-20">
      <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-navy-800/35">
        {t('marquee')}
      </p>

      <Marquee pauseOnHover className="[--duration:38s] [--gap:2.5rem]">
        {EXAMPLE_STORES.map((host) => (
          <span
            key={host}
            dir="ltr"
            className="select-none text-lg font-semibold tracking-tight text-navy-900/25 transition-colors hover:text-teal-600"
          >
            {host}
          </span>
        ))}
      </Marquee>

      {/* Fades the strip into the section edges instead of clipping it hard. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-0 w-1/6 bg-gradient-to-r from-white to-transparent rtl:bg-gradient-to-l"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-0 w-1/6 bg-gradient-to-l from-white to-transparent rtl:bg-gradient-to-r"
      />
    </div>
  );
}
