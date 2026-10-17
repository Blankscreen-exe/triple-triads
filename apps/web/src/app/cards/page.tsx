import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CardView } from '@/components/cards/card-view';
import { toCardFace } from '@/components/cards/to-card-face';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { buttonClasses } from '@/components/ui/button';
import { Window } from '@/components/ui/window';
import { getDatabase } from '@/server/db';
import { listTrunk } from '@/server/trunk/trunk';
import { requireUser } from '@/server/web/current-user';
import { deleteCardAction } from './actions';

export const metadata: Metadata = { title: 'Your cards' };

export default function CardsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Your cards</h1>
          <p className="mt-1 text-sm text-slate-300/80">
            Cards you made. You own unlimited copies of each.
          </p>
        </div>
        <Link href="/cards/new" className={buttonClasses('primary')}>
          New card
        </Link>
      </div>
      <Suspense fallback={<p className="mt-6 text-slate-300">Loading…</p>}>
        <CustomCardGrid />
      </Suspense>
    </main>
  );
}

async function CustomCardGrid() {
  const user = await requireUser();
  const created = listTrunk(getDatabase(), user.id).filter((entry) => entry.card.kind === 'custom');

  if (created.length === 0) {
    return (
      <Window className="mt-6 p-6 text-center text-slate-200">
        You have not made any cards yet.
      </Window>
    );
  }

  return (
    <Window className="mt-6 p-5">
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {created.map(({ card }) => (
          <li key={card.id} className="space-y-2">
            <CardView card={toCardFace(card)} side="blue" />
            <form action={deleteCardAction}>
              <input type="hidden" name="cardId" value={card.id} />
              <ConfirmButton
                variant="quiet"
                className="w-full"
                confirmation={`Delete "${card.name}"? Decks that use it will lose those copies.`}
              >
                Delete
              </ConfirmButton>
            </form>
          </li>
        ))}
      </ul>
    </Window>
  );
}
