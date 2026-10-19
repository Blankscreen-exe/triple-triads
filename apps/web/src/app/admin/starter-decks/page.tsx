import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CardLine } from '@/components/cards/card-line';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClasses } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Window } from '@/components/ui/window';
import { describeViolation, violationKey } from '@/lib/deck-violations';
import { pageFromQuery, pageHref, paginate } from '@/lib/pagination';
import { listStarterDecks } from '@/server/catalog/starter-decks';
import { getDatabase } from '@/server/db';
import { requireAdmin } from '@/server/web/current-user';
import { starterDeckAction } from '../actions';
import { NewStarterDeckForm } from './new-starter-deck-form';

export const metadata: Metadata = { title: 'Starter decks' };

/** Two rows of two on wide screens: each deck lists all its cards. */
const PAGE_SIZE = 4;

export default function AdminStarterDecksPage({ searchParams }: PageProps<'/admin/starter-decks'>) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-cream">
            Starter decks
          </h1>
          <p className="mt-1 text-sm text-slate-300/80">
            Every new player receives a copy of each. The default one starts as their active deck.
            Changes do not affect existing players.
          </p>
        </div>
        <NewStarterDeckForm />
      </div>
      <Suspense fallback={<p className="mt-4 text-slate-300">Loading…</p>}>
        <StarterDeckList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function StarterDeckList({
  searchParams,
}: Pick<PageProps<'/admin/starter-decks'>, 'searchParams'>) {
  await requireAdmin();
  const query = await searchParams;
  // A handful of decks: they are loaded together (their rules are checked as a set) and paged here.
  const all = listStarterDecks(getDatabase());
  const decks = paginate(all, pageFromQuery(query), PAGE_SIZE);
  if (all.length === 0) {
    return (
      <Window className="mt-6 p-6 text-slate-200">
        There are no starter decks: new players will start with an empty trunk.
      </Window>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {decks.items.map((deck) => (
          <Window key={deck.id} className="p-5" aria-label={deck.name}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold tracking-wider text-cream">
                  {deck.name}
                </h2>
                <p className="text-xs text-slate-300/70">{deck.size} cards</p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {deck.isDefault ? (
                  <span className="rounded-sm bg-action px-3 py-1 text-sm font-semibold ring-1 ring-white/60">
                    Default
                  </span>
                ) : (
                  <ActionButton action={starterDeckAction.bind(null, deck.id, 'make-default')}>
                    Make default
                  </ActionButton>
                )}
                <Link
                  href={`/admin/starter-decks/${deck.id}`}
                  className={buttonClasses('secondary', '!px-3 !py-1 text-sm')}
                >
                  Edit
                </Link>
                <ActionButton
                  variant="quiet"
                  action={starterDeckAction.bind(null, deck.id, 'delete')}
                  confirmation={`Delete the starter deck "${deck.name}"?`}
                >
                  Delete
                </ActionButton>
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
      <Pagination
        label="Starter decks"
        page={decks.page}
        pageCount={decks.pageCount}
        hrefFor={(page) => pageHref('/admin/starter-decks', query, page)}
      />
    </div>
  );
}
