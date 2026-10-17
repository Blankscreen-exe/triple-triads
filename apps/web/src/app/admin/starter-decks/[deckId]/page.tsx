import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { toCardFace } from '@/components/cards/to-card-face';
import { DeckEditor, type EditorCard } from '@/components/decks/deck-editor';
import { listGenericCards } from '@/server/cards/generic-cards';
import { listStarterDecks } from '@/server/catalog/starter-decks';
import { getDatabase } from '@/server/db';
import { getGameSettings } from '@/server/settings/settings';
import { requireAdmin } from '@/server/web/current-user';
import { saveStarterDeckAction } from '../../actions';

export const metadata: Metadata = { title: 'Edit starter deck' };

export default function EditStarterDeckPage({
  params,
}: PageProps<'/admin/starter-decks/[deckId]'>) {
  return (
    <>
      <h1 className="mb-6 font-display text-2xl font-bold tracking-wider text-cream">
        Edit starter deck
      </h1>
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <Editor params={params} />
      </Suspense>
    </>
  );
}

async function Editor({ params }: Pick<PageProps<'/admin/starter-decks/[deckId]'>, 'params'>) {
  await requireAdmin();
  const { deckId } = await params;
  const db = getDatabase();
  const deck = listStarterDecks(db).find((candidate) => candidate.id === deckId);
  if (!deck) notFound();

  // Any generic card, in any number, can go into a starter deck.
  const cards: EditorCard[] = listGenericCards(db).map((card) => ({
    ...toCardFace(card),
    id: card.id,
    owned: null,
  }));
  const counts = Object.fromEntries(deck.entries.map((entry) => [entry.card.id, entry.quantity]));

  return (
    <DeckEditor
      initialName={deck.name}
      initialCounts={counts}
      trunk={cards}
      rules={getGameSettings(db).deckRules}
      save={saveStarterDeckAction.bind(null, deck.id)}
      backHref="/admin/starter-decks"
    />
  );
}
