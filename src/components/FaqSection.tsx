import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type FaqItem = { q: string; a: string };

/**
 * Native <details> rather than a JS accordion: the answers are in the DOM and
 * readable by crawlers and answer engines whether or not scripts run, which is
 * the entire point of publishing an FAQ for AEO.
 */
export function FaqSection({ items }: { items: FaqItem[] }) {
  const t = useTranslations('faq');

  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-28"
    >
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-500">
          {t('eyebrow')}
        </p>
        <h2
          id="faq-title"
          className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl"
        >
          {t('title')}
        </h2>
      </header>

      <div className="mt-12 divide-y divide-navy-900/8 overflow-hidden rounded-4xl border border-navy-900/8 bg-white">
        {items.map((item, index) => (
          <details key={index} name="faq" className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-start text-base font-bold text-navy-900 transition-colors hover:bg-sand-50 [&::-webkit-details-marker]:hidden">
              <h3 className="text-pretty">{item.q}</h3>
              <ChevronDown
                aria-hidden="true"
                className="size-5 shrink-0 text-teal-500 transition-transform duration-300 group-open:rotate-180"
              />
            </summary>
            <div className="px-6 pb-6 text-pretty text-sm leading-relaxed text-navy-800/70">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
