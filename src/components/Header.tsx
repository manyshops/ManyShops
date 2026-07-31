'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Logo } from './Logo';

const SECTIONS = [
  { id: 'how-it-works', key: 'howItWorks' },
  { id: 'pricing', key: 'pricing' },
  { id: 'faq', key: 'faq' }
] as const;

export function Header() {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8"
      >
        <Link
          href="/"
          className="shrink-0 rounded-lg"
          aria-label="ManyShops"
        >
          <Logo variant="full" priority className="w-[150px] sm:w-[176px]" />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full px-4 py-2 text-sm font-medium text-navy-800/75 transition-colors hover:bg-navy-900/6 hover:text-navy-900"
            >
              {t(section.key)}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <LocaleSwitcher />
          </div>
          <a
            href="#quote"
            className="hidden rounded-full bg-coral-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-coral-500/25 transition-transform hover:-translate-y-0.5 hover:bg-coral-400 sm:inline-flex"
          >
            {t('start')}
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t('close') : t('menu')}
            className="inline-flex size-10 items-center justify-center rounded-full border border-navy-900/12 bg-white text-navy-800 shadow-sm lg:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </nav>

      {open && (
        <div
          id="mobile-nav"
          className="mx-5 rounded-3xl border border-navy-900/10 bg-white p-5 shadow-2xl lg:hidden"
        >
          <ul className="flex flex-col gap-1">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-base font-medium text-navy-800/80 transition-colors hover:bg-sand-100 hover:text-navy-900"
                >
                  {t(section.key)}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3 border-t border-navy-900/10 pt-4">
            <LocaleSwitcher />
            <a
              href="#quote"
              onClick={() => setOpen(false)}
              className="rounded-full bg-coral-500 px-5 py-3 text-center text-sm font-semibold text-white"
            >
              {t('start')}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
