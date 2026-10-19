import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CardView } from '@/components/cards/card-view';
import { toCardFace } from '@/components/cards/to-card-face';
import { ActionButton } from '@/components/ui/action-button';
import { Pagination } from '@/components/ui/pagination';
import { Window } from '@/components/ui/window';
import { pageFromQuery, pageHref } from '@/lib/pagination';
import { listCustomCards } from '@/server/admin/moderation';
import { getDatabase } from '@/server/db';
import { DEFAULT_PACK_OWNER, getAssetPack } from '@/server/packs/asset-packs';
import { requireAdmin } from '@/server/web/current-user';
import { removeCustomCardAction } from '../actions';

export const metadata: Metadata = { title: 'Moderation' };

/** Divides evenly into the grid's 3, 4 or 6 columns. */
const PAGE_SIZE = 24;

export default function ModerationPage({ searchParams }: PageProps<'/admin/moderation'>) {
  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Moderation</h1>
      <p className="mt-1 text-sm text-slate-300/80">
        Every card made by players, newest first. Removing a card deletes it and its art.
      </p>
      <Suspense fallback={<p className="mt-4 text-slate-300">Loading…</p>}>
        <CustomCards searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomCards({ searchParams }: Pick<PageProps<'/admin/moderation'>, 'searchParams'>) {
  await requireAdmin();
  const query = await searchParams;
  const db = getDatabase();
  const entries = listCustomCards(db, { page: pageFromQuery(query), pageSize: PAGE_SIZE });
  if (entries.total === 0) {
    return (
      <Window className="mt-6 p-6 text-slate-200">Players have not made any cards yet.</Window>
    );
  }
  return (
    <Window className="mt-6 space-y-4 p-5 max-sm:px-3">
      <p className="text-sm text-slate-300/80">
        {entries.total} {entries.total === 1 ? 'card' : 'cards'}
      </p>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:gap-5 md:grid-cols-4 lg:grid-cols-6">
        {entries.items.map(({ card, creator }) => (
          <li key={card.id} className="space-y-2" aria-label={`${card.name} by ${creator}`}>
            <CardView
              card={toCardFace(card)}
              side="red"
              pack={getAssetPack(db, card.creatorId ?? DEFAULT_PACK_OWNER)}
            />
            <p className="truncate text-xs text-slate-300/80">by {creator}</p>
            <ActionButton
              variant="quiet"
              action={removeCustomCardAction.bind(null, card.id)}
              confirmation={`Remove "${card.name}" by ${creator}?`}
            >
              Remove
            </ActionButton>
          </li>
        ))}
      </ul>
      <Pagination
        label="Cards"
        page={entries.page}
        pageCount={entries.pageCount}
        hrefFor={(page) => pageHref('/admin/moderation', query, page)}
      />
    </Window>
  );
}
