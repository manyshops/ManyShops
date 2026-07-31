import type { Order } from './orders';
import { formatUsd } from './pricing';

/**
 * Builds the wa.me handoff. The customer confirms the order in WhatsApp, which
 * is where this business already talks to people — there is no payment gateway.
 */

/** Operations number. Digits only, country code included, no `+`. */
export function operationsNumber(): string | null {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '');
  return raw && raw.length >= 8 ? raw : null;
}

/**
 * The customer sends this message themselves, so it carries the delivered
 * total and nothing else about how that total is built. The full breakdown
 * stays on the stored order record for operations.
 */
export function buildOrderMessage(order: Order, locale: string): string {
  const { customer, item } = { customer: order.customer, item: order.item };
  const money = (value: number) => formatUsd(value, 'en');

  if (locale === 'ar') {
    return [
      `طلب جديد من ManyShops`,
      `الرقم المرجعي: ${order.reference}`,
      ``,
      `المتجر: ${item.storeBrand}`,
      item.title ? `المنتج: ${item.title}` : null,
      `الرابط: ${item.productUrl}`,
      `الكمية: ${item.quantity}`,
      item.note ? `ملاحظة: ${item.note}` : null,
      ``,
      `الإجمالي عند الاستلام: ${money(order.totalUsd)}`,
      `(شامل المنتج والخدمة والشحن والتغليف)`,
      ``,
      `الاسم: ${customer.fullName}`,
      `الهاتف: ${customer.phoneE164}`,
      `المنطقة: ${customer.region}`,
      `العنوان: ${customer.address}`,
      customer.landmark ? `علامة مميزة: ${customer.landmark}` : null
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  return [
    `New ManyShops order`,
    `Reference: ${order.reference}`,
    ``,
    `Store: ${item.storeBrand}`,
    item.title ? `Product: ${item.title}` : null,
    `Link: ${item.productUrl}`,
    `Quantity: ${item.quantity}`,
    item.note ? `Note: ${item.note}` : null,
    ``,
    `Total cash on delivery: ${money(order.totalUsd)}`,
    `(product, service, shipping and packaging included)`,
    ``,
    `Name: ${customer.fullName}`,
    `Phone: ${customer.phoneE164}`,
    `Region: ${customer.region}`,
    `Address: ${customer.address}`,
    customer.landmark ? `Landmark: ${customer.landmark}` : null
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function buildWhatsAppLink(order: Order, locale: string): string | null {
  const number = operationsNumber();
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(
    buildOrderMessage(order, locale)
  )}`;
}
