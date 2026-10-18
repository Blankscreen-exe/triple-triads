/**
 * At-a-glance numbers for a deck, shown in the deck list.
 */
import type { Element } from '@triple-triad/engine';

export interface DeckStatsEntry {
  readonly stars: number;
  readonly score: number;
  readonly element: Element | null;
  readonly quantity: number;
}

export interface DeckStats {
  readonly cards: number;
  /** Cards per star rank: `byStars[0]` is 1★ … `byStars[4]` is 5★. */
  readonly byStars: readonly number[];
  /** Mean stars per card, or null for an empty deck. */
  readonly averageStars: number | null;
  /** Sum of every card's score (see engine `rankCard`): overall strength. */
  readonly totalScore: number;
  /** Cards that have an element. */
  readonly elementalCards: number;
}

export const MAX_STARS = 5;

export function deckStats(entries: readonly DeckStatsEntry[]): DeckStats {
  const byStars = Array.from({ length: MAX_STARS }, () => 0);
  let cards = 0;
  let starTotal = 0;
  let totalScore = 0;
  let elementalCards = 0;

  for (const { stars, score, element, quantity } of entries) {
    const rank = Math.min(Math.max(stars, 1), MAX_STARS);
    byStars[rank - 1] = (byStars[rank - 1] ?? 0) + quantity;
    cards += quantity;
    starTotal += rank * quantity;
    totalScore += score * quantity;
    if (element !== null) elementalCards += quantity;
  }

  return {
    cards,
    byStars,
    averageStars: cards === 0 ? null : starTotal / cards,
    totalScore,
    elementalCards,
  };
}
