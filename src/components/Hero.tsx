'use client';

import gsap from 'gsap';
import { ArrowRight, Banknote, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { NumberTicker } from '@/components/ui/number-ticker';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { HeroCollage } from './HeroCollage';
import { QuoteFlow } from './QuoteFlow';
import { StoreMarquee } from './StoreMarquee';

const PROOF = [
  { key: 'stores', value: 1000, suffix: '+' },
  { key: 'regions', value: 8, suffix: '' },
  { key: 'upfront', value: 0, suffix: '' }
] as const;

export function Hero() {
  const t = useTranslations('hero');
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const context = gsap.context(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        gsap.set('.hero-reveal, .hero-card', { opacity: 1, y: 0 });
        return;
      }

      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(
          '.hero-reveal',
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }
        )
        .fromTo(
          '.hero-card',
          { opacity: 0, y: 44, rotateX: -12 },
          { opacity: 1, y: 0, rotateX: 0, duration: 0.95 },
          '-=0.5'
        );
    }, root);

    return () => context.revert();
  }, []);

  /** Sends the customer to the one input that matters, focused and ready. */
  function focusQuote() {
    const field = document.getElementById('product-url');
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => (field as HTMLInputElement | null)?.focus(), 450);
  }

  return (
    <section
      ref={root}
      aria-labelledby="hero-title"
      className="relative bg-white pb-12 pt-24 sm:pt-28"
    >
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6">
        {/*
          The inset panel with an oversized corner sweep, carrying the whole
          hero. Everything else sits inside it, which is what gives the layout
          its shape rather than the page edges doing the work.
        */}
        <div className="relative overflow-hidden rounded-[2.5rem] rounded-bl-[6rem] bg-gradient-to-br from-teal-100/45 via-sand-100 to-sand-100 px-6 py-12 sm:rounded-[3rem] sm:rounded-bl-[9rem] sm:px-12 sm:py-16 lg:px-16 lg:py-20">
          <div className="relative z-10 grid items-center gap-12 lg:grid-cols-[1.05fr_minmax(0,30rem)] lg:gap-14">
            <div>
              <div className="hero-reveal gsap-prepare">
                <div className="inline-flex items-center rounded-full border border-navy-900/10 bg-white/80 px-1 py-1 shadow-sm backdrop-blur-sm">
                  <span className="me-2 flex size-6 items-center justify-center rounded-full bg-teal-500/20">
                    <Banknote aria-hidden="true" className="size-3.5 text-teal-600" />
                  </span>
                  {/* Component ships light-mode defaults, which suit this panel. */}
                  <AnimatedShinyText className="mx-0 max-w-none pe-3 text-xs font-semibold uppercase tracking-widest">
                    {t('badge')}
                  </AnimatedShinyText>
                </div>
              </div>

              <h1
                id="hero-title"
                className="hero-reveal gsap-prepare mt-7 text-balance text-4xl font-extrabold leading-[1.04] tracking-tight text-navy-950 sm:text-5xl lg:text-6xl"
              >
                {t('title')}
                <span className="mt-1 block text-teal-600">{t('titleAccent')}</span>
              </h1>

              <p className="hero-reveal gsap-prepare mt-6 max-w-lg text-pretty text-base leading-relaxed text-navy-800/70 sm:text-lg">
                {t('subtitle')}
              </p>

              <div className="hero-reveal gsap-prepare mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
                <ShimmerButton
                  onClick={focusQuote}
                  background="rgba(246, 90, 63, 1)"
                  shimmerColor="#ffffff"
                  shimmerDuration="2.8s"
                  borderRadius="999px"
                  className="shadow-xl shadow-coral-500/25"
                >
                  <span className="flex items-center gap-2 whitespace-nowrap px-1 text-base font-bold text-white">
                    {t('cta')}
                    <ArrowRight aria-hidden="true" className="size-5 rtl:rotate-180" />
                  </span>
                </ShimmerButton>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-full border border-navy-900/12 bg-white px-6 py-3.5 text-sm font-semibold text-navy-800 shadow-sm transition-colors hover:border-navy-900/25 hover:bg-sand-50"
                >
                  <Send aria-hidden="true" className="size-4 text-teal-600 rtl:-scale-x-100" />
                  {t('secondaryCta')}
                </a>
              </div>

              <dl className="hero-reveal gsap-prepare mt-10 grid max-w-md grid-cols-1 gap-4 border-t border-navy-900/10 pt-6 sm:grid-cols-3">
                {PROOF.map((item) => (
                  <div key={item.key}>
                    <dt className="numeric flex items-baseline text-2xl font-extrabold tracking-tight text-navy-950">
                      {item.key === 'upfront' && <span className="text-coral-500">$</span>}
                      <NumberTicker
                        value={item.value}
                        className="text-2xl font-extrabold tracking-tight text-navy-950"
                      />
                      {item.suffix && <span className="text-teal-600">{item.suffix}</span>}
                    </dt>
                    <dd className="mt-1 text-xs font-medium leading-snug text-navy-800/55">
                      {t(`proof.${item.key}`)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/*
              The quote card takes the place the phone mockup holds in the
              reference: floating over the colour blocks, slightly proud of the
              panel, and the clear focal point of the composition.
            */}
            <div
              className="hero-card gsap-prepare relative"
              style={{ perspective: '1600px' }}
            >
              <div className="absolute -inset-x-12 -inset-y-14 hidden lg:block">
                <HeroCollage />
              </div>
              <div className="relative z-10 drop-shadow-2xl">
                <QuoteFlow />
              </div>
            </div>
          </div>
        </div>
      </div>

      <StoreMarquee />
    </section>
  );
}
