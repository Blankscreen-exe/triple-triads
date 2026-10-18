import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CardView } from '@/components/cards/card-view';
import { FilterableCardGrid } from '@/components/cards/filterable-card-grid';
import { toCardFace, toFilterableCard } from '@/components/cards/to-card-face';
import { Window } from '@/components/ui/window';
import { getDatabase } from '@/server/db';
import { getAssetPack } from '@/server/packs/asset-packs';
import { listTrunk, type TrunkQuantity } from '@/server/trunk/trunk';
import { requireUser } from '@/server/web/current-user';

export const metadata: Metadata = { title: 'Trunk' };

export default function TrunkPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Your trunk</h1>
      <p className="mt-1 text-sm text-slate-300/80">
        Every card you own. Decks are built from these.
      </p>
      <Suspense fallback={<p className="mt-6 text-slate-300">Loading cards…</p>}>
        <TrunkGrid />
      </Suspense>
    </main>
  );
}

async function TrunkGrid() {
  const user = await requireUser();
  const db = getDatabase();
  const entries = listTrunk(db, user.id);
  const pack = getAssetPack(db, user.id);

  return (
    <Window className="mt-6 p-5">
      <FilterableCardGrid
        items={entries.map(({ card, quantity }) => ({
          key: card.id,
          card: toFilterableCard(card),
          content: (
            <>
              <CardView card={toCardFace(card)} side="blue" pack={pack} />
              <span
                className="absolute -right-2 -bottom-2 grid h-7 min-w-7 place-items-center rounded-full bg-cream px-1.5 text-xs font-bold text-ink ring-2 ring-window-bottom"
                aria-label={
                  quantity === 'unlimited' ? 'Unlimited copies' : `${String(quantity)} copies`
                }
              >
                {formatQuantity(quantity)}
              </span>
            </>
          ),
        }))}
      />
    </Window>
  );
}

function formatQuantity(quantity: TrunkQuantity): string {
  return quantity === 'unlimited' ? '∞' : `×${String(quantity)}`;
}
