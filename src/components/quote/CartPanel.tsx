'use client';

import gsap from 'gsap';
import { Loader2, MessageCircle, Plus, ShieldCheck, Store, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { formatUsd } from '@/lib/pricing';
import type { Quote } from '@/lib/quote-types';

export type CartItem = {
  id: string;
  quote: Quote;
};

type Props = {
  items: CartItem[];
  active: boolean;
  whatsappUrl: string | null;
  onRemove: (id: string) => void;
  onAddAnother: () => void;
};

export function CartPanel({ items, active, whatsappUrl, onRemove, onAddAnother }: Props) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const root = useRef<HTMLDivElement>(null);

  const usd = (value: number) => formatUsd(value, locale);
  const total = items.reduce((sum, item) => sum + item.quote.breakdown.totalUsd, 0);

  useEffect(() => {
    if (!active) return;
    const context = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set('.cart-line', { opacity: 1, y: 0 });
        return;
      }
      gsap.fromTo(
        '.cart-line',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' }
      );
    }, root);
    return () => context.revert();
  }, [active, items.length]);

  return (
    <div ref={root} className="flex flex-col gap-6 p-6 sm:p-9">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-teal-500">
          {t('eyebrow')}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-navy-900">{t('title')}</h2>
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-sand-100/70 px-4 py-6 text-center text-sm text-navy-800/60">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="cart-line flex items-center gap-3 rounded-2xl bg-sand-100/70 p-3"
            >
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                {item.quote.product.faviconUrl ? (
                  <img
                    src={item.quote.product.faviconUrl}
                    alt=""
                    width={20}
                    height={20}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="size-5 object-contain"
                  />
                ) : (
                  <Store aria-hidden="true" className="size-4 text-teal-500" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy-800/85">
                  {item.quote.product.title || item.quote.store.brand}
                </p>
                <p className="text-xs text-navy-800/55">
                  {item.quote.store.brand} · {t('quantity')}{' '}
                  <span className="numeric">{item.quote.breakdown.quantity}</span>
                  {item.quote.refining && (
                    <span className="ms-2 inline-flex items-center gap-1">
                      <Loader2 aria-hidden="true" className="size-3 animate-spin text-teal-500" />
                      {t('refining')}
                    </span>
                  )}
                </p>
              </div>
              <span className="numeric shrink-0 text-base font-bold text-navy-900">
                {usd(item.quote.breakdown.totalUsd)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={t('remove')}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-navy-800/40 transition-colors hover:bg-navy-900/8 hover:text-coral-500"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-3xl bg-navy-900 px-5 py-5 text-white">
          <span className="text-sm font-semibold leading-snug text-white/80">{t('total')}</span>
          <span className="numeric shrink-0 text-3xl font-extrabold tabular tracking-tight">
            {usd(total)}
          </span>
        </div>
      )}

      <p className="flex items-start gap-2 rounded-2xl bg-sand-100/80 px-4 py-3 text-xs leading-relaxed text-navy-800/70">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-teal-500" />
        {t('allInclusive')}
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onAddAnother}
          className="inline-flex items-center gap-2 rounded-2xl border border-navy-900/12 px-5 py-4 text-sm font-semibold text-navy-800 transition-colors hover:bg-sand-100"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('addAnother')}
        </button>

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-coral-500 px-6 py-4 text-base font-bold text-white shadow-xl shadow-coral-500/30 transition-all hover:-translate-y-0.5 hover:bg-coral-400"
          >
            <MessageCircle aria-hidden="true" className="size-5" />
            {t('confirm')}
          </a>
        ) : (
          items.length > 0 && (
            <p className="flex flex-1 items-center justify-center rounded-2xl bg-navy-900/6 px-6 py-4 text-sm font-medium text-navy-800/60">
              {t('whatsappUnavailable')}
            </p>
          )
        )}
      </div>
    </div>
  );
}
