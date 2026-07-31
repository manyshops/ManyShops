'use client';

import gsap from 'gsap';
import {
  ArrowRight,
  Check,
  Loader2,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  TicketPercent
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { formatUsd, TRY_PER_USD } from '@/lib/pricing';
import type { Quote } from '@/lib/quote-types';
import { StoreBadge } from './StoreBadge';

type Props = {
  quote: Quote;
  active: boolean;
  onContinue: () => void;
  onReset: () => void;
};

export function ReceiptPanel({ quote, active, onContinue, onReset }: Props) {
  const t = useTranslations('receipt');
  const locale = useLocale();
  const root = useRef<HTMLDivElement>(null);

  const { breakdown, product, store } = quote;
  const usd = (value: number) => formatUsd(value, locale);

  // Flags the moment a background refinement lowers the total, so the change
  // reads as a win rather than the number silently shifting under the customer.
  const previousTotal = useRef(breakdown.totalUsd);
  const dropped = breakdown.totalUsd < previousTotal.current;
  useEffect(() => {
    previousTotal.current = breakdown.totalUsd;
  }, [breakdown.totalUsd]);

  // Line items cascade in once the card has finished turning toward the viewer.
  useEffect(() => {
    if (!active) return;
    const context = gsap.context(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        gsap.set('.receipt-line, .receipt-total', { opacity: 1, y: 0 });
        return;
      }
      gsap.fromTo(
        '.receipt-line',
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.07, ease: 'power2.out', delay: 0.15 }
      );
      gsap.fromTo(
        '.receipt-total',
        { opacity: 0, scale: 0.94 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)', delay: 0.5 }
      );
    }, root);
    return () => context.revert();
  }, [active]);

  // The store's pre-discount price, converted the same way, so the customer
  // sees the saving in the currency they will actually pay in.
  const originalTotalTry =
    quote.originalUnitPriceTry != null
      ? quote.originalUnitPriceTry * breakdown.quantity
      : null;
  const originalProductUsd =
    originalTotalTry != null ? originalTotalTry / TRY_PER_USD : null;
  const savingUsd =
    originalProductUsd != null
      ? Math.round((originalProductUsd - breakdown.productUsd) * 100) / 100
      : null;

  /**
   * What the total covers, as reassurance rather than arithmetic. The customer
   * is buying a single delivered price; the per-line costs, the rates behind
   * them and the shipping weight are ours to manage, not theirs to audit.
   */
  const included = ['product', 'sourcing', 'shipping', 'packaging'] as const;

  return (
    <div ref={root} className="flex flex-col gap-6 p-6 sm:p-9">
      <header className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-500">
              {t('eyebrow')}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-navy-900">{t('title')}</h2>
          </div>
          <PackageCheck aria-hidden="true" className="size-8 shrink-0 text-teal-500" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <StoreBadge
            brand={store.brand}
            host={store.displayHost}
            faviconUrl={product.faviconUrl}
            label={t('from')}
          />
          {breakdown.quantity > 1 && (
            <span className="rounded-xl bg-navy-900/6 px-3 py-2 text-sm font-semibold text-navy-800">
              {t('quantity')}:{' '}
              <span className="numeric tabular">{breakdown.quantity}</span>
            </span>
          )}
          {savingUsd != null && savingUsd > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500/15 px-3 py-2 text-sm font-bold text-teal-600">
              <TicketPercent aria-hidden="true" className="size-4" />
              <span className="numeric">{t('saving', { amount: usd(savingUsd) })}</span>
            </span>
          )}
        </div>

        {/*
          The store, not the link's slug, decides which product a URL resolves
          to — so we show what we actually read back, letting the customer catch
          a mismatch before they order.
        */}
        {(product.title || product.imageUrl) && (
          <div className="flex items-center gap-3 rounded-2xl bg-sand-100/70 p-3">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt=""
                width={56}
                height={56}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="size-14 shrink-0 rounded-xl bg-white object-contain"
              />
            )}
            {product.title && (
              <p className="line-clamp-3 text-sm font-medium leading-relaxed text-navy-800/80">
                {product.title}
              </p>
            )}
          </div>
        )}
      </header>

      <ul className="flex flex-col gap-1">
        {included.map((key) => (
          <li
            key={key}
            className="receipt-line flex items-start gap-3 rounded-2xl px-3 py-2.5"
          >
            <Check
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-teal-500"
              strokeWidth={3}
            />
            <span className="text-sm font-medium leading-relaxed text-navy-800/85">
              {t(`included.${key}`)}
            </span>
          </li>
        ))}
      </ul>

      <div className="receipt-tear" role="presentation" />

      <div className="receipt-total flex items-center justify-between gap-4 rounded-3xl bg-navy-900 px-5 py-5 text-white">
        <span className="text-sm font-semibold leading-snug text-white/80">
          {t('total')}
        </span>
        <span
          key={breakdown.totalUsd}
          className={`numeric shrink-0 text-3xl font-extrabold tabular tracking-tight ${
            dropped ? 'animate-[pricedrop_0.7s_ease-out]' : ''
          }`}
        >
          {usd(breakdown.totalUsd)}
        </span>
      </div>

      {quote.refining && (
        <p
          role="status"
          className="flex items-center justify-center gap-2 text-xs font-medium text-navy-800/55"
        >
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin text-teal-500" />
          {t('checkingDiscount')}
        </p>
      )}

      <p className="flex items-start gap-2 rounded-2xl bg-sand-100/80 px-4 py-3 text-xs leading-relaxed text-navy-800/70">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-teal-500" />
        {t('allInclusive')}
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-2xl border border-navy-900/12 px-5 py-4 text-sm font-semibold text-navy-800 transition-colors hover:bg-sand-100"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          {t('actions.back')}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-coral-500 px-6 py-4 text-base font-bold text-white shadow-xl shadow-coral-500/30 transition-all hover:-translate-y-0.5 hover:bg-coral-400"
        >
          {t('actions.continue')}
          <ArrowRight
            aria-hidden="true"
            className="size-5 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
          />
        </button>
      </div>

      <p className="text-center text-xs leading-relaxed text-navy-800/50">
        {t('disclaimer')}
      </p>
    </div>
  );
}
