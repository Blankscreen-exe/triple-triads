import { describe, expect, it } from 'vitest';
import { expectedScore, formatStreak, ratingChange, tierFor } from './rating';

describe('expectedScore', () => {
  it('is even between equal ratings and favours the higher rating', () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    expect(expectedScore(1400, 1000)).toBeCloseTo(0.909, 3);
    expect(expectedScore(1000, 1400) + expectedScore(1400, 1000)).toBeCloseTo(1, 10);
  });
});

describe('ratingChange', () => {
  it('moves 16 points between equal players', () => {
    expect(ratingChange(1000, 1000)).toBe(16);
  });

  it('rewards upsets more than expected wins', () => {
    expect(ratingChange(1000, 1400)).toBe(29);
    expect(ratingChange(1400, 1000)).toBe(3);
  });

  it('never gives less than one point', () => {
    expect(ratingChange(3000, 100)).toBe(1);
  });
});

describe('tierFor', () => {
  it.each([
    [600, 'Bronze III'],
    [1000, 'Bronze II'],
    [1099, 'Bronze I'],
    [1100, 'Silver III'],
    [1166, 'Silver III'],
    [1167, 'Silver II'],
    [1234, 'Silver I'],
    [1299, 'Silver I'],
    [1300, 'Gold III'],
    [1500, 'Platinum III'],
    [1699, 'Platinum I'],
    [1700, 'Diamond'],
    [2400, 'Diamond'],
  ])('rates %i as %s', (rating, label) => {
    expect(tierFor(rating).label).toBe(label);
  });
});

describe('formatStreak', () => {
  it('shows wins, losses and no streak', () => {
    expect(formatStreak(3)).toBe('W3');
    expect(formatStreak(-2)).toBe('L2');
    expect(formatStreak(0)).toBe('—');
  });
});
