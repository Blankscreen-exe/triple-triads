import { describe, expect, it } from 'vitest';
import { deckStats } from './deck-stats';

describe('deckStats', () => {
  it('counts cards, star ranks, strength and elements, using quantities', () => {
    expect(
      deckStats([
        { stars: 5, score: 461, element: 'wind', quantity: 1 },
        { stars: 2, score: 243, element: null, quantity: 3 },
        { stars: 1, score: 108, element: 'fire', quantity: 2 },
        { stars: 1, score: 110, element: 'wind', quantity: 2 },
      ]),
    ).toEqual({
      cards: 8,
      byStars: [4, 3, 0, 0, 1],
      averageStars: (5 + 2 * 3 + 1 * 4) / 8,
      totalScore: 461 + 243 * 3 + 108 * 2 + 110 * 2,
      elementalCards: 5,
      byElement: [
        { element: 'wind', count: 3 },
        { element: 'fire', count: 2 },
      ],
    });
  });

  it('describes an empty deck', () => {
    expect(deckStats([])).toEqual({
      cards: 0,
      byStars: [0, 0, 0, 0, 0],
      averageStars: null,
      totalScore: 0,
      elementalCards: 0,
      byElement: [],
    });
  });
});
