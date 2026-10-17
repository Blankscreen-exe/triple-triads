import { describe, expect, it } from 'vitest';
import { isPosition, neighborOf } from './board';

describe('neighborOf', () => {
  it('finds all four neighbours of the centre', () => {
    expect([
      neighborOf(4, 'top'),
      neighborOf(4, 'right'),
      neighborOf(4, 'bottom'),
      neighborOf(4, 'left'),
    ]).toEqual([1, 5, 7, 3]);
  });

  it('returns null for sides facing the edge', () => {
    expect(neighborOf(0, 'top')).toBeNull();
    expect(neighborOf(0, 'left')).toBeNull();
    expect(neighborOf(8, 'bottom')).toBeNull();
    expect(neighborOf(8, 'right')).toBeNull();
    expect(neighborOf(2, 'right')).toBeNull();
    expect(neighborOf(6, 'left')).toBeNull();
  });

  it('does not wrap around rows', () => {
    expect(neighborOf(3, 'left')).toBeNull();
    expect(neighborOf(5, 'right')).toBeNull();
  });
});

describe('isPosition', () => {
  it.each([0, 4, 8])('accepts %i', (value) => {
    expect(isPosition(value)).toBe(true);
  });

  it.each([-1, 9, 1.5, Number.NaN])('rejects %s', (value) => {
    expect(isPosition(value)).toBe(false);
  });
});
