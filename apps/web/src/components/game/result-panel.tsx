'use client';

import type { RoomSnapshot, VoteChoice } from '@/lib/realtime/protocol';
import { formatStreak, tierFor } from '@/lib/rating';
import { Button } from '../ui/button';
import { Window } from '../ui/window';
import { Countdown } from './countdown';

interface ResultPanelProps {
  readonly room: RoomSnapshot;
  readonly clockOffset: number;
  readonly onVote: (choice: VoteChoice) => void;
}

/** End-of-game summary with the rematch vote (design/SPEC.md, 9.7). */
export function ResultPanel({ room, clockOffset, onVote }: ResultPanelProps) {
  const game = room.game;
  const result = game?.view.result;
  if (!game || !result) return null;

  const you = room.you.color;
  const title =
    result.winner === null
      ? 'Draw'
      : you === null
        ? `${game.players[result.winner].username} wins`
        : result.winner === you
          ? 'Victory'
          : 'Defeat';
  const score = `${String(result.score.red)} – ${String(result.score.blue)}`;
  const myVote = room.rematch?.votes[room.you.userId];
  const otherVotes = Object.entries(room.rematch?.votes ?? {}).filter(
    ([id]) => id !== room.you.userId,
  );

  return (
    <Window className="p-5 text-center" aria-live="polite">
      <h2 className="font-display text-3xl font-black tracking-widest text-cream [text-shadow:0_3px_0_#000]">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-300/80">
        Red {score} Blue{game.forfeit && ' · by forfeit'}
      </p>
      {you && game.outcome && <RatingChange outcome={game.outcome[you]} />}

      {room.rematch && room.you.role === 'player' && (
        <div className="mt-4 space-y-3">
          {myVote === 'continue' ? (
            <p className="text-sm text-slate-100">Waiting for your opponent…</p>
          ) : (
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => {
                  onVote('continue');
                }}
              >
                Play again
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  onVote('leave');
                }}
              >
                Leave
              </Button>
            </div>
          )}
          <p className="text-xs text-slate-300/70">
            {otherVotes.some(([, vote]) => vote === 'continue')
              ? 'Your opponent wants a rematch. '
              : ''}
            Vote closes in <Countdown deadline={room.rematch.deadline} clockOffset={clockOffset} />
          </p>
        </div>
      )}

      {!room.rematch && room.status === 'waiting' && room.you.role === 'player' && (
        <p className="mt-3 text-sm text-slate-300/80">Your opponent left. Waiting for a new one…</p>
      )}
    </Window>
  );
}

function RatingChange({
  outcome,
}: {
  readonly outcome: { ratingBefore: number; ratingAfter: number; streak: number };
}) {
  const change = outcome.ratingAfter - outcome.ratingBefore;
  const sign = change > 0 ? '+' : change < 0 ? '−' : '±';
  return (
    <p className="mt-2 text-sm text-slate-100">
      Rating {outcome.ratingAfter}{' '}
      <span className={change > 0 ? 'text-status-open' : change < 0 ? 'text-score-red' : ''}>
        ({sign}
        {Math.abs(change)})
      </span>{' '}
      · {tierFor(outcome.ratingAfter).label} · Streak {formatStreak(outcome.streak)}
    </p>
  );
}
