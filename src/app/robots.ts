import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Generative and answer engines are welcome; the quote endpoint is not
      // something they should be crawling.
      { userAgent: '*', allow: '/', disallow: ['/api/'] }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
