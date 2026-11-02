import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Pagination } from '@/components/ui/pagination';
import { Window } from '@/components/ui/window';
import { pageFromQuery, pageHref, paginate } from '@/lib/pagination';
import { listStarterDecks } from '@/server/catalog/starter-decks';
import { getDatabase } from '@/server/db';
import { DEFAULT_PACK_OWNER, getAssetPack } from '@/server/packs/asset-packs';
import { getGameSettings } from '@/server/settings/settings';
import { requireAdmin } from '@/server/web/current-user';
import {
  CardFan,
  DeckNumbers,
  ElementCounts,
  StarterDeckBadges,
  starterDeckStats,
} from './deck-parts';
import { NewStarterDeckForm } from './new-starter-deck-form';

export const metadata: Metadata = { title: 'Starter decks' };

/** Two rows on wide screens. */
const PAGE_SIZE = 6;

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
            Changes do not affect existing players; open a deck to give it to players who signed up
            before it existed.
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
  const db = getDatabase();
  // A handful of decks: they are loaded together (their rules are checked as a set) and paged here.
  const all = listStarterDecks(db);
  const decks = paginate(all, pageFromQuery(query), PAGE_SIZE);
  if (all.length === 0) {
    return (
      <Window className="mt-6 p-6 text-slate-200">
        There are no starter decks: new players will start with an empty trunk.
      </Window>
    );
  }
  const pack = getAssetPack(db, DEFAULT_PACK_OWNER);
  const { deckRules } = getGameSettings(db);

  return (
    <div className="mt-6 space-y-6">
      <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" aria-label="Starter decks">
        {decks.items.map((deck) => {
          const stats = starterDeckStats(deck);
          return (
            <li key={deck.id}>
              <Window
                aria-label={deck.name}
                className="relative flex h-full flex-col gap-4 p-5 transition hover:border-cream focus-within:border-cream"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 truncate font-display text-lg font-bold tracking-wider text-cream">
                    {/* Covers the whole panel, so all of it opens the deck. */}
                    <Link
                      href={`/admin/starter-decks/${deck.id}`}
                      className="outline-none after:absolute after:inset-0 after:rounded-lg"
                    >
                      {deck.name}
                    </Link>
                  </h2>
                  <StarterDeckBadges deck={deck} />
                </div>
                <CardFan deck={deck} pack={pack} />
                <DeckNumbers stats={stats} deckSize={deckRules.size} />
                <ElementCounts stats={stats} compact />
              </Window>
            </li>
          );
        })}
      </ul>
      <Pagination
        label="Starter decks"
        page={decks.page}
        pageCount={decks.pageCount}
        hrefFor={(page) => pageHref('/admin/starter-decks', query, page)}
      />
    </div>
  );
}
