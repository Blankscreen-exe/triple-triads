import Link from 'next/link';
import { Suspense } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { Window } from '@/components/ui/window';
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
          <Actions />
        </Suspense>
        <p className="mt-6 text-sm text-slate-300/80">
          New to the game?{' '}
          <Link href="/rules" className="text-cream underline">
            Read how to play
          </Link>
          .
        </p>
      </Window>
    </main>
  );
}

/** Sign-up and log-in for visitors; the way in for players. */
async function Actions() {
  const user = await getCurrentUser();
  return (
    <div className="mt-6 flex justify-center gap-3">
      {user ? (
        <>
          <Link href="/play" className={buttonClasses('primary')}>
            Play
          </Link>
          <Link href="/profile" className={buttonClasses('secondary')}>
            Your profile
          </Link>
        </>
      ) : (
        <>
          <Link href="/signup" className={buttonClasses('primary')}>
            Create an account
          </Link>
          <Link href="/login" className={buttonClasses('secondary')}>
            Log in
          </Link>
        </>
      )}
    </div>
  );
}
