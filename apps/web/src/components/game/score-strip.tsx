'use client';

import type { PlayerColor } from '@triple-triad/engine';
import { useState, type ReactNode } from 'react';
import type { GameStats } from '@/lib/game-stats';
import type { GameSnapshot } from '@/lib/realtime/protocol';
import { Button } from '../ui/button';
import { Modal, ModalClose } from '../ui/modal';
import { StatBoard } from './stat-board';

interface ScoreStripProps {
  readonly game: GameSnapshot;
  readonly stats: GameStats | null;
  /** Extra controls at the end of the strip (e.g. the phone menu button). */
  readonly children?: ReactNode;
}

/**
 * The match at a glance, above the board: rounds won, the round being played and captures.
 * "More" opens the full scoreboard.
 */
export function ScoreStrip({ game, stats, children }: ScoreStripProps) {
  const [open, setOpen] = useState(false);
  const { match } = game;
  const players: Record<PlayerColor, string> = {
    red: game.players.red.username,
    blue: game.players.blue.username,
  };

  return (
    <div
      role="group"
      aria-label="Score"
      className="flex items-center gap-x-3 gap-y-1 rounded-md border border-frame/40 bg-black/25 py-1 pr-1 pl-3 text-xs sm:mx-auto sm:w-fit sm:text-sm"
    >
      {match.format === 'until-winner' && (
        <>
          <Pair
            label="Rounds won"
            red={match.seriesScore.red}
            blue={match.seriesScore.blue}
            players={players}
          />
          <span className="font-display tracking-wider whitespace-nowrap text-slate-300 uppercase">
            Round {match.round} of 3
          </span>
        </>
      )}
      {stats && (
        // Phones have room for one pair; in a best-of-3 the rounds matter more.
        <Pair
          label="Captured"
          red={stats.red.cardsCaptured}
          blue={stats.blue.cardsCaptured}
          players={players}
          className={match.format === 'until-winner' ? 'max-sm:hidden' : ''}
        />
      )}
      <span className="ml-auto flex items-center gap-1">
        {stats && (
          <Button
            variant="quiet"
            onClick={() => {
              setOpen(true);
            }}
          >
            More
          </Button>
        )}
        {children}
      </span>

      {open && stats && (
        <Modal
          label="Scoreboard"
          onClose={() => {
            setOpen(false);
          }}
        >
          <div className="space-y-3">
            <StatBoard
              stats={stats}
              players={players}
              match={match}
              gameOver={game.view.result !== null}
            />
            <ModalClose variant="secondary" className="w-full">
              Close
            </ModalClose>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** A red–blue pair of numbers, e.g. rounds won. */
function Pair({
  label,
  red,
  blue,
  players,
  className = '',
}: {
  readonly label: string;
  readonly red: number;
  readonly blue: number;
  readonly players: Readonly<Record<PlayerColor, string>>;
  readonly className?: string;
}) {
  return (
    <span
      role="group"
      className={`flex items-baseline gap-1.5 whitespace-nowrap ${className}`}
      aria-label={`${label}: ${players.red} ${String(red)}, ${players.blue} ${String(blue)}`}
    >
      <span className="text-slate-400" aria-hidden>
        {label}
      </span>
      <span className="font-display text-base font-black sm:text-lg" aria-hidden>
        <span className="text-score-red">{red}</span>
        <span className="text-slate-400">–</span>
        <span className="text-score-blue">{blue}</span>
      </span>
    </span>
  );
}
