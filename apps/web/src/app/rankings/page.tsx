import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Window } from '@/components/ui/window';
import { formatStreak, tierFor } from '@/lib/rating';
import { getDatabase } from '@/server/db';
import { leaderboard } from '@/server/matches/matches';

export const metadata: Metadata = { title: 'Rankings' };

export default function RankingsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Rankings</h1>
      <p className="mt-1 mb-6 text-sm text-slate-300/80">
        Players who have finished at least one game.
      </p>
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <RankingTable />
      </Suspense>
    </main>
  );
}

async function RankingTable() {
  // Public, but always current: render on each request, never at build time.
  await connection();
  const players = leaderboard(getDatabase());

  if (players.length === 0) {
    return (
      <Window className="p-6 text-center text-slate-200">No games have been played yet.</Window>
    );
  }

  return (
    <Window className="overflow-x-auto p-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wider text-slate-300/80 uppercase">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 pr-3">Rank</th>
            <th className="py-2 pr-3 text-right">Rating</th>
            <th className="py-2 pr-3 text-right">W / L / D</th>
            <th className="py-2 text-right">Streak</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr key={player.username} className="border-t border-frame/20">
              <td className="py-2 pr-3 tabular-nums">{index + 1}</td>
              <td className="py-2 pr-3 font-semibold text-slate-100">{player.username}</td>
              <td className="py-2 pr-3">{tierFor(player.rating).label}</td>
              <td className="py-2 pr-3 text-right font-display font-bold text-cream tabular-nums">
                {player.rating}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {player.wins} / {player.losses} / {player.draws}
              </td>
              <td className="py-2 text-right">{formatStreak(player.streak)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Window>
  );
}
