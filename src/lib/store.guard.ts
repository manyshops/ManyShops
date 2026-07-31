import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { InvalidUrlError, normalizeUrl } from './store';

/**
 * SSRF guard for the one place we fetch a customer-supplied URL.
 *
 * Kept out of `store.ts` so the brand-recognition logic stays importable from
 * client components — and marked `server-only` so a future import from the
 * browser fails the build instead of leaking Node built-ins into the bundle.
 */

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./
];

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return PRIVATE_V4.some((pattern) => pattern.test(address));
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80') ||
      // IPv4-mapped addresses smuggling a private v4 target through v6.
      (normalized.startsWith('::ffff:') &&
        isPrivateAddress(normalized.slice('::ffff:'.length)))
    );
  }
  return false;
}

const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.localhost', '.home.arpa'];

/**
 * Rejects URLs that would make the server fetch something on its own network.
 * Must be called again on every redirect target, not just the original URL.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(normalizeUrl(rawUrl));
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    hostname === 'localhost' ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new InvalidUrlError('That host is not reachable', 'private_host');
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new InvalidUrlError('That host is not reachable', 'private_host');
    }
    return parsed;
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new InvalidUrlError('We could not reach that store', 'unresolvable');
  }

  if (records.length === 0 || records.some((r) => isPrivateAddress(r.address))) {
    throw new InvalidUrlError('That host is not reachable', 'private_host');
  }

  return parsed;
}
