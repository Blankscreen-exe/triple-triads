import type { ReactNode } from 'react';
import { formatStreak, tierFor } from '@/lib/rating';
import type { MatchSummary, PlayerStats } from '@/server/matches/matches';

const RESULT_STYLES: Record<MatchSummary['result'], string> = {
  win: 'bg-status-open/80',
  loss: 'bg-status-live/80',
  draw: 'bg-black/40',
};

/** A player's rating, record, streak and recent games, with an optional link to all of them. */
export function PlayerRecord({
  stats,
  recent,
  more,
}: {
  readonly stats: PlayerStats;
  readonly recent: readonly MatchSummary[];
  /** Shown under the recent games, e.g. a link to the full history. */
  readonly more?: ReactNode;
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

      {recent.length > 0 && <MatchTable caption="Recent games" matches={recent} />}
      {more}
    </div>
  );
}

/** Games from one player's point of view: result, opponent, score and rating change. */
export function MatchTable({
  caption,
  matches,
  showDates = false,
}: {
  readonly caption: string;
  readonly matches: readonly MatchSummary[];
  readonly showDates?: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <caption className="mb-2 text-left font-display font-bold tracking-wider text-cream">
        {caption}
      </caption>
      <thead className="sr-only">
        <tr>
          <th>Result</th>
          <th>Opponent</th>
          {showDates && <th>Played</th>}
          <th>Score</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((match) => {
          const played = match.playedAt.toISOString().slice(0, 10);
          return (
            <tr key={match.id} className="border-t border-frame/20">
              <td className="py-1.5 pr-2">
                <span
                  className={`rounded-sm px-1.5 py-0.5 text-xs uppercase ${RESULT_STYLES[match.result]}`}
                >
                  {match.result}
                </span>
              </td>
              <td className="w-full max-w-0 py-1.5 pr-2">
                <div className="truncate">
                  {match.opponent ?? 'Deleted player'}
                  {match.forfeit && <span className="text-xs text-slate-300/70"> · forfeit</span>}
                  {match.rounds > 1 && (
                    <span className="text-xs text-slate-300/70"> · {match.rounds} rounds</span>
                  )}
                </div>
                {/* Phones: the date under the opponent, instead of its own column. */}
                {showDates && <div className="text-xs text-slate-300/70 sm:hidden">{played}</div>}
              </td>
              {showDates && (
                <td className="py-1.5 pr-3 whitespace-nowrap text-slate-300/80 tabular-nums max-sm:hidden">
                  <time dateTime={match.playedAt.toISOString()}>{played}</time>
                </td>
              )}
              <td className="py-1.5 pr-2 tabular-nums">{match.score}</td>
              <td className="py-1.5 text-right tabular-nums">
                {match.ratingChange > 0 ? '+' : ''}
                {match.ratingChange}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
