import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CardView } from '@/components/cards/card-view';
import { toCardFace } from '@/components/cards/to-card-face';
import { Window } from '@/components/ui/window';
import { getDatabase } from '@/server/db';
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
  const entries = listTrunk(getDatabase(), user.id);

  return (
    <Window className="mt-6 p-5">
      <p className="mb-4 text-sm text-slate-300/80">{entries.length} different cards</p>
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {entries.map(({ card, quantity }) => (
          <li key={card.id} className="relative">
            <CardView card={toCardFace(card)} side="blue" />
            <span
              className="absolute -right-2 -bottom-2 grid h-7 min-w-7 place-items-center rounded-full bg-cream px-1.5 text-xs font-bold text-ink ring-2 ring-window-bottom"
              aria-label={
                quantity === 'unlimited' ? 'Unlimited copies' : `${String(quantity)} copies`
              }
            >
              {formatQuantity(quantity)}
            </span>
          </li>
        ))}
      </ul>
    </Window>
  );
}

function formatQuantity(quantity: TrunkQuantity): string {
  return quantity === 'unlimited' ? '∞' : `×${String(quantity)}`;
}
