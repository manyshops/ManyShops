import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

/**
 * Static export has no middleware to negotiate a locale at `/`, so this
 * always sends visitors to the default locale instead.
 */
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
