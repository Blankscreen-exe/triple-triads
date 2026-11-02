import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CardView } from '@/components/cards/card-view';
import { toCardFace } from '@/components/cards/to-card-face';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClasses } from '@/components/ui/button';
import { Window } from '@/components/ui/window';
import { describeViolation, violationKey } from '@/lib/deck-violations';
import { listStarterDecks } from '@/server/catalog/starter-decks';
import { getDatabase } from '@/server/db';
import { DEFAULT_PACK_OWNER, getAssetPack } from '@/server/packs/asset-packs';
import { getGameSettings } from '@/server/settings/settings';
import { requireAdmin } from '@/server/web/current-user';
import {
  deleteStarterDeckAction,
  giveStarterDeckAction,
  makeDefaultStarterDeckAction,
} from '../../actions';
import {
  DeckNumbers,
  ElementCounts,
  StarBars,
  StarterDeckBadges,
  starterDeckStats,
} from '../deck-parts';

export const metadata: Metadata = { title: 'Starter deck' };

export default function StarterDeckPage({ params }: PageProps<'/admin/starter-decks/[deckId]'>) {
  return (
    <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
      <StarterDeck params={params} />
    </Suspense>
  );
}

async function StarterDeck({ params }: Pick<PageProps<'/admin/starter-decks/[deckId]'>, 'params'>) {
  await requireAdmin();
  const { deckId } = await params;
  const db = getDatabase();
  const deck = listStarterDecks(db).find((candidate) => candidate.id === deckId);
  if (!deck) notFound();
  const { deckRules } = getGameSettings(db);
  const pack = getAssetPack(db, DEFAULT_PACK_OWNER);
  const stats = starterDeckStats(deck);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/admin/starter-decks" className="text-sm text-slate-300 hover:text-cream">
          ← Starter decks
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 font-display text-2xl font-bold tracking-wider text-cream">
              {deck.name}
            </h1>
            <StarterDeckBadges deck={deck} />
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {!deck.isDefault && (
              <ActionButton action={makeDefaultStarterDeckAction.bind(null, deck.id)}>
                Make default
              </ActionButton>
            )}
            <Link
              href={`/admin/starter-decks/${deck.id}/edit`}
              className={buttonClasses('secondary', '!px-3 !py-1 text-sm')}
            >
              Edit
            </Link>
            <ActionButton
              action={giveStarterDeckAction.bind(null, deck.id)}
              confirmation={`Give a copy of "${deck.name}" and its cards to every player who has not received it yet?`}
            >
              Give to every player
            </ActionButton>
            <ActionButton
              variant="quiet"
              action={deleteStarterDeckAction.bind(null, deck.id)}
              confirmation={`Delete the starter deck "${deck.name}"?`}
            >
              Delete
            </ActionButton>
          </div>
        </div>
        {deck.violations.length > 0 && (
          <ul className="space-y-1 rounded-md bg-status-live/30 px-3 py-2 text-sm">
            {deck.violations.map((violation) => (
              <li key={violationKey(violation)}>{describeViolation(violation)}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
        <Window aria-label="Deck stats" className="space-y-5 p-5">
          <DeckNumbers stats={stats} deckSize={deckRules.size} narrow />
          <section className="space-y-2">
            <h2 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
              By stars
            </h2>
            <StarBars stats={stats} rules={deckRules} />
          </section>
          <section className="space-y-2">
            <h2 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Elements
            </h2>
            <ElementCounts stats={stats} />
          </section>
        </Window>

        <Window aria-label="Cards" className="p-5">
          {deck.entries.length === 0 ? (
            <p className="py-6 text-center text-slate-300">
              This deck has no cards yet.{' '}
              <Link href={`/admin/starter-decks/${deck.id}/edit`} className="underline">
                Add some
              </Link>
              .
            </p>
          ) : (
            <ul
              aria-label="Deck contents"
              className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-3"
            >
              {deck.entries.map(({ card, quantity }) => (
                <li key={card.id} className="relative">
                  <CardView card={toCardFace(card)} side="blue" pack={pack} />
                  <span
                    className="absolute -right-1.5 -bottom-1.5 rounded-full bg-cream px-1.5 py-0.5 text-xs font-bold text-ink shadow-md tabular-nums"
                    aria-label={`${String(quantity)} ${quantity === 1 ? 'copy' : 'copies'}`}
                  >
                    ×{quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Window>
      </div>
    </div>
  );
}
