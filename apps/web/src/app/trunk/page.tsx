import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CardLine } from '@/components/cards/card-line';
import { Window } from '@/components/ui/window';
import { getDatabase } from '@/server/db';
import { listTrunk, type TrunkQuantity } from '@/server/trunk/trunk';
import { requireUser } from '@/server/web/current-user';

export const metadata: Metadata = { title: 'Trunk' };

export default function TrunkPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Your trunk</h1>
      <p className="mt-1 text-sm text-slate-300/80">
        Every card you own. Decks are built from these.
      </p>
      <Suspense fallback={<p className="mt-6 text-slate-300">Loading cards…</p>}>
        <TrunkList />
      </Suspense>
    </main>
  );
}

async function TrunkList() {
  const user = await requireUser();
  const entries = listTrunk(getDatabase(), user.id);

  return (
    <Window className="mt-6 p-5">
      <p className="mb-4 text-sm text-slate-300/80">{entries.length} different cards</p>
      <ul className="space-y-1.5">
        {entries.map(({ card, quantity }) => (
          <li key={card.id}>
            <CardLine
              name={card.name}
              stats={card.stats}
              element={card.element}
              stars={card.stars}
              count={formatQuantity(quantity)}
            />
          </li>
        ))}
      </ul>
    </Window>
  );
}

function formatQuantity(quantity: TrunkQuantity): string {
  return quantity === 'unlimited' ? '∞' : `×${String(quantity)}`;
}
