import { describe, expect, it } from 'vitest';
import { isStatValue, opponentOf } from './types';

describe('isStatValue', () => {
  it.each([1, 5, 10])('accepts %i', (value) => {
    expect(isStatValue(value)).toBe(true);
  });

  it.each([0, 11, 2.5, Number.NaN])('rejects %s', (value) => {
    expect(isStatValue(value)).toBe(false);
  });
});

describe('opponentOf', () => {
  it('returns the other colour', () => {
    expect(opponentOf('red')).toBe('blue');
    expect(opponentOf('blue')).toBe('red');
  });
});
