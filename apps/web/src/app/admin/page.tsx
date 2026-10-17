import { count, eq } from 'drizzle-orm';
import { Suspense } from 'react';
import { Window } from '@/components/ui/window';
import { getDatabase } from '@/server/db';
import { cards, matches, starterDecks, users } from '@/server/db/schema';
import { requireAdmin } from '@/server/web/current-user';

export default function AdminOverviewPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Admin</h1>
      <Suspense fallback={<p className="mt-4 text-slate-300">Loading…</p>}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  await requireAdmin();
  const db = getDatabase();
  const total = (table: typeof users | typeof matches | typeof starterDecks) =>
    db.select({ n: count() }).from(table).get()?.n ?? 0;
  const cardsOfKind = (kind: 'generic' | 'custom') =>
    db.select({ n: count() }).from(cards).where(eq(cards.kind, kind)).get()?.n ?? 0;

  const stats = [
    ['Players', total(users)],
    ['Games played', total(matches)],
    ['Generic cards', cardsOfKind('generic')],
    ['Player-made cards', cardsOfKind('custom')],
    ['Starter decks', total(starterDecks)],
  ] as const;

  return (
    <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map(([label, value]) => (
        <Window key={label} className="p-4">
          <dt className="text-xs text-slate-300/80">{label}</dt>
          <dd className="font-display text-3xl font-bold text-cream">{value}</dd>
        </Window>
      ))}
    </dl>
  );
}
