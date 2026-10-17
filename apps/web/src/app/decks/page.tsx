import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CardLine } from '@/components/cards/card-line';
import { Button, buttonClasses } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Window } from '@/components/ui/window';
import { getDatabase } from '@/server/db';
import { listDecks } from '@/server/decks/decks';
import { requireUser } from '@/server/web/current-user';
import { deleteDeckAction, makeDeckActive } from './actions';
import { describeViolation, violationKey } from './describe-violation';
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
        <DeckList />
      </Suspense>
    </main>
  );
}

async function DeckList() {
  const user = await requireUser();
  const decks = listDecks(getDatabase(), user.id);

  if (decks.length === 0) {
    return <p className="mt-6 text-slate-300">You have no decks yet.</p>;
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {decks.map((deck) => (
        <Window key={deck.id} className="p-5" aria-label={deck.name}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold tracking-wider text-cream">
                {deck.name}
              </h2>
              <p className="text-xs text-slate-300/70">{deck.size} cards</p>
            </div>
            <div className="flex items-center gap-2">
              {deck.isActive ? (
                <span className="rounded-sm bg-action px-3 py-1 text-sm font-semibold ring-1 ring-white/60">
                  Active
                </span>
              ) : (
                <form action={makeDeckActive}>
                  <input type="hidden" name="deckId" value={deck.id} />
                  <Button type="submit" variant="secondary" className="!py-1 text-sm">
                    Make active
                  </Button>
                </form>
              )}
              <Link
                href={`/decks/${deck.id}`}
                className={buttonClasses('secondary', '!py-1 text-sm')}
              >
                Edit
              </Link>
              <form action={deleteDeckAction}>
                <input type="hidden" name="deckId" value={deck.id} />
                <ConfirmButton variant="quiet" confirmation={`Delete the deck "${deck.name}"?`}>
                  Delete
                </ConfirmButton>
              </form>
            </div>
          </div>

          {deck.violations.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-md bg-status-live/30 px-3 py-2 text-sm">
              {deck.violations.map((violation) => (
                <li key={violationKey(violation)}>{describeViolation(violation)}</li>
              ))}
            </ul>
          )}

          <ul className="mt-4 space-y-1.5">
            {deck.entries.map(({ card, quantity }) => (
              <li key={card.id}>
                <CardLine
                  name={card.name}
                  stats={card.stats}
                  element={card.element}
                  stars={card.stars}
                  count={`×${String(quantity)}`}
                />
              </li>
            ))}
          </ul>
        </Window>
      ))}
    </div>
  );
}
