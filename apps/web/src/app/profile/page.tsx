import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PlayerRecord } from '@/components/player-record';
import { buttonClasses } from '@/components/ui/button';
import { Window } from '@/components/ui/window';
import { getDatabase } from '@/server/db';
import { listDecks } from '@/server/decks/decks';
import { getPlayerStats, listRecentMatches } from '@/server/matches/matches';
import { requireUser } from '@/server/web/current-user';

export const metadata: Metadata = { title: 'Profile' };

/** The signed-in player's page: active deck, rating, record and recent matches. */
export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Profile</h1>
      <Suspense fallback={<p className="mt-6 text-slate-300">Loading…</p>}>
        <Profile />
      </Suspense>
    </main>
  );
}

async function Profile() {
  const user = await requireUser();
  const db = getDatabase();
  const activeDeck = listDecks(db, user.id).find((deck) => deck.isActive);
  const stats = getPlayerStats(db, user.id);

  return (
    <Window className="mt-6 space-y-4 p-8 text-center">
      <p className="text-slate-100">
        Welcome back, <span className="font-semibold text-cream">{user.username}</span>.
        {activeDeck && (
          <>
            {' '}
            Your active deck is <span className="font-semibold text-cream">{activeDeck.name}</span>.
          </>
        )}
      </p>
      <div className="flex justify-center gap-3">
        <Link href="/play" className={buttonClasses('primary')}>
          Play
        </Link>
        <Link href="/decks" className={buttonClasses('secondary')}>
          Your decks
        </Link>
      </div>
      {stats && <PlayerRecord stats={stats} recent={listRecentMatches(db, user.id, 5)} />}
    </Window>
  );
}
