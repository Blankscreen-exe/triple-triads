/**
 * Helpers for unit tests. Not exported from the package entry point.
 */
import { POSITIONS, type Position } from './board';
import type { Board, Cell, GameState } from './state';
import type { CardDefinition, Element, PlayerColor, StatValue } from './types';

type StatTuple = readonly [top: StatValue, right: StatValue, bottom: StatValue, left: StatValue];

let nextId = 0;

/** Creates a card from its [top, right, bottom, left] stats. */
export function card(
  stats: StatTuple,
  element: Element | null = null,
  id?: string,
): CardDefinition {
  const [top, right, bottom, left] = stats;
  return { id: id ?? `card-${String(nextId++)}`, stats: { top, right, bottom, left }, element };
}

export function emptyBoard(elements: Partial<Record<Position, Element>> = {}): Cell[] {
  return POSITIONS.map((position) => ({ element: elements[position] ?? null, placed: null }));
}

/** Returns a copy of `board` with `definition` placed at `position`. */
export function withCard(
  board: Board,
  position: Position,
  definition: CardDefinition,
  controller: PlayerColor,
): Cell[] {
  return board.map((cell, index) =>
    index === position
      ? {
          ...cell,
          placed: {
            instanceId: `${controller}-${definition.id}`,
            card: definition,
            owner: controller,
            controller,
          },
        }
      : cell,
  );
}

export function controllerAt(board: Board, position: Position): PlayerColor | undefined {
  return board[position]?.placed?.controller;
}

/** A deck of `size` identical cards. */
export function uniformDeck(
  stats: StatTuple,
  size = 20,
  element: Element | null = null,
): CardDefinition[] {
  return Array.from({ length: size }, (_, index) =>
    card(stats, element, `uniform-${String(index)}`),
  );
}

/** Recursively freezes a value so tests fail if the engine mutates its input. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Instance id of the first card in the active player's hand. */
export function firstCard(state: GameState): string {
  const instance = state.players[state.activePlayer].hand[0];
  if (instance === undefined) throw new Error('Active player has no cards in hand');
  return instance.instanceId;
}
