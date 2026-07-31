'use client';

import { ArrowLeft, CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { QuoteNeedsInput } from '@/lib/quote-types';
import { StoreBadge } from './StoreBadge';

type Props = {
  reason: QuoteNeedsInput;
  busy: boolean;
  onSubmit: (priceTry: number) => void;
  onBack: () => void;
};

/**
 * Shown when a store blocks our reader or publishes no machine-readable price.
 * Rather than guessing a number, we ask the customer to copy the lira price
 * across; the rest of the engine is unchanged.
 */
export function ManualPricePanel({ reason, busy, onSubmit, onBack }: Props) {
  const t = useTranslations('manualPrice');
  const errors = useTranslations('errors');
  const hero = useTranslations('hero');
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number.parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onSubmit(parsed);
  }

  const explanation = errors(reason.error, {
    store: reason.store.brand,
    currency: reason.currency ?? ''
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6 sm:p-9" noValidate>
      <StoreBadge
        brand={reason.store.brand}
        host={reason.store.displayHost}
        faviconUrl={reason.store.faviconUrl}
        label={hero('detected')}
      />

      <p className="flex items-start gap-2 rounded-2xl bg-coral-100 px-4 py-3 text-sm font-medium text-coral-600">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {explanation}
      </p>

      <div>
        <h2 className="text-xl font-bold text-navy-900">{t('title')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy-800/65">
          {t('subtitle')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="manual-price" className="text-sm font-semibold text-navy-900">
          {t('label')}
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 start-4 my-auto flex items-center text-lg font-bold text-navy-800/35"
          >
            ₺
          </span>
          <input
            id="manual-price"
            name="manualPrice"
            type="text"
            inputMode="decimal"
            dir="ltr"
            autoFocus
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
            }}
            placeholder={t('placeholder')}
            aria-invalid={invalid ? 'true' : undefined}
            aria-describedby={invalid ? 'manual-price-error' : undefined}
            className="numeric w-full rounded-2xl border border-navy-900/12 bg-white py-4 pe-4 ps-11 text-base font-semibold text-navy-900 shadow-sm outline-none transition-colors focus:border-teal-500"
          />
        </div>
        {invalid && (
          <p id="manual-price-error" role="alert" className="text-sm font-medium text-coral-600">
            {t('invalid')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-2xl border border-navy-900/12 px-5 py-3.5 text-sm font-semibold text-navy-800 transition-colors hover:bg-sand-100"
        >
          <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
          {hero('inputLabel')}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-2xl bg-navy-900 px-6 py-3.5 text-base font-bold text-white shadow-xl shadow-navy-900/20 transition-all hover:-translate-y-0.5 hover:bg-navy-800 disabled:opacity-45"
        >
          {t('submit')}
        </button>
      </div>
    </form>
  );
}
