/**
 * Core domain types shared by every part of the engine.
 */

/** A printed stat value. 10 is displayed as "A". */
export type StatValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const MIN_STAT_VALUE = 1;
export const MAX_STAT_VALUE = 10;

export function isStatValue(value: number): value is StatValue {
  return Number.isInteger(value) && value >= MIN_STAT_VALUE && value <= MAX_STAT_VALUE;
}

export const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type Side = (typeof SIDES)[number];

export const OPPOSITE_SIDE: Readonly<Record<Side, Side>> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
};

/** The four printed numbers of a card. */
export type Stats = Readonly<Record<Side, StatValue>>;

export const ELEMENTS = [
  'fire',
  'ice',
  'thunder',
  'earth',
  'poison',
  'wind',
  'water',
  'holy',
] as const;
export type Element = (typeof ELEMENTS)[number];

/**
 * The two sides of a game. Red always moves first; the room decides who is red
 * (coin flip for the first game, loser of the previous game for rematches).
 */
export const PLAYER_COLORS = ['red', 'blue'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export function opponentOf(color: PlayerColor): PlayerColor {
  return color === 'red' ? 'blue' : 'red';
}

/** The game-relevant part of a card. Names, art and owners live outside the engine. */
export interface CardDefinition {
  readonly id: string;
  readonly stats: Stats;
  readonly element: Element | null;
}
