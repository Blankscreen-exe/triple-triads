import Link from 'next/link';
import { Suspense } from 'react';
import { getCurrentUser } from '@/server/web/current-user';
import { UserMenu } from './user-menu';

interface NavLink {
  readonly href: string;
  readonly label: string;
}

/** Pages that need an account: shown only to signed-in players. */
const PLAYER_LINKS: readonly NavLink[] = [
  { href: '/profile', label: 'Profile' },
  { href: '/play', label: 'Play' },
  { href: '/decks', label: 'Decks' },
  { href: '/cards', label: 'Card maker' },
  { href: '/packs', label: 'Card style' },
  { href: '/trunk', label: 'Trunk' },
];

/** Pages anyone can read. */
const PUBLIC_LINKS: readonly NavLink[] = [
  { href: '/rankings', label: 'Rankings' },
  { href: '/rules', label: 'Rules' },
];

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
        {/* Depends on the session, so it streams in; the public links show meanwhile. */}
        <Suspense fallback={<MainNav links={PUBLIC_LINKS} />}>
          <SessionNav />
        </Suspense>
      </div>
      {/* Reads the session cookie, so it streams in after the static header. */}
      <Suspense fallback={<div className="h-8 w-24" aria-hidden />}>
        <UserMenu />
      </Suspense>
    </header>
  );
}

async function SessionNav() {
  const user = await getCurrentUser();
  return <MainNav links={user ? [...PLAYER_LINKS, ...PUBLIC_LINKS] : PUBLIC_LINKS} />;
}

function MainNav({ links }: { readonly links: readonly NavLink[] }) {
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className="rounded px-3 py-1.5 text-sm text-slate-200/80 hover:bg-white/10 hover:text-white"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
