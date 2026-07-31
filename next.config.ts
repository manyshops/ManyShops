import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Static export (this branch is built for InfinityFree, which only serves
  // static files): no Node server, so no next/image optimizer or `headers()`.
  output: 'export',
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp']
  }
};

export default withNextIntl(nextConfig);
