import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Logo } from './Logo';

const SECTIONS = [
  { id: 'how-it-works', key: 'howItWorks' },
  { id: 'pricing', key: 'pricing' },
  { id: 'faq', key: 'faq' }
] as const;

export function Footer() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-navy-900/10 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo variant="full" className="w-[170px]" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-800/70">
            {t('tagline')}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-navy-800/60">
            <MapPin aria-hidden="true" className="size-4 text-coral-500" />
            {t('builtIn')}
          </p>
        </div>

        <nav aria-label={t('product')}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-navy-800/45">
            {t('product')}
          </h2>
          <ul className="mt-4 space-y-3">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-navy-800/75 transition-colors hover:text-teal-500"
                >
                  {nav(section.key)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-navy-800/45">
            {t('company')}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-navy-800/70">
            &copy; {year} ManyShops. {t('rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
