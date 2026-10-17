import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CardView } from '@/components/cards/card-view';
import { toCardFace } from '@/components/cards/to-card-face';
import { buttonClasses } from '@/components/ui/button';
import { Window } from '@/components/ui/window';
import { listGenericCards } from '@/server/cards/generic-cards';
import { getDatabase } from '@/server/db';
import { DEFAULT_PACK_OWNER, getAssetPack } from '@/server/packs/asset-packs';
import { requireAdmin } from '@/server/web/current-user';

export const metadata: Metadata = { title: 'Generic cards' };

export default function AdminCardsPage() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-cream">
            Generic cards
          </h1>
          <p className="mt-1 text-sm text-slate-300/80">The cards starter decks are made from.</p>
        </div>
        <Link href="/admin/cards/new" className={buttonClasses('primary')}>
          New generic card
        </Link>
      </div>
      <Suspense fallback={<p className="mt-4 text-slate-300">Loading…</p>}>
        <GenericCardGrid />
      </Suspense>
    </>
  );
}

async function GenericCardGrid() {
  await requireAdmin();
  const db = getDatabase();
  const cards = listGenericCards(db);
  const pack = getAssetPack(db, DEFAULT_PACK_OWNER);
  return (
    <Window className="mt-6 p-5">
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              href={`/admin/cards/${card.id}`}
              aria-label={`Edit ${card.name}`}
              className="block rounded-[3%/2.2%] transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-cream"
            >
              <CardView card={toCardFace(card)} side="blue" pack={pack} />
            </Link>
          </li>
        ))}
      </ul>
    </Window>
  );
}
