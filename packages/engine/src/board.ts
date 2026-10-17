/**
 * Board geometry for the 3x3 grid. Positions are numbered left to right, top to bottom:
 *
 *   0 1 2
 *   3 4 5
 *   6 7 8
 */
import type { Side } from './types';

export const BOARD_WIDTH = 3;
export const CELL_COUNT = BOARD_WIDTH * BOARD_WIDTH;

export type Position = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const POSITIONS: readonly Position[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function isPosition(value: number): value is Position {
  return Number.isInteger(value) && value >= 0 && value < CELL_COUNT;
}

/**
 * Returns the position next to `position` in the direction of `side`,
 * or `null` if that side faces the edge of the board (a "wall").
 */
export function neighborOf(position: Position, side: Side): Position | null {
  const row = Math.floor(position / BOARD_WIDTH);
  const col = position % BOARD_WIDTH;

  switch (side) {
    case 'top':
      return row > 0 ? toPosition(position - BOARD_WIDTH) : null;
    case 'bottom':
      return row < BOARD_WIDTH - 1 ? toPosition(position + BOARD_WIDTH) : null;
    case 'left':
      return col > 0 ? toPosition(position - 1) : null;
    case 'right':
      return col < BOARD_WIDTH - 1 ? toPosition(position + 1) : null;
  }
}

function toPosition(value: number): Position {
  if (!isPosition(value)) {
    throw new RangeError(`Invalid board position: ${String(value)}`);
  }
  return value;
}
