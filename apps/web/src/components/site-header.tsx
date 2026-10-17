import Link from 'next/link';
import { Suspense } from 'react';
import { UserMenu } from './user-menu';

const NAV_LINKS = [
  { href: '/play', label: 'Play' },
  { href: '/decks', label: 'Decks' },
  { href: '/trunk', label: 'Trunk' },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b-2 border-frame/70 bg-linear-to-b from-header-top to-header-bottom px-6 py-3 shadow-lg">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="font-display text-xl font-bold tracking-[0.2em] text-cream uppercase [text-shadow:0_2px_0_#000]"
        >
          Triple Triad
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-1.5 text-sm text-slate-200/80 hover:bg-white/10 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {/* Reads the session cookie, so it streams in after the static header. */}
      <Suspense fallback={<div className="h-8 w-24" aria-hidden />}>
        <UserMenu />
      </Suspense>
    </header>
  );
}
