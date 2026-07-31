import * as cheerio from 'cheerio';
import {
  fetchDirect,
  fetchViaScraperApi,
  scraperApiConfig,
  transportMode,
  type FetchFailure,
  type TransportName
} from './scrape-transport';

/**
 * Product extraction from an arbitrary storefront.
 *
 * There is no per-store adapter here by design. We read the structured data
 * every serious e-commerce site already publishes for Google, in descending
 * order of reliability, and report honestly how confident we are. When a store
 * blocks us we say so rather than inventing a price.
 */

export type PriceSource =
  | 'json-ld'
  | 'discount'
  | 'open-graph'
  | 'microdata'
  | 'meta'
  | 'text'
  | 'manual';

export type ScrapeDiagnostics = {
  /** Which transport produced the returned result. */
  via: TransportName | null;
  /** Total fetches spent, across transports. */
  attempts: number;
  scraperApiConfigured: boolean;
  /**
   * False when the store builds its price block in the browser. The served
   * markup can then only yield the list price, so a rendered read is worth
   * doing — but off the critical path, since it costs ~30s.
   */
  pricesInMarkup: boolean;
};

export type ScrapedProduct = {
  title: string | null;
  imageUrl: string | null;
  /**
   * The price the customer would actually pay at the store right now — the
   * discounted one when the listing is on sale. This is what we quote on.
   */
  price: number | null;
  /**
   * The struck-through list price, when the listing shows one. Display only;
   * it never feeds the pricing engine.
   */
  originalPrice: number | null;
  currency: string | null;
  /** Weight in kg when the store actually publishes one. Rare. */
  weightKg: number | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  faviconUrl: string | null;
  priceSource: PriceSource | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
};

export type ScrapeOutcome =
  | { status: 'ok'; product: ScrapedProduct; diagnostics: ScrapeDiagnostics }
  | {
      status: 'blocked';
      reason: 'bot_challenge' | 'http_error';
      httpStatus?: number;
      diagnostics: ScrapeDiagnostics;
    }
  | {
      status: 'unreachable';
      reason: 'timeout' | 'network' | 'invalid_url';
      diagnostics: ScrapeDiagnostics;
    }
  | { status: 'no_price'; product: ScrapedProduct; diagnostics: ScrapeDiagnostics };

/**
 * Parses a price string written in any of the conventions Turkish, European
 * and US stores use: "1.299,90", "1,299.90", "1299.9", "₺1.299".
 */
export function parsePriceString(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized: string;

  if (lastComma > lastDot) {
    // Comma is the decimal separator: 1.299,90
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Dot is the decimal separator: 1,299.90
    normalized = cleaned.replace(/,/g, '');
  } else {
    normalized = cleaned.replace(/[.,]/g, '');
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

const CURRENCY_SYMBOLS: Array<[RegExp, string]> = [
  [/₺|\bTL\b|\bTRY\b|\bt&#8378;/i, 'TRY'],
  [/\bUSD\b|\$/, 'USD'],
  [/\bEUR\b|€/, 'EUR'],
  [/\bGBP\b|£/, 'GBP']
];

function detectCurrency(text: string): string | null {
  for (const [pattern, code] of CURRENCY_SYMBOLS) {
    if (pattern.test(text)) return code;
  }
  return null;
}

type JsonLdNode = Record<string, unknown>;

/** Walks the whole JSON-LD graph, including @graph arrays and nested offers. */
function collectNodes(value: unknown, out: JsonLdNode[] = []): JsonLdNode[] {
  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    const node = value as JsonLdNode;
    out.push(node);
    for (const nested of Object.values(node)) collectNodes(nested, out);
  }
  return out;
}

function hasType(node: JsonLdNode, type: string): boolean {
  const raw = node['@type'];
  if (typeof raw === 'string') return raw.toLowerCase().includes(type);
  if (Array.isArray(raw)) {
    return raw.some((t) => typeof t === 'string' && t.toLowerCase().includes(type));
  }
  return false;
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  if (value && typeof value === 'object') {
    const obj = value as JsonLdNode;
    return firstString(obj.name ?? obj.url ?? obj['@id'] ?? obj.contentUrl);
  }
  return null;
}

/** Reads a schema.org QuantitativeValue weight and converts it to kilograms. */
function readWeight(node: JsonLdNode): number | null {
  const weight = node.weight;
  if (!weight) return null;

  if (typeof weight === 'string' || typeof weight === 'number') {
    return normalizeWeight(Number(weight), 'kg');
  }
  if (typeof weight === 'object') {
    const w = weight as JsonLdNode;
    const value = Number(firstString(w.value ?? w.minValue));
    const unit = String(w.unitCode ?? w.unitText ?? 'KGM').toUpperCase();
    if (!Number.isFinite(value)) return null;
    return normalizeWeight(value, unit);
  }
  return null;
}

function normalizeWeight(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const u = unit.toUpperCase();
  if (u === 'GRM' || u === 'G' || u === 'GR' || u === 'GRAM') return value / 1000;
  if (u === 'LBR' || u === 'LB' || u === 'LBS') return value * 0.453592;
  if (u === 'ONZ' || u === 'OZ') return value * 0.0283495;
  return value; // KGM and friends
}

function extractFromJsonLd($: cheerio.CheerioAPI): Partial<ScrapedProduct> {
  const result: Partial<ScrapedProduct> = {};

  $('script[type="application/ld+json"]').each((_, element) => {
    if (result.price != null && result.title) return;

    const raw = $(element).contents().text();
    if (!raw.trim()) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return; // Malformed JSON-LD is common; fall through to other sources.
    }

    const nodes = collectNodes(parsed);
    const product = nodes.find((node) => hasType(node, 'product'));
    if (!product) return;

    result.title ??= firstString(product.name);
    result.imageUrl ??= firstString(product.image);
    result.brand ??= firstString(product.brand);
    result.category ??= firstString(product.category);
    result.description ??= firstString(product.description);
    result.weightKg ??= readWeight(product);

    // schema.org expresses a discount in several ways depending on the store:
    // a plain Offer carrying the sale price, an AggregateOffer with low/high,
    // or a priceSpecification tagged as the list price. Read all of them.
    for (const offer of collectNodes(product.offers ?? product)) {
      const current = firstNumber(offer.price ?? offer.lowPrice);
      if (current != null) {
        result.price ??= current;
        result.currency ??= firstString(offer.priceCurrency)?.toUpperCase() ?? null;
        result.priceSource ??= 'json-ld';
      }

      const high = firstNumber(offer.highPrice);
      if (high != null) result.originalPrice ??= high;

      for (const spec of collectNodes(offer.priceSpecification ?? {})) {
        const kind = `${firstString(spec['@type']) ?? ''} ${firstString(spec.priceType) ?? ''}`;
        if (/list|strikethrough|regular|msrp|original/i.test(kind)) {
          const listed = firstNumber(spec.price ?? spec.minPrice);
          if (listed != null) result.originalPrice ??= listed;
        }
      }
    }
  });

  return result;
}

/**
 * Guards the sale/list pair against the other numbers that live near a price:
 * instalment amounts ("12 x 62 TL"), loyalty points, and per-unit breakdowns.
 * A genuine retail discount sits between 1% and 90% off.
 */
function isPlausibleDiscount(sale: number, list: number): boolean {
  if (!(sale > 0) || !(list > 0) || list <= sale) return false;
  const ratio = sale / list;
  return ratio >= 0.1 && ratio <= 0.99;
}

function firstNumber(value: unknown): number | null {
  const text = firstString(value);
  return text ? parsePriceString(text) : null;
}

function metaContent($: cheerio.CheerioAPI, selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = $(selector).attr('content')?.trim();
    if (value) return value;
  }
  return null;
}

function extractFromMeta($: cheerio.CheerioAPI): Partial<ScrapedProduct> {
  const priceText = metaContent($, [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[name="twitter:data1"]',
    'meta[itemprop="price"]'
  ]);
  const currency = metaContent($, [
    'meta[property="product:price:currency"]',
    'meta[property="og:price:currency"]',
    'meta[itemprop="priceCurrency"]'
  ]);

  const price = priceText ? parsePriceString(priceText) : null;

  const originalText = metaContent($, [
    'meta[property="product:original_price:amount"]',
    'meta[property="og:price:standard_amount"]',
    'meta[property="product:price:original"]',
    'meta[itemprop="highPrice"]'
  ]);

  return {
    originalPrice: originalText ? parsePriceString(originalText) : null,
    title:
      metaContent($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ??
      $('h1').first().text().trim() ??
      null,
    imageUrl: metaContent($, [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'meta[itemprop="image"]'
    ]),
    description: metaContent($, [
      'meta[property="og:description"]',
      'meta[name="description"]'
    ]),
    brand: metaContent($, ['meta[property="product:brand"]', 'meta[itemprop="brand"]']),
    price,
    currency: currency?.toUpperCase() ?? (priceText ? detectCurrency(priceText) : null),
    priceSource: price != null ? 'open-graph' : undefined
  };
}

function extractFromMicrodata($: cheerio.CheerioAPI): Partial<ScrapedProduct> {
  const node = $('[itemprop="price"]').first();
  if (node.length === 0) return {};

  const raw = node.attr('content') ?? node.text();
  const price = raw ? parsePriceString(raw) : null;
  if (price == null) return {};

  const currency =
    $('[itemprop="priceCurrency"]').first().attr('content')?.toUpperCase() ??
    detectCurrency(raw);

  return { price, currency, priceSource: 'microdata' };
}

/**
 * Recovers a sale/list pair from the rendered markup.
 *
 * Every storefront marks a discount the same two ways underneath the styling:
 * the old price is struck through (a `<del>`/`<s>` element, a `line-through`
 * style, or a class saying so), and the live price is not. Reading that visual
 * convention keeps this store-agnostic — no per-retailer selectors.
 */
const ORIGINAL_HINT =
  /old|orig|list|regular|was[-_]|strike|through|prc-org|eski|piyasa|before|compare/i;
const CURRENT_HINT =
  /sale|discount|current|now|special|prc-dsc|new-?price|indirim|sepet|final|checkout/i;

function extractDiscountPair(
  $: cheerio.CheerioAPI
): Partial<ScrapedProduct> & { seen: number } {
  const original: number[] = [];
  const current: number[] = [];
  let neutral = 0;

  // Modern storefronts ship hashed CSS class names, so the class attribute is
  // often meaningless. Test-id and data attributes survive the build and are
  // where the semantic name ("checkout-price", "old-price") actually lives.
  $(
    [
      'del',
      's',
      'strike',
      'ins',
      '[class*="price" i]',
      '[class*="fiyat" i]',
      '[class*="prc" i]',
      '[id*="price" i]',
      '[data-test-id*="price" i]',
      '[data-testid*="price" i]',
      '[data-test*="price" i]',
      '[itemprop="price"]',
      '[itemprop="highPrice"]'
    ].join(', ')
  )
    .slice(0, 400)
    .each((_, element) => {
      const node = $(element);
      // Only leaf-ish nodes; a wrapper's text concatenates both prices.
      if (node.children().length > 2) return;

      const text = node.text().trim();
      if (!text || text.length > 40) return;

      const value = parsePriceString(text);
      if (value == null) return;

      const tag = (element as { tagName?: string }).tagName?.toLowerCase() ?? '';
      const marker = [
        node.attr('class'),
        node.attr('id'),
        node.attr('data-test-id'),
        node.attr('data-testid'),
        node.attr('data-test'),
        node.attr('itemprop')
      ]
        .filter(Boolean)
        .join(' ');
      const struck =
        tag === 'del' ||
        tag === 's' ||
        tag === 'strike' ||
        /line-through/i.test(node.attr('style') ?? '') ||
        ORIGINAL_HINT.test(marker);

      if (struck) original.push(value);
      else if (tag === 'ins' || CURRENT_HINT.test(marker)) current.push(value);
      else neutral += 1;
    });

  return {
    price: current.length ? Math.min(...current) : undefined,
    originalPrice: original.length ? Math.max(...original) : undefined,
    /**
     * Whether the markup showed a price anywhere at all. Zero means the store
     * builds its price block in the browser, so the served HTML cannot reveal
     * a discount no matter how it is parsed.
     */
    seen: current.length + original.length + neutral
  };
}

/** Last resort: a lira-denominated number in the visible body copy. */
function extractFromText($: cheerio.CheerioAPI): Partial<ScrapedProduct> {
  const body = $('body').text().replace(/\s+/g, ' ').slice(0, 30_000);
  const match = body.match(
    /(?:₺|\bTL\b|\bTRY\b)\s*([\d.,]{2,15})|([\d.,]{2,15})\s*(?:₺|\bTL\b|\bTRY\b)/i
  );
  if (!match) return {};

  const price = parsePriceString(match[1] ?? match[2] ?? '');
  if (price == null) return {};

  return { price, currency: 'TRY', priceSource: 'text' };
}

function absoluteUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function findFavicon($: cheerio.CheerioAPI, base: string): string | null {
  const href =
    $('link[rel="icon"]').first().attr('href') ??
    $('link[rel="shortcut icon"]').first().attr('href') ??
    $('link[rel="apple-touch-icon"]').first().attr('href');
  return absoluteUrl(href ?? '/favicon.ico', base);
}

function confidenceFor(source: PriceSource | null): ScrapedProduct['confidence'] {
  switch (source) {
    case 'json-ld':
    case 'discount':
      return 'high';
    case 'open-graph':
    case 'microdata':
      return 'medium';
    case 'text':
      return 'low';
    default:
      return 'none';
  }
}

/**
 * Fetches and parses a product page.
 *
 * An attempt only counts as a success once a price has actually been parsed.
 * That matters because the common anti-bot failure on Trendyol is not an error
 * status — it is a 200 carrying the store's homepage, which parses cleanly and
 * yields nothing. Treating "no price" as a retryable outcome lets a second
 * proxy IP recover the page instead of pushing the customer to type the price.
 */
export async function scrapeProduct(
  rawUrl: string,
  options: { allowRender?: boolean } = {}
): Promise<ScrapeOutcome> {
  const config = scraperApiConfig();
  const mode = transportMode();

  const useDirect = mode !== 'always';
  const proxyAttempts = config && mode !== 'off' ? config.maxAttempts : 0;

  let attempts = 0;
  let lastFailure: FetchFailure | null = null;
  /** Best result that parsed but had no price — returned if nothing better lands. */
  let bestPartial: { product: ScrapedProduct; via: TransportName } | null = null;
  let pricesInMarkup = true;

  const diagnostics = (via: TransportName | null): ScrapeDiagnostics => ({
    via,
    attempts,
    scraperApiConfigured: config != null,
    pricesInMarkup
  });

  for (let step = 0; step < (useDirect ? 1 : 0) + proxyAttempts; step += 1) {
    const useProxy = useDirect ? step > 0 : true;

    // Stores with adaptive protection score a burst of identical requests as
    // bot traffic, so retries are spaced with jitter rather than fired flat out.
    if (step > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, 400 + Math.floor(Math.random() * 500))
      );
    }

    attempts += 1;

    const attempt =
      useProxy && config
        ? await fetchViaScraperApi(rawUrl, config)
        : await fetchDirect(rawUrl);

    if (!attempt.ok) {
      lastFailure = attempt.failure;
      // A bad URL will fail identically on every transport.
      if (attempt.failure.reason === 'invalid_url') break;
      continue;
    }

    const parsed = parseDocument(attempt.document.html, attempt.document.finalUrl);
    let product = parsed.product;
    pricesInMarkup = parsed.pricesInMarkup;

    if (product.price != null) {
      // Stores like Hepsiburada ship no price in their HTML at all and build
      // the price block in the browser, so the only figure we can read from
      // the served markup is the JSON-LD list price — the customer would be
      // quoted above the sale price actually on offer.
      //
      // Reading what a shopper sees needs a rendered fetch, which costs ~30s.
      // That is far too long to make someone wait for a first number, so the
      // request path skips it and the caller refines in the background.
      if (options.allowRender && !parsed.pricesInMarkup && config && mode !== 'off') {
        for (let renderTry = 0; renderTry < RENDER_ATTEMPTS; renderTry += 1) {
          attempts += 1;
          const rendered = await fetchViaScraperApi(rawUrl, config, { render: true });
          if (!rendered.ok) continue;

          const live = parseDocument(rendered.document.html, rendered.document.finalUrl);
          product = reconcileDiscount(product, live.product);
          return {
            status: 'ok',
            product,
            diagnostics: diagnostics(rendered.document.via)
          };
        }
      }
      return { status: 'ok', product, diagnostics: diagnostics(attempt.document.via) };
    }

    if (!bestPartial || (product.title && !bestPartial.product.title)) {
      bestPartial = { product, via: attempt.document.via };
    }
    lastFailure = {
      kind: 'blocked',
      reason: 'http_error',
      via: attempt.document.via
    };
  }

  if (bestPartial) {
    return {
      status: 'no_price',
      product: bestPartial.product,
      diagnostics: diagnostics(bestPartial.via)
    };
  }

  if (lastFailure?.kind === 'unreachable') {
    return {
      status: 'unreachable',
      reason: lastFailure.reason as 'timeout' | 'network' | 'invalid_url',
      diagnostics: diagnostics(lastFailure.via)
    };
  }

  return {
    status: 'blocked',
    reason: lastFailure?.reason === 'bot_challenge' ? 'bot_challenge' : 'http_error',
    httpStatus: lastFailure?.httpStatus,
    diagnostics: diagnostics(lastFailure?.via ?? null)
  };
}

type ParsedPage = {
  product: ScrapedProduct;
  /**
   * False when the served markup contained no price text at all, which means
   * the store renders its price client-side and any discount is invisible here.
   */
  pricesInMarkup: boolean;
};

/**
 * Merges a rendered read over the cheap one.
 *
 * The rendered DOM is the shopper's view, so its price wins — but only
 * downwards. A rendered figure *above* the structured-data price would mean we
 * misread something, and quoting the higher of two numbers is never the answer.
 */
/** Rendered fetches are slow and billed, so the ceiling stays low. */
const RENDER_ATTEMPTS = 2;

function reconcileDiscount(
  fast: ScrapedProduct,
  live: ScrapedProduct
): ScrapedProduct {
  if (live.price == null) return fast;
  if (fast.price != null && live.price >= fast.price) {
    // No discount found; keep the richer metadata but note the list price.
    return { ...fast, originalPrice: fast.originalPrice ?? live.originalPrice };
  }

  const original =
    live.originalPrice ??
    (fast.price != null && isPlausibleDiscount(live.price, fast.price)
      ? fast.price
      : null);

  return {
    ...fast,
    price: live.price,
    originalPrice: original,
    priceSource: 'discount',
    confidence: 'high'
  };
}

function parseDocument(html: string, finalUrl: string): ParsedPage {
  const $ = cheerio.load(html);

  const jsonLd = extractFromJsonLd($);
  const meta = extractFromMeta($);
  const microdata = extractFromMicrodata($);

  // Merge in reliability order; the first source with a price wins.
  let merged: Partial<ScrapedProduct> = {
    ...meta,
    ...microdata,
    ...Object.fromEntries(
      Object.entries(jsonLd).filter(([, value]) => value != null)
    )
  };

  const domPair = extractDiscountPair($);

  // The DOM only overrides structured data when it finds a *cheaper* live
  // price — i.e. the store's JSON-LD advertised the list price while the page
  // shows a sale. It is never allowed to raise a quote.
  if (
    merged.price != null &&
    domPair.price != null &&
    domPair.price < merged.price &&
    isPlausibleDiscount(domPair.price, merged.price)
  ) {
    merged.originalPrice ??= merged.price;
    merged.price = domPair.price;
    merged.priceSource = 'discount';
  }

  if (merged.price == null && domPair.price != null) {
    merged.price = domPair.price;
    merged.priceSource = 'discount';
  }

  merged.originalPrice ??= domPair.originalPrice ?? undefined;

  if (merged.price == null) {
    merged = { ...merged, ...extractFromText($) };
  }

  // A "list price" at or below what we charge is not a discount — drop it
  // rather than render a nonsensical strikethrough.
  let originalPrice = merged.originalPrice ?? null;
  if (
    originalPrice != null &&
    (merged.price == null ||
      originalPrice <= merged.price ||
      !isPlausibleDiscount(merged.price, originalPrice))
  ) {
    originalPrice = null;
  }

  const product: ScrapedProduct = {
    title: merged.title ?? null,
    imageUrl: absoluteUrl(merged.imageUrl ?? null, finalUrl),
    price: merged.price ?? null,
    originalPrice,
    currency: merged.currency ?? null,
    weightKg: merged.weightKg ?? null,
    brand: merged.brand ?? null,
    category: merged.category ?? null,
    description: merged.description ? merged.description.slice(0, 600) : null,
    faviconUrl: findFavicon($, finalUrl),
    priceSource: merged.priceSource ?? null,
    confidence: confidenceFor(merged.priceSource ?? null)
  };

  return { product, pricesInMarkup: domPair.seen > 0 };
}
