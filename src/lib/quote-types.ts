import type { PriceBreakdown } from './pricing';
import type { StoreIdentity } from './store';
import type { WeightEstimate } from './weight';

/** Successful /api/quote response. */
export type Quote = {
  store: StoreIdentity;
  product: {
    title: string | null;
    imageUrl: string | null;
    brand: string | null;
    category: string | null;
    faviconUrl: string | null;
  };
  weight: WeightEstimate;
  breakdown: PriceBreakdown;
  /** Store's pre-discount lira price, when the listing is on sale. */
  originalUnitPriceTry: number | null;
  priceSource: string | null;
  /** Transport that read the page: 'direct', 'scraper-api', 'cache', or null. */
  via: string | null;
  /**
   * True while a slower rendered read may still find a lower price. The client
   * polls and swaps the quote in if one lands.
   */
  refining: boolean;
  exchangeRate: number;
  quotedAt: string;
};

/** Shapes /api/quote returns with a 200 when it needs the customer's help. */
export type QuoteNeedsInput = {
  error:
    | 'store_blocked'
    | 'store_unreachable'
    | 'price_not_found'
    | 'unsupported_currency';
  store: StoreIdentity;
  currency?: string;
  needsManualPrice: true;
};

export type QuoteError = {
  error: 'invalid_url' | 'rate_limited' | 'bad_request' | 'network';
  code?: string;
};

export type QuoteResponse = Quote | QuoteNeedsInput | QuoteError;

export function isQuote(value: QuoteResponse): value is Quote {
  return 'breakdown' in value;
}

export function needsManualPrice(
  value: QuoteResponse
): value is QuoteNeedsInput {
  return 'needsManualPrice' in value && value.needsManualPrice === true;
}
