import Link from 'next/link';
import { routing } from '@/i18n/routing';

/**
 * Root-level 404. Requests that never matched a locale segment land here, so
 * this file cannot use next-intl translations — it renders before a locale is
 * resolved.
 */
export default function NotFound() {
  return (
    <html lang={routing.defaultLocale}>
      <body
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          margin: 0,
          background: '#f8fafc',
          color: '#0b2340',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
        }}
      >
        <main style={{ textAlign: 'center', padding: '2rem' }}>
          <img src="/logo.svg" alt="ManyShops" width={160} height={160} />
          <h1 style={{ fontSize: '1.5rem', margin: '1rem 0 0.5rem' }}>
            Page not found
          </h1>
          <p style={{ opacity: 0.7, margin: '0 0 1.5rem' }}>
            The page you were looking for does not exist.
          </p>
          <Link
            href={`/${routing.defaultLocale}`}
            style={{
              display: 'inline-block',
              background: '#0b2340',
              color: '#fff',
              padding: '0.75rem 1.5rem',
              borderRadius: '999px',
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            Go home
          </Link>
        </main>
      </body>
    </html>
  );
}
