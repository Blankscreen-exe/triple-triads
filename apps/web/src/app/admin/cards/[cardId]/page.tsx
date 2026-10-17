import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CardForm } from '@/components/cards/card-form';
import { ActionButton } from '@/components/ui/action-button';
import { cardArtUrl } from '@/lib/media';
import { getGenericCard } from '@/server/cards/generic-cards';
import { getDatabase } from '@/server/db';
import { getGameSettings } from '@/server/settings/settings';
import { requireAdmin } from '@/server/web/current-user';
import { deleteGenericCardAction, saveGenericCardAction } from '../../actions';

export const metadata: Metadata = { title: 'Edit generic card' };

export default function EditGenericCardPage({ params }: PageProps<'/admin/cards/[cardId]'>) {
  return (
    <>
      <h1 className="mb-6 font-display text-2xl font-bold tracking-wider text-cream">
        Edit generic card
      </h1>
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <Form params={params} />
      </Suspense>
    </>
  );
}

async function Form({ params }: Pick<PageProps<'/admin/cards/[cardId]'>, 'params'>) {
  await requireAdmin();
  const { cardId } = await params;
  const db = getDatabase();
  const card = getGenericCard(db, cardId);
  if (!card) notFound();

  return (
    <div className="space-y-6">
      <CardForm
        scoring={getGameSettings(db).scoring}
        action={saveGenericCardAction}
        cancelHref="/admin/cards"
        hiddenFields={{ cardId: card.id }}
        initial={{
          name: card.name,
          stats: card.stats,
          element: card.element,
          artUrl: cardArtUrl(card.artKey),
        }}
      />
      <ActionButton
        variant="quiet"
        action={deleteGenericCardAction.bind(null, card.id)}
        confirmation={`Delete "${card.name}"? Players lose it from their trunks and decks.`}
      >
        Delete this card
      </ActionButton>
    </div>
  );
}
