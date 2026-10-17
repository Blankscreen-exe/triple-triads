import { describe, expect, it } from 'vitest';
import { DEFAULT_SCORING, rankCard } from './stars';
import type { Stats } from './types';

const stats = (
  top: Stats['top'],
  right: Stats['right'],
  bottom: Stats['bottom'],
  left: Stats['left'],
): Stats => ({
  top,
  right,
  bottom,
  left,
});

describe('rankCard', () => {
  // Reference examples from design/SPEC.md, section 4.2.
  it.each([
    ['Geezard', stats(1, 4, 1, 5), 108, 1],
    ['Malboro', stats(7, 7, 4, 2), 243, 2],
    ['Ifrit', stats(9, 6, 2, 8), 358, 4],
    ['Squall', stats(10, 4, 6, 9), 451, 5],
  ])('ranks %s as %i points, %i stars', (_, cardStats, score, stars) => {
    expect(rankCard(cardStats, null)).toEqual({ score, stars, allowed: true });
  });

  it('adds the element bonus', () => {
    expect(rankCard(stats(1, 4, 1, 5), 'fire').score).toBe(108 + DEFAULT_SCORING.elementBonus);
  });

  it('uses normal rounding, with .5 rounding up', () => {
    // 95 + 95 + 25 + 25 = 240 → 2 stars; plus the element bonus = 250 → 3 stars.
    expect(rankCard(stats(7, 7, 3, 3), null)).toEqual({ score: 240, stars: 2, allowed: true });
    expect(rankCard(stats(7, 7, 3, 3), 'earth')).toEqual({ score: 250, stars: 3, allowed: true });
  });

  it('shows at least one star', () => {
    expect(rankCard(stats(1, 1, 1, 1), null)).toEqual({ score: 32, stars: 1, allowed: true });
  });

  it('rejects cards that would round above the maximum', () => {
    expect(rankCard(stats(10, 10, 10, 10), null)).toEqual({ score: 760, stars: 5, allowed: false });
  });

  it('accepts the strongest card that still rounds to the maximum', () => {
    // 190 + 150 + 120 + 73 = 533 → 5 stars.
    expect(rankCard(stats(10, 9, 8, 6), null)).toEqual({ score: 533, stars: 5, allowed: true });
  });

  it('uses a custom scoring table', () => {
    const flat = {
      ...DEFAULT_SCORING,
      statScores: { 1: 25, 2: 25, 3: 25, 4: 25, 5: 25, 6: 25, 7: 25, 8: 25, 9: 25, 10: 25 },
    };

    expect(rankCard(stats(10, 10, 10, 10), null, flat)).toEqual({
      score: 100,
      stars: 1,
      allowed: true,
    });
  });
});
