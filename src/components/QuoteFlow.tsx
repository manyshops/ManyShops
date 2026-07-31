'use client';

import gsap from 'gsap';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CheckoutValues } from './quote/CheckoutPanel';
import {
  isQuote,
  needsManualPrice,
  type OrderResult,
  type Quote,
  type QuoteNeedsInput,
  type QuoteResponse
} from '@/lib/quote-types';
import { CheckoutPanel } from './quote/CheckoutPanel';
import { ManualPricePanel } from './quote/ManualPricePanel';
import { ProcessingOverlay } from './quote/ProcessingOverlay';
import { ReceiptPanel } from './quote/ReceiptPanel';
import { SuccessPanel } from './quote/SuccessPanel';
import { UrlPanel } from './quote/UrlPanel';

type Step = 'input' | 'manual' | 'receipt' | 'checkout' | 'success';

/**
 * The flip deck.
 *
 * Two faces share a single grid cell inside a `preserve-3d` container. Each
 * transition renders the next step onto whichever face is currently hidden and
 * then rotates the deck a further 180deg, so the card keeps turning in one
 * direction indefinitely rather than flapping back and forth. GSAP drives the
 * rotation together with a scale dip, which is what sells the depth — a plain
 * CSS transition on `rotateY` reads flat by comparison.
 */
export function QuoteFlow() {
  const t = useTranslations('errors');
  const locale = useLocale();

  const stage = useRef<HTMLDivElement>(null);
  const deck = useRef<HTMLDivElement>(null);

  /** Total half-turns performed. Parity decides which face is visible. */
  const [turns, setTurns] = useState(0);
  /** Content of [front, back]. Index `turns % 2` is the one facing the viewer. */
  const [faces, setFaces] = useState<[Step, Step]>(['input', 'input']);

  const [url, setUrl] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [manualReason, setManualReason] = useState<QuoteNeedsInput | null>(null);
  const [order, setOrder] = useState<OrderResult | null>(null);

  const visibleFace = turns % 2;
  const currentStep = faces[visibleFace];

  /** Puts `step` on the hidden face and schedules the half-turn onto it. */
  const flipTo = useCallback(
    (step: Step) => {
      setFaces((previous) => {
        const next: [Step, Step] = [...previous];
        next[(turns + 1) % 2] = step;
        return next;
      });
      setTurns((value) => value + 1);
    },
    [turns]
  );

  // Runs after React has committed the incoming face, so it is already painted
  // (and back-face-hidden) before it rotates into view.
  useEffect(() => {
    const element = deck.current;
    if (!element) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = turns * 180;

    if (reduced || turns === 0) {
      gsap.set(element, { rotationY: target });
      return;
    }

    const timeline = gsap.timeline();
    timeline
      .to(element, { scale: 0.93, duration: 0.42, ease: 'power2.in' }, 0)
      .to(element, { rotationY: target, duration: 0.95, ease: 'power3.inOut' }, 0)
      .to(element, { scale: 1, duration: 0.5, ease: 'power2.out' }, 0.45);

    return () => {
      timeline.kill();
    };
  }, [turns]);

  const scrollIntoView = useCallback(() => {
    stage.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  /**
   * Some stores only reveal their sale price to a rendered browser, which takes
   * about half a minute — far too long to hold the customer on a spinner. The
   * quote arrives immediately from the fast read and this watches for the
   * cheaper figure, which lands a few seconds later. The price only ever falls.
   */
  useEffect(() => {
    if (!quote?.refining) return;

    let cancelled = false;
    const startedAt = Date.now();
    const productUrl = quote.store.url;
    const quantity = quote.breakdown.quantity;

    const timer = window.setInterval(async () => {
      if (cancelled || Date.now() - startedAt > 130_000) {
        window.clearInterval(timer);
        return;
      }
      try {
        const response = await fetch(
          `/api/quote?url=${encodeURIComponent(productUrl)}&quantity=${quantity}`
        );
        if (!response.ok) return;

        const data = (await response.json()) as {
          status: string;
          quote?: Quote;
        };
        if (cancelled || !data.quote) return;

        if (data.status === 'settled') {
          window.clearInterval(timer);
          setQuote(data.quote);
        }
      } catch {
        // Transient failure; the existing quote remains valid.
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [quote?.refining, quote?.store.url, quote?.breakdown.quantity]);

  async function requestQuote(manualPriceTry?: number) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, quantity, manualPriceTry })
      });

      const data = (await response.json()) as QuoteResponse;

      if (isQuote(data)) {
        setQuote(data);
        setManualReason(null);
        flipTo('receipt');
        scrollIntoView();
        return;
      }

      if (needsManualPrice(data)) {
        setManualReason(data);
        // Already collecting a manual price — keep the panel, show the message.
        if (currentStep !== 'manual') flipTo('manual');
        return;
      }

      setError(
        t(data.error === 'rate_limited' ? 'rate_limited' : 'invalid_url')
      );
    } catch {
      setError(t('network'));
    } finally {
      setBusy(false);
    }
  }

  async function submitOrder(values: CheckoutValues) {
    if (!quote) return;
    setBusy(true);
    setOrderError(null);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          customer: {
            fullName: values.fullName,
            phone: values.phone,
            region: values.region,
            address: values.address,
            landmark: values.landmark
          },
          item: {
            productUrl: quote.store.url,
            title: quote.product.title,
            imageUrl: quote.product.imageUrl,
            quantity: quote.breakdown.quantity,
            note: values.note,
            unitPriceTry: quote.breakdown.unitPriceTry,
            estimatedWeightKg: quote.weight.weightKg,
            weightMethod: quote.weight.method
          }
        })
      });

      if (!response.ok) {
        setOrderError(t('orderFailed'));
        return;
      }

      setOrder((await response.json()) as OrderResult);
      flipTo('success');
      scrollIntoView();
    } catch {
      setOrderError(t('network'));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setQuote(null);
    setManualReason(null);
    setOrder(null);
    setError(null);
    setOrderError(null);
    setUrl('');
    setQuantity(1);
    flipTo('input');
  }

  function renderStep(step: Step, active: boolean) {
    switch (step) {
      case 'manual':
        return manualReason ? (
          <ManualPricePanel
            reason={manualReason}
            busy={busy}
            onSubmit={(price) => void requestQuote(price)}
            onBack={reset}
          />
        ) : null;
      case 'receipt':
        return quote ? (
          <ReceiptPanel
            quote={quote}
            active={active}
            onContinue={() => flipTo('checkout')}
            onReset={reset}
          />
        ) : null;
      case 'checkout':
        return quote ? (
          <CheckoutPanel
            quote={quote}
            busy={busy}
            submitError={orderError}
            onSubmit={(values) => void submitOrder(values)}
            onBack={() => flipTo('receipt')}
          />
        ) : null;
      case 'success':
        return order ? (
          <SuccessPanel result={order} active={active} onReset={reset} />
        ) : null;
      case 'input':
      default:
        return (
          <UrlPanel
            url={url}
            quantity={quantity}
            busy={busy}
            error={error}
            onUrlChange={setUrl}
            onQuantityChange={setQuantity}
            onSubmit={() => void requestQuote()}
          />
        );
    }
  }

  // The processing state lives on the face the customer is already looking at,
  // so the flip happens once — on arrival at the receipt — and not before.
  const showProcessing =
    busy && (currentStep === 'input' || currentStep === 'manual');

  return (
    <div ref={stage} className="flip-stage" id="quote">
      <div ref={deck} className="flip-deck">
        {([0, 1] as const).map((index) => {
          const active = index === visibleFace;
          return (
            <div
              key={index}
              className={`flip-face glass-card overflow-hidden rounded-4xl ${
                index === 1 ? 'flip-face--back' : ''
              } ${active ? '' : 'pointer-events-none'}`}
              aria-hidden={active ? undefined : true}
              inert={!active}
            >
              {active && showProcessing ? (
                <ProcessingOverlay />
              ) : (
                renderStep(faces[index], active)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
