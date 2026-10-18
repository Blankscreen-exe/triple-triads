'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlayerColor } from '@triple-triad/engine';
import type { GameStats } from '@/lib/game-stats';
import type { RoomSnapshot, VoteChoice } from '@/lib/realtime/protocol';
import { formatStreak, tierFor } from '@/lib/rating';
import { StatBoard } from './stat-board';
import { Button } from '../ui/button';
import { Window } from '../ui/window';

interface ResultPanelProps {
  readonly room: RoomSnapshot;
  readonly onVote: (choice: VoteChoice) => void;
  readonly stats: GameStats | null;
}

export function ResultPanel({ room, onVote, stats }: ResultPanelProps) {
  const game = room.game;
  const result = game?.view.result;
  const [showPerf, setShowPerf] = useState(false);
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
  const players: Record<PlayerColor, string> = {
    red: game.players.red.username,
    blue: game.players.blue.username,
  };

  if (showPerf && stats) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-night/60 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-md">
          <StatBoard
            stats={stats}
            players={players}
            match={game.match}
            gameOver={result !== null}
          />
          <button
            type="button"
            onClick={() => setShowPerf(false)}
            className="mt-3 w-full text-center text-sm text-slate-300/80 hover:text-cream"
          >
            Back to results
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-night/60 backdrop-blur-sm">
      <Window className="mx-4 w-full max-w-md p-6 text-center" aria-live="polite">
        <h2 className="font-display text-4xl font-black tracking-[0.15em] text-gold uppercase sm:text-5xl [text-shadow:0_4px_12px_rgba(0,0,0,0.8),0_2px_0_#000]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-300/80">
          Red {score} Blue{game.forfeit && ' · by forfeit'}
        </p>
        {game.match.roundResults.length > 0 && (
          <p className="text-xs text-slate-300/80">
            Series: Red {game.match.seriesScore.red} – {game.match.seriesScore.blue} Blue
            {' · '}Round {game.match.round} of 3
          </p>
        )}
        {you && game.outcome && <RatingChange outcome={game.outcome[you]} />}

        {room.you.role === 'player' && (
          <RematchVote room={room} onVote={onVote} />
        )}

        {stats && (
          <button
            type="button"
            onClick={() => setShowPerf(true)}
            className="mt-3 text-sm text-slate-300/80 hover:text-cream"
          >
            Performance
          </button>
        )}
      </Window>
    </div>
  );
}

function RematchVote({
  room,
  onVote,
}: {
  readonly room: RoomSnapshot;
  readonly onVote: (choice: VoteChoice) => void;
}) {
  const [declined, setDeclined] = useState<string | null>(null);
  const prevState = useRef<{ hadRematch: boolean; myVote: string | null; opponentName: string }>({
    hadRematch: !!room.rematch,
    myVote: null,
    opponentName: 'Opponent',
  });

  const myVote = room.rematch?.votes[room.you.userId] ?? null;
  const otherEntries = Object.entries(room.rematch?.votes ?? {}).filter(
    ([id]) => id !== room.you.userId,
  );
  const opponentVote = otherEntries[0]?.[1] ?? null;
  const opponentId = otherEntries[0]?.[0] ?? null;
  const opponentName = room.game
    ? Object.values(room.game.players).find((p) => p.userId === opponentId)?.username ?? 'Opponent'
    : 'Opponent';

  useEffect(() => {
    const prev = prevState.current;
    if (prev.hadRematch && !room.rematch && prev.myVote === 'continue') {
      setDeclined(prev.opponentName);
    }
    prevState.current = {
      hadRematch: !!room.rematch,
      myVote,
      opponentName,
    };
  }, [room.rematch, myVote, opponentName]);

  if (declined) {
    return (
      <div className="mt-4">
        <p className="text-sm font-semibold text-score-red">{declined} declined the rematch.</p>
        <p className="mt-2 text-xs text-slate-300/80">Waiting for a new opponent…</p>
      </div>
    );
  }

  if (!room.rematch) {
    if (room.status === 'waiting') {
      return (
        <p className="mt-3 text-sm text-slate-300/80">Your opponent left. Waiting for a new one…</p>
      );
    }
    return null;
  }

  if (myVote === 'continue') {
    return (
      <p className="mt-4 text-sm text-slate-100">Waiting for your opponent…</p>
    );
  }

  if (opponentVote === 'continue') {
    return (
      <div className="mt-4 space-y-3">
        <div className="rounded-md border border-gold/40 bg-gold/5 px-3 py-2">
          <p className="text-sm font-semibold text-cream">
            {opponentName} wants to play again!
          </p>
        </div>
        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => onVote('continue')}>
            Accept
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => onVote('leave')}>
            Decline
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex gap-3">
      <Button className="flex-1" onClick={() => onVote('continue')}>
        Play again
      </Button>
      <Button variant="secondary" className="flex-1" onClick={() => onVote('leave')}>
        Leave
      </Button>
    </div>
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
