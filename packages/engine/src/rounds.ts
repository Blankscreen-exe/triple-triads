/**
 * Matches of several rounds (design/SPEC.md, 9.7): each round is played with what is left of each
 * deck, until one player cannot be caught, the rounds are all played, or the decks run out.
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

/** Rounds won by each player; a drawn round counts for neither. */
export function roundsWon(
  results: readonly { readonly winner: PlayerColor | null }[],
): Record<PlayerColor, number> {
  const won = { red: 0, blue: 0 };
  for (const { winner } of results) {
    if (winner) won[winner]++;
  }
  return won;
}

/**
 * Whether a match of at most `rounds` rounds is over after these results: they have all been
 * played, or one player has won more rounds than are left to play (2–0 in a best of 3).
 */
export function isMatchOver(
  results: readonly { readonly winner: PlayerColor | null }[],
  rounds: number,
): boolean {
  const left = rounds - results.length;
  const won = roundsWon(results);
  return left <= 0 || Math.abs(won.red - won.blue) > left;
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
