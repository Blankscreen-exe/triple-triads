import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { toCardFace } from '@/components/cards/to-card-face';
import { getDatabase } from '@/server/db';
import { getAssetPack } from '@/server/packs/asset-packs';
import { listDecks } from '@/server/decks/decks';
import { getGameSettings } from '@/server/settings/settings';
import { listTrunk } from '@/server/trunk/trunk';
import { requireUser } from '@/server/web/current-user';
import { DeckEditor, type EditorCard } from '@/components/decks/deck-editor';
import { saveDeckAction } from '../actions';

export const metadata: Metadata = { title: 'Edit deck' };

export default function EditDeckPage({ params }: PageProps<'/decks/[deckId]'>) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold tracking-wider text-cream">Edit deck</h1>
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <EditorLoader params={params} />
      </Suspense>
    </main>
  );
}

async function EditorLoader({ params }: Pick<PageProps<'/decks/[deckId]'>, 'params'>) {
  const user = await requireUser();
  const { deckId } = await params;
  const db = getDatabase();
  const deck = listDecks(db, user.id).find((candidate) => candidate.id === deckId);
  if (!deck) notFound();

  const trunk: EditorCard[] = listTrunk(db, user.id).map(({ card, quantity }) => ({
    ...toCardFace(card),
    id: card.id,
    owned: quantity === 'unlimited' ? null : quantity,
  }));
  const counts = Object.fromEntries(deck.entries.map((entry) => [entry.card.id, entry.quantity]));

  return (
    <DeckEditor
      initialName={deck.name}
      initialCounts={counts}
      trunk={trunk}
      rules={getGameSettings(db).deckRules}
      pack={getAssetPack(db, user.id)}
      save={saveDeckAction.bind(null, deck.id)}
      backHref="/decks"
    />
  );
}
