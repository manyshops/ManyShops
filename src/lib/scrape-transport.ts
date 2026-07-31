import 'server-only';
import { assertPublicHttpUrl } from './store.guard';
import { InvalidUrlError } from './store';

/**
 * How we actually get a storefront's HTML.
 *
 * Two transports, tried in order:
 *
 *   direct       — a plain outbound fetch dressed as a real Chrome request.
 *                  Free and fast; works on the many Turkish stores that do not
 *                  run bot protection (LC Waikiki, Koton, most Shopify shops).
 *
 *   scraper-api  — ScraperAPI's unblocking proxy, used only when the direct
 *                  attempt fails. Trendyol and Hepsiburada sit behind bot
 *                  protection that a header-spoofed fetch cannot pass.
 *
 * Two things were established empirically against the live sites and drive the
 * defaults below:
 *
 *   1. Trendyol geo-redirects non-Turkish IPs to its homepage, so ScraperAPI
 *      requests must carry `country_code=tr`. Without it every product URL
 *      returns 200 with the homepage and no product data.
 *   2. Even with Turkish geotargeting the bounce still happens on a minority of
 *      proxy IPs, so the caller retries; each attempt draws a different IP.
 */

export type TransportName = 'direct' | 'scraper-api';

export type FetchedDocument = {
  html: string;
  /** URL the content actually came from, after redirects. */
  finalUrl: string;
  via: TransportName;
};

export type FetchFailure = {
  kind: 'blocked' | 'unreachable';
  reason: 'bot_challenge' | 'http_error' | 'timeout' | 'network' | 'invalid_url' | 'not_configured';
  httpStatus?: number;
  via: TransportName;
};

export type FetchAttempt =
  | { ok: true; document: FetchedDocument }
  | { ok: false; failure: FetchFailure };

const DIRECT_TIMEOUT_MS = 12_000;
/** The proxy has to do a full browser round trip on the far side. */
const SCRAPER_API_TIMEOUT_MS = 45_000;
/** Rendered reads run a real browser remotely and legitimately take ~30s. */
const SCRAPER_API_RENDER_TIMEOUT_MS = 55_000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 4;

/**
 * A complete, self-consistent Chrome fingerprint. Sending a modern User-Agent
 * without the matching client hints and Sec-Fetch metadata is itself a bot
 * signal, so these travel together.
 */
export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Ch-Ua': '"Chromium";v="125", "Google Chrome";v="125", "Not.A/Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
  DNT: '1'
};

// --- ScraperAPI configuration -------------------------------------------------

export type ScraperApiConfig = {
  apiKey: string;
  endpoint: string;
  /** Proxy exit country. `tr` is required for Turkish storefronts. */
  countryCode: string | null;
  /**
   * Runs the page in a real browser. Slow (~25s) and costs more credits — and
   * measured *worse* than a plain request on Trendyol, where every rendered
   * attempt bounced to the homepage. Off unless a store genuinely needs JS.
   */
  render: boolean;
  premium: boolean;
  /** How many proxy attempts to spend before giving up on a URL. */
  maxAttempts: number;
};

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

export function scraperApiConfig(): ScraperApiConfig | null {
  const apiKey = process.env.SCRAPER_API_KEY?.trim();
  if (!apiKey) return null;

  const country = process.env.SCRAPER_API_COUNTRY?.trim().toLowerCase();
  const maxAttempts = Number.parseInt(process.env.SCRAPER_API_MAX_ATTEMPTS ?? '', 10);

  return {
    apiKey,
    endpoint: process.env.SCRAPER_API_ENDPOINT?.trim() || 'https://api.scraperapi.com/',
    // `none` disables geotargeting; anything else, including unset, targets Turkey.
    countryCode: country === 'none' ? null : country || 'tr',
    render: envFlag('SCRAPER_API_RENDER', false),
    premium: envFlag('SCRAPER_API_PREMIUM', false),
    // Measured against Trendyol: a single proxy attempt lands the product page
    // roughly half the time, so 3 gets us to ~90% and 4 to ~95%. Each attempt
    // costs credits, so this is a cost/reliability dial rather than a constant.
    maxAttempts:
      Number.isInteger(maxAttempts) && maxAttempts > 0
        ? Math.min(maxAttempts, 6)
        : 3
  };
}

/** `auto` uses the proxy only after a direct attempt fails. */
export type TransportMode = 'auto' | 'always' | 'off';

export function transportMode(): TransportMode {
  const raw = process.env.SCRAPER_API_MODE?.trim().toLowerCase();
  return raw === 'always' || raw === 'off' ? raw : 'auto';
}

// --- Response decoding --------------------------------------------------------

/**
 * Reads the body as bytes and decodes it with the charset the page declares.
 *
 * Decoding has to be explicit for two reasons: some Turkish stores still serve
 * windows-1254, and `response.text()` under Next's patched fetch was observed
 * mangling correct UTF-8 into windows-1252 mojibake ("Bağcıklı" -> "BaÄŸcÄ±klÄ±"),
 * which would then flow into the AI weight estimate and the order message.
 */
async function readBody(response: Response): Promise<string> {
  const chunks: Uint8Array[] = [];
  let received = 0;

  const reader = response.body?.getReader();
  if (reader) {
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
    await reader.cancel().catch(() => undefined);
  } else {
    const buffer = new Uint8Array(await response.arrayBuffer());
    chunks.push(buffer.subarray(0, MAX_BYTES));
    received = Math.min(buffer.byteLength, MAX_BYTES);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    const room = received - offset;
    if (room <= 0) break;
    const slice = chunk.byteLength > room ? chunk.subarray(0, room) : chunk;
    bytes.set(slice, offset);
    offset += slice.byteLength;
  }

  return decodeBytes(bytes, response.headers.get('content-type'));
}

export function decodeBytes(bytes: Uint8Array, contentType: string | null): string {
  const declared = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];

  // The header can lie or be absent; the document's own <meta> wins if it
  // disagrees, matching what a browser does.
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const meta =
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    head.match(/<meta[^>]+content=["'][^"']*charset=([\w-]+)/i)?.[1];

  for (const label of [meta, declared, 'utf-8']) {
    if (!label) continue;
    try {
      return new TextDecoder(label, { fatal: false }).decode(bytes);
    } catch {
      // Unknown label — fall through to the next candidate.
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/** Cloudflare/Akamai/PerimeterX interstitials answer 200 with a challenge body. */
export function looksLikeChallenge(html: string): boolean {
  if (html.length > 60_000) return false;
  const probe = html.slice(0, 20_000).toLowerCase();
  return (
    probe.includes('cf-browser-verification') ||
    probe.includes('just a moment') ||
    probe.includes('checking your browser') ||
    probe.includes('/cdn-cgi/challenge-platform') ||
    probe.includes('px-captcha') ||
    probe.includes('access denied') ||
    probe.includes('enable javascript and cookies to continue')
  );
}

// --- Transports ---------------------------------------------------------------

/**
 * Direct fetch with manual redirect handling, so every hop is re-checked
 * against the SSRF guard rather than trusting the first host.
 */
export async function fetchDirect(startUrl: string): Promise<FetchAttempt> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let target: URL;
    try {
      target = await assertPublicHttpUrl(current);
    } catch (error) {
      if (error instanceof InvalidUrlError) {
        return {
          ok: false,
          failure: { kind: 'unreachable', reason: 'invalid_url', via: 'direct' }
        };
      }
      throw error;
    }

    let response: Response;
    try {
      response = await fetch(target.toString(), {
        headers: BROWSER_HEADERS,
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS)
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      return {
        ok: false,
        failure: {
          kind: 'unreachable',
          reason: timedOut ? 'timeout' : 'network',
          via: 'direct'
        }
      };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return {
          ok: false,
          failure: {
            kind: 'blocked',
            reason: 'http_error',
            httpStatus: response.status,
            via: 'direct'
          }
        };
      }
      current = new URL(location, target).toString();
      continue;
    }

    if ([401, 403, 429].includes(response.status)) {
      return {
        ok: false,
        failure: {
          kind: 'blocked',
          reason: 'bot_challenge',
          httpStatus: response.status,
          via: 'direct'
        }
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        failure: {
          kind: 'blocked',
          reason: 'http_error',
          httpStatus: response.status,
          via: 'direct'
        }
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('html') && !contentType.includes('xml')) {
      return {
        ok: false,
        failure: { kind: 'unreachable', reason: 'network', via: 'direct' }
      };
    }

    const html = await readBody(response);
    if (looksLikeChallenge(html)) {
      return {
        ok: false,
        failure: { kind: 'blocked', reason: 'bot_challenge', via: 'direct' }
      };
    }

    return { ok: true, document: { html, finalUrl: target.toString(), via: 'direct' } };
  }

  return {
    ok: false,
    failure: { kind: 'unreachable', reason: 'network', via: 'direct' }
  };
}

/**
 * Routes the request through ScraperAPI, which handles the proxy pool, the
 * TLS fingerprint and any challenge on the far side, then returns the HTML.
 */
export async function fetchViaScraperApi(
  targetUrl: string,
  config: ScraperApiConfig,
  overrides: { render?: boolean } = {}
): Promise<FetchAttempt> {
  // Validate before spending a credit — and so the proxy is never handed a
  // host the direct transport would have refused.
  try {
    await assertPublicHttpUrl(targetUrl);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      return {
        ok: false,
        failure: { kind: 'unreachable', reason: 'invalid_url', via: 'scraper-api' }
      };
    }
    throw error;
  }

  const payload = new URLSearchParams({
    api_key: config.apiKey,
    url: targetUrl
  });
  if (config.countryCode) payload.set('country_code', config.countryCode);
  const renderRequested = overrides.render ?? config.render;
  if (renderRequested) payload.set('render', 'true');
  if (config.premium) payload.set('premium', 'true');

  let response: Response;
  try {
    response = await fetch(`${config.endpoint}?${payload.toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(
        renderRequested ? SCRAPER_API_RENDER_TIMEOUT_MS : SCRAPER_API_TIMEOUT_MS
      )
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    return {
      ok: false,
      failure: {
        kind: 'unreachable',
        reason: timedOut ? 'timeout' : 'network',
        via: 'scraper-api'
      }
    };
  }

  // ScraperAPI passes the target's status through, and answers 401/403 itself
  // when the key is rejected or out of credits.
  if (!response.ok) {
    return {
      ok: false,
      failure: {
        kind: 'blocked',
        reason: response.status === 401 ? 'not_configured' : 'http_error',
        httpStatus: response.status,
        via: 'scraper-api'
      }
    };
  }

  const html = await readBody(response);
  if (looksLikeChallenge(html)) {
    return {
      ok: false,
      failure: { kind: 'blocked', reason: 'bot_challenge', via: 'scraper-api' }
    };
  }

  return {
    ok: true,
    document: {
      html,
      // `sa-final-url` reports where the proxy actually landed, which is how a
      // geo-bounce to the store's homepage is detected.
      finalUrl: response.headers.get('sa-final-url') ?? targetUrl,
      via: 'scraper-api'
    }
  };
}
