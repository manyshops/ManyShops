/**
 * Canonical origin, used for metadata, hreflang, sitemap and JSON-LD @ids.
 * Set NEXT_PUBLIC_SITE_URL in the deployment environment.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://manyshops.com'
).replace(/\/$/, '');
