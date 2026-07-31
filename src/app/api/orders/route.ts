import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findOrder, generateReference, saveOrder, type Order } from '@/lib/orders';
import { normalizeLebanesePhone, LEBANON_REGIONS } from '@/lib/phone';
import { calculatePrice } from '@/lib/pricing';
import { readCache } from '@/lib/quote-cache';
import { identifyStore, InvalidUrlError } from '@/lib/store';
import { buildWhatsAppLink } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OrderSchema = z.object({
  locale: z.enum(['en', 'ar']).default('en'),
  customer: z.object({
    fullName: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(6).max(24),
    region: z.enum(LEBANON_REGIONS),
    address: z.string().trim().min(8).max(400),
    landmark: z.string().trim().max(160).optional().or(z.literal(''))
  }),
  item: z.object({
    productUrl: z.string().min(4).max(2048),
    title: z.string().max(300).nullable().optional(),
    imageUrl: z.string().max(2048).nullable().optional(),
    quantity: z.number().int().min(1).max(20),
    note: z.string().max(400).optional().or(z.literal('')),
    unitPriceTry: z.number().positive().max(10_000_000),
    estimatedWeightKg: z.number().positive().max(80),
    weightMethod: z.string().max(32)
  })
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues.map((i) => i.path.join('.')) },
      { status: 400 }
    );
  }

  const { locale, customer, item } = parsed.data;

  const phone = normalizeLebanesePhone(customer.phone);
  if (!phone.valid) {
    return NextResponse.json(
      { error: 'validation_failed', issues: ['customer.phone'] },
      { status: 400 }
    );
  }

  let store;
  try {
    store = identifyStore(item.productUrl);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      return NextResponse.json(
        { error: 'validation_failed', issues: ['item.productUrl'] },
        { status: 400 }
      );
    }
    throw error;
  }

  // The price is recomputed server-side from the inputs rather than trusting
  // whatever total the client posted.
  //
  // A background refinement may also have found a cheaper price after the quote
  // was shown — if the customer ordered before it landed, or navigated away
  // from the receipt, honour the lower figure here. This only ever reduces what
  // they pay, so it needs no confirmation.
  const refined = readCache(store.url);
  const unitPriceTry =
    refined?.product.price != null && refined.product.price < item.unitPriceTry
      ? refined.product.price
      : item.unitPriceTry;

  const breakdown = calculatePrice({
    unitPriceTry,
    estimatedWeightKg: item.estimatedWeightKg,
    quantity: item.quantity
  });

  const order: Order = {
    reference: generateReference(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    locale,
    customer: {
      fullName: customer.fullName,
      phoneE164: phone.e164,
      phoneNational: phone.national,
      region: customer.region,
      address: customer.address,
      landmark: customer.landmark?.trim() || null
    },
    item: {
      productUrl: store.url,
      storeBrand: store.brand,
      storeHost: store.displayHost,
      title: item.title ?? null,
      imageUrl: item.imageUrl ?? null,
      quantity: item.quantity,
      note: item.note?.trim() || null,
      breakdown,
      weightMethod: item.weightMethod
    },
    totalUsd: breakdown.totalUsd
  };

  await saveOrder(order);

  return NextResponse.json(
    {
      reference: order.reference,
      totalUsd: order.totalUsd,
      whatsappUrl: buildWhatsAppLink(order, locale)
    },
    { status: 201 }
  );
}

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get('reference');
  if (!reference) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const order = await findOrder(reference);
  if (!order) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Deliberately narrow: a reference code alone should not expose the full
  // address and phone number on record.
  return NextResponse.json({
    reference: order.reference,
    status: order.status,
    createdAt: order.createdAt,
    totalUsd: order.totalUsd,
    storeBrand: order.item.storeBrand,
    title: order.item.title,
    quantity: order.item.quantity
  });
}
