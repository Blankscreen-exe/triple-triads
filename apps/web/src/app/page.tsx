import Link from 'next/link';
import { Suspense } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { Window } from '@/components/ui/window';
import { getDatabase } from '@/server/db';
import { listDecks } from '@/server/decks/decks';
import { getCurrentUser } from '@/server/web/current-user';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Window className="p-8 text-center">
        <h1 className="font-display text-3xl font-bold tracking-wider text-cream">Triple Triad</h1>
        <p className="mt-3 text-slate-200">
          The card game from Final Fantasy VIII, with your own cards and decks.
        </p>
        <Suspense fallback={<div className="mt-6 h-10" aria-hidden />}>
          <Welcome />
        </Suspense>
      </Window>
    </main>
  );
}

async function Welcome() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/signup" className={buttonClasses('primary')}>
          Create an account
        </Link>
        <Link href="/login" className={buttonClasses('secondary')}>
          Log in
        </Link>
      </div>
    );
  }

  const activeDeck = listDecks(getDatabase(), user.id).find((deck) => deck.isActive);
  return (
    <div className="mt-6 space-y-4">
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
    </div>
  );
}
