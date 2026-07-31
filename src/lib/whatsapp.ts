import { formatUsd } from './pricing';
import type { Quote } from './quote-types';

/**
 * Builds the wa.me handoff. The customer confirms the whole cart in
 * WhatsApp, which is where this business already talks to people — there is
 * no payment gateway and no order form; WhatsApp is the checkout.
 */

/** Operations number. Digits only, country code included, no `+`. */
export function operationsNumber(): string | null {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '');
  return raw && raw.length >= 8 ? raw : null;
}

export function buildCartMessage(quotes: Quote[], locale: string): string {
  const money = (value: number) => formatUsd(value, 'en');
  const total = quotes.reduce((sum, quote) => sum + quote.breakdown.totalUsd, 0);

  const lines =
    locale === 'ar' ? ['طلب جديد من ManyShops (مؤكد)', ''] : ['New ManyShops order (confirmed)', ''];

  quotes.forEach((quote, index) => {
    const title = quote.product.title || quote.store.brand;
    lines.push(
      locale === 'ar' ? `${index + 1}) ${title}` : `${index + 1}) ${title}`,
      locale === 'ar' ? `الرابط: ${quote.store.url}` : `Link: ${quote.store.url}`,
      locale === 'ar'
        ? `الكمية: ${quote.breakdown.quantity}`
        : `Quantity: ${quote.breakdown.quantity}`,
      locale === 'ar' ? `السعر: ${money(quote.breakdown.totalUsd)}` : `Price: ${money(quote.breakdown.totalUsd)}`,
      ''
    );
  });

  lines.push(locale === 'ar' ? `الإجمالي: ${money(total)}` : `Total: ${money(total)}`);

  return lines.join('\n');
}

export function buildCartWhatsAppLink(quotes: Quote[], locale: string): string | null {
  const number = operationsNumber();
  if (!number || quotes.length === 0) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(buildCartMessage(quotes, locale))}`;
}
