import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculatePrice, TRY_PER_USD } from '@/lib/pricing';
import { isRefining, readCache, refineInBackground, writeCache } from '@/lib/quote-cache';
import { scrapeProduct, type ScrapedProduct } from '@/lib/scraper';
import { identifyStore, InvalidUrlError } from '@/lib/store';
import { estimateWeight } from '@/lib/weight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  url: z.string().min(4).max(2048),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  /**
   * Set when the customer supplies the lira price themselves after the store
   * blocked our scraper. Everything downstream is identical.
   */
  manualPriceTry: z.coerce.number().positive().max(10_000_000).optional()
});

/** Naive in-process rate limit — enough to stop a single client hammering scrapes. */
const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT.max;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() || 'local';
}

export async function POST(request: Request) {
  if (rateLimited(clientKey(request))) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. Try again shortly.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const { url, quantity, manualPriceTry } = parsed.data;

  // Recognise the store from the hostname alone — no network needed.
  let store;
  try {
    store = identifyStore(url);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      return NextResponse.json(
        { error: 'invalid_url', code: error.code },
        { status: 400 }
      );
    }
    throw error;
  }

  // A previous request may already have paid the scrape (and possibly the
  // rendered refinement) for this exact URL.
  const cached = readCache(store.url);
  if (cached && manualPriceTry == null && cached.product.price != null) {
    return NextResponse.json(
      buildQuote({
        store,
        product: cached.product,
        priceTry: cached.product.price,
        quantity,
        weight: cached.weight,
        priceSource: cached.product.priceSource,
        via: 'cache',
        refining: !cached.settled && isRefining(store.url)
      })
    );
  }

  const outcome = await scrapeProduct(store.url);

  // The store served us a challenge or an error. If the customer already gave
  // us a price we can still quote; otherwise ask for one.
  if (outcome.status === 'blocked' || outcome.status === 'unreachable') {
    if (manualPriceTry == null) {
      return NextResponse.json(
        {
          error: outcome.status === 'blocked' ? 'store_blocked' : 'store_unreachable',
          store,
          needsManualPrice: true
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      buildQuote({
        store,
        product: emptyProduct(store.faviconUrl),
        priceTry: manualPriceTry,
        quantity,
        weight: {
          weightKg: 0.8,
          method: 'default' as const,
          category: null,
          confidence: 'low' as const
        },
        priceSource: 'manual' as const,
        via: outcome.diagnostics.via,
        refining: false
      })
    );
  }

  const product = outcome.product;
  const scrapedPrice = outcome.status === 'ok' ? product.price : null;
  const priceTry = manualPriceTry ?? scrapedPrice;

  if (priceTry == null) {
    return NextResponse.json(
      { error: 'price_not_found', store, product, needsManualPrice: true },
      { status: 200 }
    );
  }

  // A non-lira listing would be converted at the wrong rate, so we stop and say so.
  const currency = manualPriceTry != null ? 'TRY' : product.currency;
  if (currency && currency !== 'TRY') {
    return NextResponse.json(
      {
        error: 'unsupported_currency',
        currency,
        store,
        product,
        needsManualPrice: true
      },
      { status: 200 }
    );
  }

  const weight = await estimateWeight(product);

  // Only the scraped price is cacheable; a customer-supplied one is not.
  const needsRefinement =
    manualPriceTry == null && !outcome.diagnostics.pricesInMarkup;

  if (manualPriceTry == null) {
    writeCache(store.url, {
      product,
      weight,
      settled: !needsRefinement,
      updatedAt: Date.now()
    });
    if (needsRefinement) refineInBackground(store.url);
  }

  return NextResponse.json(
    buildQuote({
      store,
      product,
      priceTry,
      quantity,
      weight,
      priceSource: manualPriceTry != null ? ('manual' as const) : product.priceSource,
      via: outcome.diagnostics.via,
      refining: needsRefinement
    })
  );
}

/**
 * Cheap poll for a background refinement. Reads the cache only — it never
 * scrapes — so the client can check every couple of seconds for free.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawUrl = params.get('url');
  const quantity = Math.min(
    Math.max(Number.parseInt(params.get('quantity') ?? '1', 10) || 1, 1),
    20
  );
  if (!rawUrl) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  let store;
  try {
    store = identifyStore(rawUrl);
  } catch {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  const cached = readCache(store.url);
  if (!cached || cached.product.price == null) {
    return NextResponse.json({ status: 'unknown' });
  }

  return NextResponse.json({
    status: cached.settled ? 'settled' : 'refining',
    quote: buildQuote({
      store,
      product: cached.product,
      priceTry: cached.product.price,
      quantity,
      weight: cached.weight,
      priceSource: cached.product.priceSource,
      via: 'cache',
      refining: !cached.settled
    })
  });
}

function emptyProduct(faviconUrl: string): ScrapedProduct {
  return {
    title: null,
    imageUrl: null,
    price: null,
    originalPrice: null,
    currency: 'TRY',
    weightKg: null,
    brand: null,
    category: null,
    description: null,
    faviconUrl,
    priceSource: 'manual',
    confidence: 'none'
  };
}

function buildQuote({
  store,
  product,
  priceTry,
  quantity,
  weight,
  priceSource,
  via,
  refining
}: {
  store: ReturnType<typeof identifyStore>;
  product: ScrapedProduct;
  priceTry: number;
  quantity: number;
  weight: Awaited<ReturnType<typeof estimateWeight>>;
  priceSource: string | null;
  via: string | null;
  /** True while a rendered read may still lower this price. */
  refining: boolean;
}) {
  const breakdown = calculatePrice({
    unitPriceTry: priceTry,
    estimatedWeightKg: weight.weightKg,
    quantity
  });

  return {
    store,
    product: {
      title: product.title,
      imageUrl: product.imageUrl,
      brand: product.brand,
      category: product.category,
      faviconUrl: product.faviconUrl ?? store.faviconUrl
    },
    weight,
    breakdown,
    /**
     * Struck-through list price in lira, when the store is running a discount.
     * Shown to the customer for context; the quote is built on the sale price.
     */
    originalUnitPriceTry:
      product.originalPrice != null && product.originalPrice > priceTry
        ? product.originalPrice
        : null,
    priceSource,
    /** Which transport read the page — useful when debugging a bad quote. */
    via,
    refining,
    exchangeRate: TRY_PER_USD,
    quotedAt: new Date().toISOString()
  };
}
