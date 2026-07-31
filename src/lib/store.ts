/**
 * Smart URL recognition.
 *
 * There is no store allowlist and no per-store button anywhere in this app —
 * the brand shown in the UI is derived from whatever hostname the customer
 * pasted. This module is deliberately free of Node built-ins so the same
 * recognition runs in the browser as you type; the SSRF guard that the server
 * applies before fetching lives in `store.guard.ts`.
 */

export type StoreIdentity = {
  /** Normalised absolute URL. */
  url: string;
  hostname: string;
  /** Hostname with `www.`/`m.` stripped — what we show under the logo. */
  displayHost: string;
  /** Registrable label, e.g. `trendyol` from `www.trendyol.com`. */
  slug: string;
  /** Title-cased brand name derived from the slug. */
  brand: string;
  /** Best-effort favicon URL served by the store itself. */
  faviconUrl: string;
  /** True when the domain looks Turkish (`.tr`, `.com.tr`, …). */
  looksTurkish: boolean;
};

export class InvalidUrlError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'empty'
      | 'malformed'
      | 'scheme'
      | 'private_host'
      | 'unresolvable'
  ) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

/**
 * Multi-label public suffixes we need to see through to find the registrable
 * label. Turkish stores overwhelmingly sit on `.com.tr`, so this stays small
 * and targeted rather than shipping a full PSL.
 */
const MULTI_LABEL_SUFFIXES = new Set([
  'com.tr',
  'net.tr',
  'org.tr',
  'gen.tr',
  'co.uk',
  'com.au',
  'co.jp',
  'com.br',
  'com.lb'
]);

const HOST_PREFIXES = ['www.', 'm.', 'mobile.', 'shop.', 'store.'];

/** Words that should keep their conventional casing in a brand name. */
const BRAND_CASING: Record<string, string> = {
  lcwaikiki: 'LC Waikiki',
  lcw: 'LC Waikiki',
  defacto: 'DeFacto',
  hepsiburada: 'Hepsiburada',
  n11: 'n11',
  gittigidiyor: 'GittiGidiyor',
  ciceksepeti: 'ÇiçekSepeti',
  mediamarkt: 'MediaMarkt',
  hm: 'H&M',
  asos: 'ASOS',
  mango: 'MANGO'
};

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new InvalidUrlError('No link provided', 'empty');
  }
  // Customers paste links from apps that omit the scheme.
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new InvalidUrlError('That does not look like a link', 'malformed');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError('Only http and https links are supported', 'scheme');
  }
  if (!parsed.hostname.includes('.')) {
    throw new InvalidUrlError('That does not look like a store link', 'malformed');
  }

  parsed.hash = '';
  return parsed.toString();
}

function stripPrefix(hostname: string): string {
  const lower = hostname.toLowerCase();
  for (const prefix of HOST_PREFIXES) {
    if (lower.startsWith(prefix)) return lower.slice(prefix.length);
  }
  return lower;
}

function registrableLabel(hostname: string): string {
  const labels = stripPrefix(hostname).split('.');
  if (labels.length < 2) return labels[0] ?? hostname;

  const lastTwo = labels.slice(-2).join('.');
  const sliceLength = MULTI_LABEL_SUFFIXES.has(lastTwo) ? 3 : 2;
  const registrable = labels.slice(-sliceLength);
  return registrable[0] ?? hostname;
}

function toBrandName(slug: string): string {
  const known = BRAND_CASING[slug.toLowerCase()];
  if (known) return known;

  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Parses a URL into the brand identity the UI renders. Does not hit the network. */
export function identifyStore(rawUrl: string): StoreIdentity {
  const url = normalizeUrl(rawUrl);
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const displayHost = stripPrefix(hostname);
  const slug = registrableLabel(hostname);

  return {
    url,
    hostname,
    displayHost,
    slug,
    brand: toBrandName(slug),
    faviconUrl: `${parsed.origin}/favicon.ico`,
    looksTurkish: hostname.endsWith('.tr')
  };
}
