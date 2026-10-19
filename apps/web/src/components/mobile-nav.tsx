'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { NavLink } from './site-header';

/** The main links on narrow screens, behind a menu button. Closes when a link is chosen. */
export function MobileNav({ links }: { readonly links: readonly NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label="Menu"
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="flex size-9 items-center justify-center rounded-md border border-frame/60 bg-black/25 text-cream hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path
            d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="absolute inset-x-0 top-full border-b-2 border-frame/70 bg-header-bottom px-4 py-2 shadow-lg"
        >
          <ul className="grid grid-cols-2 gap-1">
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="block rounded px-3 py-2.5 text-slate-100 hover:bg-white/10"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
