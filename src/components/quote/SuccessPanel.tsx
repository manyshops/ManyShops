'use client';

import gsap from 'gsap';
import { Check, MessageCircle, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { formatUsd } from '@/lib/pricing';
import type { OrderResult } from '@/lib/quote-types';

type Props = {
  result: OrderResult;
  active: boolean;
  onReset: () => void;
};

export function SuccessPanel({ result, active, onReset }: Props) {
  const t = useTranslations('success');
  const locale = useLocale();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const context = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap
        .timeline({ delay: 0.15 })
        .fromTo(
          '.success-mark',
          { scale: 0.4, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(2.2)' }
        )
        .fromTo(
          '.success-item',
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' },
          '-=0.25'
        );
    }, root);
    return () => context.revert();
  }, [active]);

  return (
    <div ref={root} className="flex flex-col items-center gap-6 p-6 text-center sm:p-9">
      <span className="success-mark flex size-16 items-center justify-center rounded-full bg-teal-500 text-white">
        <Check aria-hidden="true" className="size-8" strokeWidth={3} />
      </span>

      <div className="success-item">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-500">
          {t('eyebrow')}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-navy-900">{t('title')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy-800/65">
          {t('subtitle')}
        </p>
      </div>

      <dl className="success-item grid w-full gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-sand-100/80 px-4 py-4">
          <dt className="text-xs font-semibold uppercase tracking-wider text-navy-800/50">
            {t('reference')}
          </dt>
          <dd className="numeric mt-1 text-xl font-extrabold tracking-tight text-navy-900">
            {result.reference}
          </dd>
        </div>
        <div className="rounded-2xl bg-navy-900 px-4 py-4 text-white">
          <dt className="text-xs font-semibold uppercase tracking-wider text-white/55">
            {t('totalDue')}
          </dt>
          <dd className="numeric mt-1 text-xl font-extrabold tracking-tight">
            {formatUsd(result.totalUsd, locale)}
          </dd>
        </div>
      </dl>

      {result.whatsappUrl && (
        <div className="success-item w-full">
          <a
            href={result.whatsappUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-coral-500 px-6 py-4 text-base font-bold text-white shadow-xl shadow-coral-500/30 transition-all hover:-translate-y-0.5 hover:bg-coral-400"
          >
            <MessageCircle aria-hidden="true" className="size-5" />
            {t('whatsapp')}
          </a>
          <p className="mt-2 text-xs text-navy-800/55">{t('whatsappHint')}</p>
        </div>
      )}

      <ol className="success-item w-full space-y-2 rounded-2xl bg-sand-100/70 p-4 text-start">
        <li className="text-xs font-bold uppercase tracking-widest text-navy-800/50">
          {t('next.title')}
        </li>
        {(['one', 'two', 'three'] as const).map((key, index) => (
          <li
            key={key}
            className="flex items-start gap-3 text-sm leading-relaxed text-navy-800/80"
          >
            <span className="numeric mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-[11px] font-bold text-teal-500">
              {index + 1}
            </span>
            {t(`next.${key}`)}
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onReset}
        className="success-item inline-flex items-center gap-2 rounded-2xl border border-navy-900/12 px-5 py-3.5 text-sm font-semibold text-navy-800 transition-colors hover:bg-sand-100"
      >
        <Plus aria-hidden="true" className="size-4" />
        {t('newOrder')}
      </button>
    </div>
  );
}
