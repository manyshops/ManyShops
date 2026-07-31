'use client';

import gsap from 'gsap';
import { Boxes, Calculator, ScanSearch, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Logo } from '../Logo';

const STEPS = [
  { key: 'store', Icon: Store },
  { key: 'product', Icon: ScanSearch },
  { key: 'weight', Icon: Boxes },
  { key: 'price', Icon: Calculator }
] as const;

/**
 * The "smart brain" state. Steps light up on a timeline rather than tracking
 * real scrape progress — the request is a single round trip, so there is no
 * honest per-step signal to report. It runs until the quote resolves.
 */
export function ProcessingOverlay() {
  const t = useTranslations('processing');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const context = gsap.context(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      gsap.set('.processing-step', { opacity: reduced ? 1 : 0.3 });
      gsap.to('.processing-mark', {
        rotate: 360,
        duration: 2.4,
        repeat: -1,
        ease: 'none',
        paused: reduced
      });

      if (reduced) return;

      const timeline = gsap.timeline({ repeat: -1 });
      STEPS.forEach((_, index) => {
        timeline
          .to(`.processing-step-${index}`, {
            opacity: 1,
            x: 0,
            duration: 0.35,
            ease: 'power2.out'
          })
          .to(
            `.processing-step-${index} .processing-dot`,
            { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' },
            '<'
          )
          .to({}, { duration: 0.55 });
      });
      timeline.to('.processing-step', { opacity: 0.3, duration: 0.3 });
    }, root);

    return () => context.revert();
  }, []);

  return (
    <div
      ref={root}
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-8 px-6 py-14 text-center sm:px-10"
    >
      <div className="relative flex size-24 items-center justify-center">
        <span className="processing-mark absolute inset-0 rounded-full border-2 border-dashed border-teal-500/40" />
        <Logo variant="mark" className="w-12" />
      </div>

      <h2 className="text-xl font-bold text-navy-900">{t('title')}</h2>

      <ul className="flex w-full max-w-sm flex-col gap-3 text-start">
        {STEPS.map((step, index) => (
          <li
            key={step.key}
            className={`processing-step processing-step-${index} flex items-center gap-3 rounded-2xl bg-sand-100/80 px-4 py-3`}
          >
            <span className="processing-dot flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-500/15">
              <step.Icon aria-hidden="true" className="size-4 text-teal-500" />
            </span>
            <span className="text-sm font-medium text-navy-900">
              {t(`steps.${step.key}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
