import { describe, expect, it } from 'vitest';
import { describeCard } from './describe-card';

describe('describeCard', () => {
  it('reads out name, stars, stats and element', () => {
    expect(
      describeCard({
        name: 'Sky Wyrm',
        stats: { top: 10, right: 4, bottom: 6, left: 9 },
        element: 'wind',
        stars: 5,
      }),
    ).toBe('Sky Wyrm, 5 stars, top A, right 4, bottom 6, left 9, Wind element');
  });

  it('uses the singular for one star and handles no element', () => {
    expect(
      describeCard({
        name: 'Spore Cap',
        stats: { top: 5, right: 1, bottom: 1, left: 3 },
        element: null,
        stars: 1,
      }),
    ).toBe('Spore Cap, 1 star, top 5, right 1, bottom 1, left 3, no element');
  });
});
