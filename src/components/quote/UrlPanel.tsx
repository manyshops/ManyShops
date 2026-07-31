'use client';

import { ArrowRight, Link2, Minus, Plus, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { identifyStore } from '@/lib/store';
import { StoreBadge } from './StoreBadge';

type Props = {
  url: string;
  quantity: number;
  busy: boolean;
  error: string | null;
  onUrlChange: (value: string) => void;
  onQuantityChange: (value: number) => void;
  onSubmit: () => void;
};

/**
 * Live store recognition happens here, in the browser, from the hostname alone —
 * the badge appears the moment a valid link is pasted, before any request.
 */
export function UrlPanel({
  url,
  quantity,
  busy,
  error,
  onUrlChange,
  onQuantityChange,
  onSubmit
}: Props) {
  const t = useTranslations('hero');

  const store = useMemo(() => {
    if (url.trim().length < 5) return null;
    try {
      return identifyStore(url);
    } catch {
      return null;
    }
  }, [url]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-5 p-6 sm:p-9"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="product-url"
          className="text-sm font-semibold text-navy-900"
        >
          {t('inputLabel')}
        </label>

        <div className="relative">
          <Link2
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 start-4 my-auto size-5 text-navy-800/35"
          />
          <input
            id="product-url"
            name="url"
            type="url"
            inputMode="url"
            dir="ltr"
            autoComplete="url"
            spellCheck={false}
            required
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder={t('placeholder')}
            aria-describedby={error ? 'url-error' : undefined}
            aria-invalid={error ? 'true' : undefined}
            className="w-full rounded-2xl border border-navy-900/12 bg-white py-4 pe-4 ps-12 text-base text-navy-900 shadow-sm outline-none transition-colors placeholder:text-navy-800/35 focus:border-teal-500"
          />
        </div>

        {store && (
          <div className="pt-1">
            <StoreBadge
              brand={store.brand}
              host={store.displayHost}
              faviconUrl={store.faviconUrl}
              label={t('detected')}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-navy-900">
            {t('quantityLabel')}
          </span>
          <div className="inline-flex items-center rounded-2xl border border-navy-900/12 bg-white p-1">
            <button
              type="button"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              aria-label="-"
              className="flex size-10 items-center justify-center rounded-xl text-navy-800 transition-colors hover:bg-sand-100 disabled:opacity-35"
            >
              <Minus aria-hidden="true" className="size-4" />
            </button>
            <output
              className="numeric w-10 text-center text-base font-bold tabular text-navy-900"
              aria-label={t('quantityLabel')}
            >
              {quantity}
            </output>
            <button
              type="button"
              onClick={() => onQuantityChange(Math.min(20, quantity + 1))}
              disabled={quantity >= 20}
              aria-label="+"
              className="flex size-10 items-center justify-center rounded-xl text-navy-800 transition-colors hover:bg-sand-100 disabled:opacity-35"
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || url.trim().length < 5}
          className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-coral-500 px-6 py-4 text-base font-bold text-white shadow-xl shadow-coral-500/25 transition-all hover:-translate-y-0.5 hover:bg-coral-400 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {t('submit')}
          <ArrowRight
            aria-hidden="true"
            className="size-5 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
          />
        </button>
      </div>

      {error && (
        <p
          id="url-error"
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-coral-100 px-4 py-3 text-sm font-medium text-coral-600"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </form>
  );
}
