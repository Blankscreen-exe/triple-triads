import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(123);
    const b = new Rng(123);

    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });

  it('resumes from a saved state', () => {
    const original = new Rng(99);
    original.next();
    const resumed = new Rng(original.state);

    expect(resumed.next()).toBe(original.next());
  });

  it('returns floats in [0, 1)', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('returns integers within an inclusive range, covering both ends', () => {
    const rng = new Rng(2);
    const values = new Set(Array.from({ length: 500 }, () => rng.int(0, 3)));

    expect([...values].sort()).toEqual([0, 1, 2, 3]);
  });

  it('rejects invalid ranges', () => {
    expect(() => new Rng(1).int(3, 1)).toThrow(RangeError);
    expect(() => new Rng(1).int(0.5, 2)).toThrow(RangeError);
  });

  it('shuffles into a permutation without modifying the input', () => {
    const items = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);

    const shuffled = new Rng(5).shuffle(items);

    expect([...shuffled].sort()).toEqual([...items]);
    expect(shuffled).not.toEqual(items);
  });

  it('cannot pick from an empty array', () => {
    expect(() => new Rng(1).pick([])).toThrow(RangeError);
  });
});
