/**
 * Capture resolution: what happens to neighbouring cards when a card is placed.
 *
 * Order of resolution (matches Final Fantasy VIII):
 *   1. Same / Same Wall and Plus compare the placed card with all its neighbours.
 *   2. Basic capture: each side higher than the touching side captures that card.
 *   3. Combo: cards captured by Same/Plus capture their own neighbours with the basic rule,
 *      and so on in waves until nothing more flips.
 *
 * Only cards controlled by the opponent are ever captured, but the placer's own cards still
 * count towards the "two or more" condition of Same and Plus.
 *
 * Elemental modifiers (+1/-1) apply to basic and combo comparisons. Same and Plus use the printed
 * numbers (see design/SPEC.md, section 9.5).
 */
import { neighborOf, type Position } from './board';
import type { RuleSet } from './rules';
import type { Board, CaptureCause, CaptureEvent, Cell, PlacedCard } from './state';
import { MAX_STAT_VALUE, OPPOSITE_SIDE, SIDES, type Side } from './types';

export interface CaptureResolution {
  readonly board: Board;
  readonly captures: readonly CaptureEvent[];
}

export function resolveCaptures(
  board: Board,
  position: Position,
  rules: RuleSet,
): CaptureResolution {
  const cells = [...board];
  const source = placedCardAt(cells, position);
  const attacker = source.controller;
  const captures: CaptureEvent[] = [];

  const capture = (target: Position, cause: CaptureCause, wave: number): void => {
    const cell = cellAt(cells, target);
    const card = placedCardAt(cells, target);
    cells[target] = { ...cell, placed: { ...card, controller: attacker } };
    captures.push({ position: target, cause, from: card.controller, to: attacker, wave });
  };

  // Steps 1 and 2: captures made directly by the placed card.
  const direct = new Map<Position, CaptureCause>();
  for (const target of findSameCaptures(cells, position, rules)) direct.set(target, 'same');
  for (const target of findPlusCaptures(cells, position, rules)) {
    if (!direct.has(target)) direct.set(target, 'plus');
  }
  for (const target of findBasicCaptures(cells, position)) {
    if (!direct.has(target)) direct.set(target, 'basic');
  }
  for (const [target, cause] of direct) capture(target, cause, 0);

  // Step 3: combo chain, started only by Same/Plus captures.
  if (rules.combo) {
    let wave = [...direct].filter(([, cause]) => cause !== 'basic').map(([target]) => target);
    for (let waveNumber = 1; wave.length > 0; waveNumber++) {
      const next: Position[] = [];
      for (const from of wave) {
        for (const target of findBasicCaptures(cells, from)) {
          capture(target, 'combo', waveNumber);
          next.push(target);
        }
      }
      wave = next;
    }
  }

  return { board: cells, captures };
}

/** A side's value for comparisons, including the elemental modifier of the card's square. */
export function effectiveValue(cell: Cell, side: Side): number {
  const card = cell.placed;
  if (card === null) {
    throw new Error('Cannot read the value of an empty cell');
  }
  return card.card.stats[side] + elementalModifier(cell);
}

/** +1 if the card matches its square's element, -1 if the square has a different element. */
export function elementalModifier(cell: Cell): number {
  if (cell.element === null || cell.placed === null) return 0;
  return cell.placed.card.element === cell.element ? 1 : -1;
}

interface Contact {
  readonly side: Side;
  readonly neighbor: Position;
  readonly card: PlacedCard;
}

/** Neighbouring cards touching `position`, with the side of `position` that touches them. */
function contactsOf(cells: Board, position: Position): Contact[] {
  const contacts: Contact[] = [];
  for (const side of SIDES) {
    const neighbor = neighborOf(position, side);
    if (neighbor === null) continue;
    const card = cellAt(cells, neighbor).placed;
    if (card !== null) contacts.push({ side, neighbor, card });
  }
  return contacts;
}

function findBasicCaptures(cells: Board, position: Position): Position[] {
  const attackerCell = cellAt(cells, position);
  const attacker = placedCardAt(cells, position).controller;
  return contactsOf(cells, position)
    .filter(({ card }) => card.controller !== attacker)
    .filter(
      ({ side, neighbor }) =>
        effectiveValue(attackerCell, side) >
        effectiveValue(cellAt(cells, neighbor), OPPOSITE_SIDE[side]),
    )
    .map(({ neighbor }) => neighbor);
}

function findSameCaptures(cells: Board, position: Position, rules: RuleSet): Position[] {
  if (!rules.same) return [];
  const source = placedCardAt(cells, position);

  const matches = contactsOf(cells, position).filter(
    ({ side, card }) => source.card.stats[side] === card.card.stats[OPPOSITE_SIDE[side]],
  );
  const wallMatches = rules.sameWall
    ? SIDES.filter(
        (side) => neighborOf(position, side) === null && source.card.stats[side] === MAX_STAT_VALUE,
      ).length
    : 0;

  if (matches.length + wallMatches < 2) return [];
  return matches
    .filter(({ card }) => card.controller !== source.controller)
    .map(({ neighbor }) => neighbor);
}

function findPlusCaptures(cells: Board, position: Position, rules: RuleSet): Position[] {
  if (!rules.plus) return [];
  const source = placedCardAt(cells, position);

  const bySum = new Map<number, Contact[]>();
  for (const contact of contactsOf(cells, position)) {
    const sum =
      source.card.stats[contact.side] + contact.card.card.stats[OPPOSITE_SIDE[contact.side]];
    bySum.set(sum, [...(bySum.get(sum) ?? []), contact]);
  }

  return [...bySum.values()]
    .filter((group) => group.length >= 2)
    .flat()
    .filter(({ card }) => card.controller !== source.controller)
    .map(({ neighbor }) => neighbor);
}

function cellAt(cells: Board, position: Position): Cell {
  const cell = cells[position];
  if (cell === undefined) {
    throw new RangeError(`No cell at position ${String(position)}`);
  }
  return cell;
}

function placedCardAt(cells: Board, position: Position): PlacedCard {
  const card = cellAt(cells, position).placed;
  if (card === null) {
    throw new Error(`Expected a card at position ${String(position)}`);
  }
  return card;
}
