'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ClipboardList, Receipt, Truck, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { key: 'paste', Icon: ClipboardList },
  { key: 'price', Icon: Receipt },
  { key: 'confirm', Icon: Wallet },
  { key: 'receive', Icon: Truck }
] as const;

export function HowItWorks() {
  const t = useTranslations('howItWorks');
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const context = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set('.step-card', { opacity: 1, y: 0 });
        return;
      }
      gsap.fromTo(
        '.step-card',
        { opacity: 0, y: 40, rotateX: -12 },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.7,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 75%' }
        }
      );
    }, root);
    return () => context.revert();
  }, []);

  return (
    <section
      ref={root}
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"
    >
      <header className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-500">
          {t('eyebrow')}
        </p>
        <h2
          id="how-it-works-title"
          className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl"
        >
          {t('title')}
        </h2>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-navy-800/65">
          {t('subtitle')}
        </p>
      </header>

      <ol
        className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        style={{ perspective: '1200px' }}
      >
        {STEPS.map((step, index) => {
          const Icon = step.Icon;
          return (
            <li
              key={step.key}
              className="step-card gsap-prepare group relative rounded-4xl border border-navy-900/8 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl hover:shadow-navy-900/8"
            >
              <span className="numeric absolute end-6 top-6 text-5xl font-black leading-none text-navy-900/6">
                {index + 1}
              </span>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-teal-500/12 text-teal-500 transition-colors group-hover:bg-teal-500 group-hover:text-white">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-navy-900">
                {t(`steps.${step.key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-800/65">
                {t(`steps.${step.key}.body`)}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
