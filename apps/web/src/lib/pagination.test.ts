import { describe, expect, it } from 'vitest';
import { paginate } from './pagination';

const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

describe('paginate', () => {
  it('returns the requested page and where it sits in the list', () => {
    expect(paginate(letters, 2, 3)).toEqual({
      items: ['d', 'e', 'f'],
      page: 2,
      pageCount: 3,
      total: 7,
      first: 4,
      last: 6,
    });
  });

  it('returns a short last page', () => {
    expect(paginate(letters, 3, 3)).toMatchObject({ items: ['g'], first: 7, last: 7 });
  });

  it('moves out-of-range pages to the nearest one', () => {
    expect(paginate(letters, 9, 3).page).toBe(3);
    expect(paginate(letters, 0, 3).page).toBe(1);
    expect(paginate(letters, Number.NaN, 3).page).toBe(1);
  });

  it('has one empty page for an empty list', () => {
    expect(paginate([], 1, 5)).toEqual({
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
      first: 0,
      last: 0,
    });
  });

  it('treats page sizes below one as one', () => {
    expect(paginate(letters, 2, 0)).toMatchObject({ items: ['b'], pageCount: 7 });
  });
});
