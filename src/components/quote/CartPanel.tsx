'use client';

import gsap from 'gsap';
import { Loader2, Store, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { formatUsd } from '@/lib/pricing';
import type { Quote } from '@/lib/quote-types';

export type CartItem = {
  id: string;
  quote: Quote;
  /** Free-text size/colour/variant the customer types themselves — stores publish this in too many shapes to scrape reliably. */
  note: string;
};

type Props = {
  items: CartItem[];
  active: boolean;
  whatsappUrl: string | null;
  onRemove: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
  onAddAnother: () => void;
};

export function CartPanel({
  items,
  active,
  whatsappUrl,
  onRemove,
  onNoteChange,
  onAddAnother
}: Props) {
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
                <input
                  type="text"
                  value={item.note}
                  onChange={(event) => onNoteChange(item.id, event.target.value)}
                  placeholder={t('notePlaceholder')}
                  className="mt-1 w-full border-0 border-b border-dashed border-navy-900/15 bg-transparent py-0.5 text-xs text-navy-800/70 outline-none placeholder:text-navy-800/35 focus:border-teal-500"
                />
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

      <div className="flex flex-col gap-3">
        {/* A dashed "add-a-slot" pill, not a subtle link — teal to sit
            clearly apart from the coral confirm action below it. The plus
            badge spins a quarter-turn on hover, a small nod to "adding" as
            a live, physical action rather than a static click. */}
        <button
          type="button"
          onClick={onAddAnother}
          className="group relative inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-teal-500/45 bg-teal-500/[0.06] px-6 py-4 text-base font-bold text-teal-600 transition-all hover:-translate-y-0.5 hover:border-teal-500 hover:bg-teal-500/10"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-500 text-white shadow-md shadow-teal-500/30 transition-transform duration-300 group-hover:rotate-90">
            <span className="relative flex size-3.5 items-center justify-center">
              <span className="absolute h-3.5 w-0.5 rounded-full bg-white" />
              <span className="absolute h-0.5 w-3.5 rounded-full bg-white" />
            </span>
          </span>
          {t('addAnother')}
        </button>

        {whatsappUrl ? (
          // Bubble-shaped rather than a plain pill — three corners rounded,
          // the fourth pulled in to read as a chat-bubble tail. The icon is a
          // bubble-with-checkmark: this message, once sent, is the order.
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="group relative inline-flex w-full items-center justify-center gap-3 rounded-3xl rounded-es-lg bg-whatsapp-500 px-6 py-4 text-base font-bold text-white shadow-xl shadow-whatsapp-500/30 transition-all hover:-translate-y-0.5 hover:bg-whatsapp-400"
          >
            <span className="relative flex size-6 shrink-0 items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-6">
                <path
                  d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v6A2.5 2.5 0 0 1 17 15H9.8l-3.8 3v-3H7A2.5 2.5 0 0 1 4.5 12.5v-6Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.3 9.6l2 2 4.7-4.7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="absolute -end-0.5 -top-0.5 flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
                <span className="relative inline-flex size-2.5 rounded-full bg-white" />
              </span>
            </span>
            {t('confirm')}
          </a>
        ) : (
          items.length > 0 && (
            <p className="flex w-full items-center justify-center rounded-2xl bg-navy-900/6 px-6 py-4 text-sm font-medium text-navy-800/60">
              {t('whatsappUnavailable')}
            </p>
          )
        )}
      </div>
    </div>
  );
}
