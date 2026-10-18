'use client';

import { POSITIONS, elementalModifier, type Cell, type Position } from '@triple-triad/engine';
import type { GameSnapshot } from '@/lib/realtime/protocol';
import { CardBack, CardView } from '../cards/card-view';
import { ElementIcon } from './element-icon';

interface BoardProps {
  readonly game: GameSnapshot;
  /** True when the viewer has a card selected and may place it. */
  readonly canPlace: boolean;
  readonly onPlace: (position: Position) => void;
  /** True on the viewer's turn: empty squares accept a dragged card. */
  readonly acceptsDrop: boolean;
  /** While a card is dragged: the square under it, if any. */
  readonly drag: { readonly over: Position | null } | null;
}

export function Board({ game, canPlace, onPlace, acceptsDrop, drag }: BoardProps) {
  const captured = new Set(game.lastMove?.captures.map((capture) => capture.position));
  return (
    <div className="rounded-lg border-4 border-wood-rim bg-linear-to-br from-wood-light to-wood-dark p-2 shadow-inner sm:p-3">
      <ol className="grid grid-cols-3 gap-1.5 sm:gap-2" aria-label="Board">
        {POSITIONS.map((position) => {
          const cell = game.view.board[position];
          if (!cell) return null;
          return (
            <li key={position} className="relative">
              {cell.placed ? (
                <PlacedCard
                  game={game}
                  cell={cell}
                  animation={
                    game.lastMove?.position === position
                      ? 'motion-safe:animate-card-drop'
                      : captured.has(position)
                        ? 'motion-safe:animate-card-flip'
                        : ''
                  }
                />
              ) : (
                <EmptyCell
                  cell={cell}
                  position={position}
                  canPlace={canPlace}
                  onPlace={onPlace}
                  acceptsDrop={acceptsDrop}
                  dropState={drag === null ? 'idle' : drag.over === position ? 'over' : 'target'}
                  pack={game.players.red.pack}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PlacedCard({
  game,
  cell,
  animation,
}: {
  readonly game: GameSnapshot;
  readonly cell: Cell;
  readonly animation: string;
}) {
  const placed = cell.placed;
  if (!placed) return null;
  const face = game.cards[placed.card.id];
  const pack = game.players[placed.owner].pack;
  const modifier = elementalModifier(cell);
  return (
    // Keyed by controller so a capture remounts the card and replays the flip animation.
    <div key={`${placed.instanceId}-${placed.controller}`} className={animation}>
      {face ? (
        <CardView card={face} side={placed.controller} pack={pack} />
      ) : (
        <CardBack pack={pack} />
      )}
      {modifier !== 0 && (
        <span
          className={`absolute -top-1.5 -right-1.5 z-10 grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-bold ring-2 ring-wood-dark ${
            modifier > 0 ? 'bg-cream text-ink' : 'bg-status-live text-white'
          }`}
          aria-label={modifier > 0 ? 'Element bonus +1' : 'Element penalty −1'}
        >
          {modifier > 0 ? '+1' : '−1'}
        </span>
      )}
    </div>
  );
}

const DROP_STYLES = {
  idle: '',
  target: 'ring-2 ring-cream/70 bg-cream/10',
  over: 'ring-4 ring-cream bg-cream/30 scale-[1.03]',
} as const;

function EmptyCell({
  cell,
  position,
  canPlace,
  onPlace,
  acceptsDrop,
  dropState,
  pack,
}: {
  readonly cell: Cell;
  readonly position: Position;
  readonly canPlace: boolean;
  readonly onPlace: (position: Position) => void;
  readonly acceptsDrop: boolean;
  readonly dropState: keyof typeof DROP_STYLES;
  readonly pack: GameSnapshot['players']['red']['pack'];
}) {
  const row = Math.floor(position / 3) + 1;
  const column = (position % 3) + 1;
  const content = cell.element && (
    <ElementIcon element={cell.element} pack={pack} className="w-1/2 opacity-50" />
  );
  const base = `grid aspect-[1024/1434] w-full place-items-center rounded-md bg-black/30 ring-1 ring-cream/25 transition ${DROP_STYLES[dropState]}`;
  const dropTarget = acceptsDrop ? { 'data-drop-position': position } : {};

  if (!canPlace) {
    return (
      <div className={base} {...dropTarget}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        onPlace(position);
      }}
      aria-label={`Place card on row ${String(row)}, column ${String(column)}`}
      {...dropTarget}
      className={`${base} cursor-pointer ring-2 ring-cream/70 hover:bg-cream/15 focus-visible:outline-2 focus-visible:outline-cream`}
    >
      {content}
    </button>
  );
}
