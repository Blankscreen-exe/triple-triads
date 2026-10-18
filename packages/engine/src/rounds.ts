/**
 * Matches of several rounds (design/SPEC.md, 9.7): when a round is drawn, the next one is played
 * with what is left of each deck, until someone wins or the decks run out.
 */
import { CELL_COUNT } from './board';
import { MIN_CARDS_PER_GAME } from './rules';
import type { GameState } from './state';
import { PLAYER_COLORS, type CardDefinition, type PlayerColor } from './types';

/**
 * The deck a player has left after a round. Every card they placed is used up, including cards
 * the opponent captured; cards they drew but did not place go back into the deck.
 */
export function remainingAfterRound(
  deck: readonly CardDefinition[],
  round: Pick<GameState, 'board'>,
  player: PlayerColor,
): CardDefinition[] {
  const left = [...deck];
  for (const cell of round.board) {
    const placed = cell.placed;
    if (placed?.owner !== player) continue;
    const index = left.findIndex((card) => card.id === placed.card.id);
    if (index === -1) {
      throw new RangeError(`Card ${placed.card.id} was placed but is not in the ${player} deck`);
    }
    left.splice(index, 1);
  }
  return left;
}

/** Whether both decks still hold enough cards to play another round. */
export function canPlayRound(
  decks: Readonly<Record<PlayerColor, readonly CardDefinition[]>>,
): boolean {
  return PLAYER_COLORS.every((color) => decks[color].length >= MIN_CARDS_PER_GAME);
}

/**
 * The most rounds a match can last with decks of this size: the starting player places 5 cards a
 * round and the other player 4, and the starter swaps after each drawn round.
 */
export function maxRounds(deckSize: number): number {
  const placed = { starter: Math.ceil(CELL_COUNT / 2), other: Math.floor(CELL_COUNT / 2) };
  let [starter, other] = [deckSize, deckSize];
  let rounds = 0;
  while (starter >= MIN_CARDS_PER_GAME && other >= MIN_CARDS_PER_GAME) {
    rounds++;
    [starter, other] = [other - placed.other, starter - placed.starter];
  }
  return rounds;
}
