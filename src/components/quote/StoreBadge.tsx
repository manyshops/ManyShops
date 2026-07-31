'use client';

import { Store } from 'lucide-react';
import { useState } from 'react';

type Props = {
  brand: string;
  host: string;
  faviconUrl?: string | null;
  label?: string;
  tone?: 'light' | 'dark';
};

/**
 * Shows whichever store the customer's link belongs to. The favicon is pulled
 * from the store itself, so a brand we have never seen still renders natively —
 * there is no icon set to maintain and no store list to add to.
 */
export function StoreBadge({
  brand,
  host,
  faviconUrl,
  label,
  tone = 'light'
}: Props) {
  const [iconFailed, setIconFailed] = useState(false);
  const showIcon = Boolean(faviconUrl) && !iconFailed;

  const dark = tone === 'dark';

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl border px-3 py-2 ${
        dark
          ? 'border-white/15 bg-white/5'
          : 'border-navy-900/10 bg-sand-100/70'
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
          dark ? 'bg-white/10' : 'bg-white'
        }`}
      >
        {showIcon ? (
          <img
            src={faviconUrl ?? ''}
            alt=""
            width={22}
            height={22}
            loading="lazy"
            decoding="async"
            onError={() => setIconFailed(true)}
            className="size-[22px] object-contain"
          />
        ) : (
          <Store
            aria-hidden="true"
            className={`size-4 ${dark ? 'text-teal-300' : 'text-teal-500'}`}
          />
        )}
      </span>

      <span className="min-w-0 text-start">
        {label && (
          <span
            className={`block text-[11px] font-semibold uppercase tracking-wider ${
              dark ? 'text-white/45' : 'text-navy-800/45'
            }`}
          >
            {label}
          </span>
        )}
        <span
          className={`block truncate text-sm font-bold ${
            dark ? 'text-white' : 'text-navy-900'
          }`}
        >
          {brand}
        </span>
        <span
          className={`block truncate text-xs ${
            dark ? 'text-white/50' : 'text-navy-800/55'
          }`}
          dir="ltr"
        >
          {host}
        </span>
      </span>
    </div>
  );
}
