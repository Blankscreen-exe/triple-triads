import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getDatabase } from '@/server/db';
import { getGameSettings } from '@/server/settings/settings';
import { requireUser } from '@/server/web/current-user';
import { Lobby } from './lobby';

export const metadata: Metadata = { title: 'Play' };

export default function PlayPage() {
  return (
    // On phones the page is exactly the screen's height below the header: the room list pages
    // instead of the page scrolling (the Create room tab scrolls within it if it must).
    <main className="mx-auto max-w-6xl px-4 py-8 max-sm:flex max-sm:h-[calc(100dvh-3.5rem)] max-sm:flex-col max-sm:overflow-y-auto max-sm:py-3">
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream max-sm:mb-3 max-sm:text-xl">
        Play
      </h1>
      <p className="mt-1 mb-6 text-sm text-slate-300/80 max-sm:hidden">
        Join a room, watch a game, or create your own. You play with your active deck.
      </p>
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <LobbyLoader />
      </Suspense>
    </main>
  );
}

async function LobbyLoader() {
  const user = await requireUser();
  return <Lobby username={user.username} policy={getGameSettings(getDatabase()).roomPolicy} />;
}
