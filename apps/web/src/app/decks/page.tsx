import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Window } from '@/components/ui/window';
import { describeViolation } from '@/lib/deck-violations';
import { deckStats } from '@/lib/deck-stats';
import { getDatabase } from '@/server/db';
import { listDecks } from '@/server/decks/decks';
import { getGameSettings } from '@/server/settings/settings';
import { requireUser } from '@/server/web/current-user';
import { DeckList, type DeckListItem } from './deck-list';
import { NewDeckForm } from './new-deck-form';

export const metadata: Metadata = { title: 'Decks' };

export default function DecksPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Your decks</h1>
          <p className="mt-1 text-sm text-slate-300/80">
            Your active deck is the one you bring to a game.
          </p>
        </div>
        <NewDeckForm />
      </div>
      <Suspense fallback={<p className="mt-6 text-slate-300">Loading decks…</p>}>
        <Decks />
      </Suspense>
    </main>
  );
}

async function Decks() {
  const user = await requireUser();
  const db = getDatabase();
  const decks = listDecks(db, user.id);

  if (decks.length === 0) {
    return (
      <Window className="mt-6 p-6 text-center text-slate-200">
        You have no decks yet. Name one above to start building.
      </Window>
    );
  }

  const items = decks.map((deck): DeckListItem => {
    const stats = deckStats(
      deck.entries.map(({ card, quantity }) => ({
        stars: card.stars,
        score: card.score,
        element: card.element,
        quantity,
      })),
    );
    return {
      id: deck.id,
      name: deck.name,
      isActive: deck.isActive,
      isReady: deck.violations.length === 0,
      updatedAt: deck.updatedAt.getTime(),
      totalScore: stats.totalScore,
      stats,
      problems: deck.violations.map(describeViolation),
    };
  });

  return (
    <Window className="mt-6 p-5">
      <DeckList decks={items} deckSize={getGameSettings(db).deckRules.size} />
    </Window>
  );
}
