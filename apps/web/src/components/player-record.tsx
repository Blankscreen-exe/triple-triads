import { formatStreak, tierFor } from '@/lib/rating';
import type { MatchSummary, PlayerStats } from '@/server/matches/matches';

const RESULT_STYLES: Record<MatchSummary['result'], string> = {
  win: 'bg-status-open/80',
  loss: 'bg-status-live/80',
  draw: 'bg-black/40',
};

/** A player's rating, record, streak and recent games. */
export function PlayerRecord({
  stats,
  recent,
}: {
  readonly stats: PlayerStats;
  readonly recent: readonly MatchSummary[];
}) {
  return (
    <div className="space-y-4 text-left">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rank" value={tierFor(stats.rating).label} />
        <Stat label="Rating" value={String(stats.rating)} />
        <Stat
          label="Record"
          value={`${String(stats.wins)}W ${String(stats.losses)}L ${String(stats.draws)}D`}
        />
        <Stat label="Streak" value={formatStreak(stats.streak)} />
      </dl>

      {recent.length > 0 && (
        <table className="w-full text-sm">
          <caption className="mb-2 text-left font-display font-bold tracking-wider text-cream">
            Recent games
          </caption>
          <thead className="sr-only">
            <tr>
              <th>Result</th>
              <th>Opponent</th>
              <th>Score</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((match) => (
              <tr key={match.id} className="border-t border-frame/20">
                <td className="py-1.5">
                  <span
                    className={`rounded-sm px-1.5 py-0.5 text-xs uppercase ${RESULT_STYLES[match.result]}`}
                  >
                    {match.result}
                  </span>
                </td>
                <td className="py-1.5">
                  {match.opponent ?? 'Deleted player'}
                  {match.forfeit && <span className="text-xs text-slate-300/70"> · forfeit</span>}
                </td>
                <td className="py-1.5 tabular-nums">{match.score}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {match.ratingChange > 0 ? '+' : ''}
                  {match.ratingChange}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border border-frame/30 bg-black/20 px-3 py-2">
      <dt className="text-xs text-slate-300/70">{label}</dt>
      <dd className="font-display text-lg font-bold text-cream">{value}</dd>
    </div>
  );
}
