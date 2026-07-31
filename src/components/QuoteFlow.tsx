'use client';

import gsap from 'gsap';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isQuote,
  needsManualPrice,
  type Quote,
  type QuoteNeedsInput,
  type QuoteResponse
} from '@/lib/quote-types';
import { apiUrl } from '@/lib/api-base';
import { buildCartWhatsAppLink } from '@/lib/whatsapp';
import { CartPanel, type CartItem } from './quote/CartPanel';
import { ManualPricePanel } from './quote/ManualPricePanel';
import { ProcessingOverlay } from './quote/ProcessingOverlay';
import { UrlPanel } from './quote/UrlPanel';

type Step = 'input' | 'manual' | 'cart';

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

  const [cart, setCart] = useState<CartItem[]>([]);
  const [manualReason, setManualReason] = useState<QuoteNeedsInput | null>(null);

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
   * cheaper figure, which lands a few seconds later, for every cart item still
   * marked `refining`. The price only ever falls.
   */
  useEffect(() => {
    if (!cart.some((item) => item.quote.refining)) return;

    let cancelled = false;
    const startedAt = Date.now();

    const timer = window.setInterval(async () => {
      if (cancelled || Date.now() - startedAt > 130_000) {
        window.clearInterval(timer);
        return;
      }

      const pending = cart.filter((item) => item.quote.refining);
      await Promise.all(
        pending.map(async (item) => {
          try {
            const response = await fetch(
              apiUrl(
                `/api/quote?url=${encodeURIComponent(item.quote.store.url)}&quantity=${item.quote.breakdown.quantity}`
              )
            );
            if (!response.ok) return;

            const data = (await response.json()) as { status: string; quote?: Quote };
            if (cancelled || !data.quote || data.status !== 'settled') return;

            setCart((previous) =>
              previous.map((entry) => (entry.id === item.id ? { ...entry, quote: data.quote! } : entry))
            );
          } catch {
            // Transient failure; the existing quote remains valid.
          }
        })
      );
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cart]);

  async function requestQuote(manualPriceTry?: number) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(apiUrl('/api/quote'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, quantity, manualPriceTry })
      });

      const data = (await response.json()) as QuoteResponse;

      if (isQuote(data)) {
        setCart((previous) => [...previous, { id: crypto.randomUUID(), quote: data }]);
        setManualReason(null);
        setUrl('');
        setQuantity(1);
        flipTo('cart');
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

  function addAnother() {
    setUrl('');
    setQuantity(1);
    setError(null);
    setManualReason(null);
    flipTo('input');
    scrollIntoView();
  }

  /** Back from manual price entry: keep the typed link so a typo is a quick fix, not a redo. */
  function backToInput() {
    setManualReason(null);
    flipTo('input');
  }

  function removeFromCart(id: string) {
    setCart((previous) => previous.filter((item) => item.id !== id));
  }

  const whatsappUrl = useMemo(
    () => buildCartWhatsAppLink(cart.map((item) => item.quote), locale),
    [cart, locale]
  );

  function renderStep(step: Step, active: boolean) {
    switch (step) {
      case 'manual':
        return manualReason ? (
          <ManualPricePanel
            reason={manualReason}
            busy={busy}
            onSubmit={(price) => void requestQuote(price)}
            onBack={backToInput}
          />
        ) : null;
      case 'cart':
        return (
          <CartPanel
            items={cart}
            active={active}
            whatsappUrl={whatsappUrl}
            onRemove={removeFromCart}
            onAddAnother={addAnother}
          />
        );
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
  // so the flip happens once — on arrival at the cart — and not before.
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
