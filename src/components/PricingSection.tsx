import { Banknote, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

const ROWS = [
  { key: 'allIn', Icon: Sparkles },
  { key: 'fixed', Icon: Lock },
  { key: 'noSurprises', Icon: ShieldCheck },
  { key: 'cod', Icon: Banknote }
] as const;

/**
 * Communicates the promise — one figure, fixed, all-inclusive, paid on
 * delivery — without publishing the rate card behind it. The margin structure
 * is commercial information, so it stays out of customer-facing surfaces.
 */
export function PricingSection() {
  const t = useTranslations('pricing');

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="relative overflow-hidden bg-navy-950 py-20 text-white sm:py-28"
    >
      <span
        aria-hidden="true"
        className="aurora start-[-10%] top-[-20%] size-[38rem] bg-teal-500/25"
      />
      <span
        aria-hidden="true"
        className="aurora end-[-15%] bottom-[-25%] size-[32rem] bg-coral-500/20"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <header className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-300">
            {t('eyebrow')}
          </p>
          <h2
            id="pricing-title"
            className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl"
          >
            {t('title')}
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-white/65">
            {t('subtitle')}
          </p>
        </header>

        <dl className="mt-12 grid gap-4 md:grid-cols-2">
          {ROWS.map((row) => (
            <div
              key={row.key}
              className="rounded-4xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300">
                <row.Icon aria-hidden="true" className="size-5" />
              </span>
              <dt className="mt-5 text-lg font-bold">{t(`rows.${row.key}.title`)}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-white/60">
                {t(`rows.${row.key}.body`)}
              </dd>
            </div>
          ))}
        </dl>

      </div>
    </section>
  );
}
