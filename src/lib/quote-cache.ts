import 'server-only';
import { scrapeProduct, type ScrapedProduct } from './scraper';
import { estimateWeight, type WeightEstimate } from './weight';

/**
 * Scrape cache and background price refinement.
 *
 * Reading a JS-rendered price takes about thirty seconds, which is far too
 * long to hold someone on a spinner before showing them any number at all. So
 * the request path returns the fast read immediately, and the slow rendered
 * read runs detached, writing its result here. The client polls, and if a
 * cheaper price lands it swaps in — the figure only ever moves down.
 *
 * In-memory on purpose: it is a latency cache, not a source of truth, and it
 * is correct to lose it on restart. A multi-instance deployment would want
 * Redis here, but the semantics would not change.
 */

export type CachedScrape = {
  product: ScrapedProduct;
  weight: WeightEstimate;
  /** True once no further improvement is expected for this URL. */
  settled: boolean;
  updatedAt: number;
};

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

const entries = new Map<string, { value: CachedScrape; expires: number }>();
/** URLs with a rendered read in flight, so we never start two. */
const inFlight = new Set<string>();

function prune(): void {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.expires <= now) entries.delete(key);
  }
  // Map preserves insertion order, so the oldest keys drop first.
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

export function readCache(url: string): CachedScrape | null {
  const entry = entries.get(url);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    entries.delete(url);
    return null;
  }
  return entry.value;
}

export function writeCache(url: string, value: CachedScrape): void {
  entries.delete(url);
  entries.set(url, { value, expires: Date.now() + TTL_MS });
  prune();
}

export function isRefining(url: string): boolean {
  return inFlight.has(url);
}

/**
 * Starts the rendered read for a URL whose price block is client-side.
 *
 * Detached by design — the caller does not await it. Failure is silent because
 * the fast price is already a valid quote; refinement only ever improves it.
 */
export function refineInBackground(url: string): void {
  if (inFlight.has(url)) return;

  const cached = readCache(url);
  if (cached?.settled) return;

  inFlight.add(url);

  void (async () => {
    try {
      const outcome = await scrapeProduct(url, { allowRender: true });
      if (outcome.status !== 'ok' || outcome.product.price == null) return;

      const previous = readCache(url);
      const improved =
        previous == null ||
        previous.product.price == null ||
        outcome.product.price < previous.product.price;

      // Keep the weight we already computed; only the price can improve here.
      const weight =
        previous?.weight ?? (await estimateWeight(outcome.product));

      writeCache(url, {
        product: improved ? outcome.product : (previous?.product ?? outcome.product),
        weight,
        settled: true,
        updatedAt: Date.now()
      });
    } catch {
      // The fast quote stands; nothing to report to the customer.
    } finally {
      inFlight.delete(url);
    }
  })();
}
