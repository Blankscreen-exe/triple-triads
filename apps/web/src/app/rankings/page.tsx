import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Pagination } from '@/components/ui/pagination';
import { Window } from '@/components/ui/window';
import { pageFromQuery, pageHref } from '@/lib/pagination';
import { formatStreak, tierFor } from '@/lib/rating';
import { getDatabase } from '@/server/db';
import { leaderboard, leaderboardPosition } from '@/server/matches/matches';
import { getCurrentUser } from '@/server/web/current-user';

export const metadata: Metadata = { title: 'Rankings' };

const PAGE_SIZE = 25;

export default function RankingsPage({ searchParams }: PageProps<'/rankings'>) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Rankings</h1>
      <p className="mt-1 mb-6 text-sm text-slate-300/80">
        Players who have finished at least one game.
      </p>
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <RankingTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function RankingTable({ searchParams }: Pick<PageProps<'/rankings'>, 'searchParams'>) {
  // Public, but always current: the query makes it render on each request.
  const query = await searchParams;
  const db = getDatabase();
  const players = leaderboard(db, { page: pageFromQuery(query), pageSize: PAGE_SIZE });
  const user = await getCurrentUser();
  const position = user ? leaderboardPosition(db, user.id) : null;

  if (players.total === 0) {
    return (
      <Window className="p-6 text-center text-slate-200">No games have been played yet.</Window>
    );
  }

  const hrefFor = (page: number) => pageHref('/rankings', query, page);
  const yourPage = position === null ? null : Math.ceil(position / PAGE_SIZE);

  return (
    <Window className="space-y-4 p-5 max-sm:px-3">
      {position !== null && yourPage !== null && (
        <p className="text-sm text-slate-200">
          You are <span className="font-display font-bold text-cream">#{position}</span>
          {yourPage !== players.page && (
            <>
              {' · '}
              <Link href={hrefFor(yourPage)} className="text-cream underline underline-offset-2">
                Show my page
              </Link>
            </>
          )}
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wider text-slate-300/80 uppercase">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 pr-3 max-sm:hidden">Rank</th>
            <th className="py-2 pr-3 text-right">Rating</th>
            <th className="py-2 pr-3 text-right whitespace-nowrap">
              <abbr title="Wins / losses / draws" className="no-underline">
                W / L / D
              </abbr>
            </th>
            <th className="py-2 text-right max-sm:hidden">Streak</th>
          </tr>
        </thead>
        <tbody>
          {players.items.map((player) => {
            const you = player.username === user?.username;
            return (
              <tr
                key={player.username}
                aria-current={you ? 'true' : undefined}
                className={`border-t border-frame/20 ${you ? 'bg-white/10' : ''}`}
              >
                <td className="py-2 pr-3 tabular-nums">{player.position}</td>
                <td className="w-full max-w-0 py-2 pr-3">
                  <div className="truncate font-semibold text-slate-100">{player.username}</div>
                  {/* Phones: the rank under the name, instead of its own column. */}
                  <div className="text-xs text-slate-300/80 sm:hidden">
                    {tierFor(player.rating).label}
                  </div>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap max-sm:hidden">
                  {tierFor(player.rating).label}
                </td>
                <td className="py-2 pr-3 text-right font-display font-bold text-cream tabular-nums">
                  {player.rating}
                </td>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                  {player.wins} / {player.losses} / {player.draws}
                </td>
                <td className="py-2 text-right max-sm:hidden">{formatStreak(player.streak)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination
        label="Rankings"
        page={players.page}
        pageCount={players.pageCount}
        hrefFor={hrefFor}
      />
    </Window>
  );
}
