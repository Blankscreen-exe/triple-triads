import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { MatchTable } from '@/components/player-record';
import { Pagination } from '@/components/ui/pagination';
import { Window } from '@/components/ui/window';
import { pageFromQuery, pageHref } from '@/lib/pagination';
import { getDatabase } from '@/server/db';
import { matchHistory } from '@/server/matches/matches';
import { requireUser } from '@/server/web/current-user';

export const metadata: Metadata = { title: 'Match history' };

const PAGE_SIZE = 20;

/** Every game the signed-in player has finished, newest first. */
export default function MatchHistoryPage({ searchParams }: PageProps<'/profile/matches'>) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Match history</h1>
        <Link href="/profile" className="text-sm text-cream underline underline-offset-2">
          Back to your profile
        </Link>
      </div>
      <Suspense fallback={<p className="mt-6 text-slate-300">Loading…</p>}>
        <History searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function History({ searchParams }: Pick<PageProps<'/profile/matches'>, 'searchParams'>) {
  const user = await requireUser();
  const query = await searchParams;
  const history = matchHistory(getDatabase(), user.id, {
    page: pageFromQuery(query),
    pageSize: PAGE_SIZE,
  });

  if (history.total === 0) {
    return (
      <Window className="mt-6 p-6 text-center text-slate-200">
        You have not finished a game yet.
      </Window>
    );
  }

  return (
    <Window className="mt-6 space-y-4 p-5 max-sm:px-3">
      <MatchTable
        caption={`Games ${String(history.first)}–${String(history.last)} of ${String(history.total)}`}
        matches={history.items}
        showDates
      />
      <Pagination
        label="Match history"
        page={history.page}
        pageCount={history.pageCount}
        hrefFor={(page) => pageHref('/profile/matches', query, page)}
      />
    </Window>
  );
}
