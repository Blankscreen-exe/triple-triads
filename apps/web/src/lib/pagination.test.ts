import { describe, expect, it, vi } from 'vitest';
import { loadPage, pageFromQuery, pageHref, pageWindow, paginate } from './pagination';

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

describe('loadPage', () => {
  it('asks only for the requested page', () => {
    const load = vi.fn((offset: number, limit: number) => letters.slice(offset, offset + limit));
    expect(loadPage(letters.length, 3, 3, load)).toEqual({
      items: ['g'],
      page: 3,
      pageCount: 3,
      total: 7,
      first: 7,
      last: 7,
    });
    expect(load).toHaveBeenCalledWith(6, 3);
  });

  it('loads nothing for an empty list', () => {
    const load = vi.fn(() => []);
    expect(loadPage(0, 4, 10, load)).toMatchObject({ items: [], page: 1, pageCount: 1 });
    expect(load).not.toHaveBeenCalled();
  });
});

describe('pageWindow', () => {
  it('gives the offset and limit for a page', () => {
    expect(pageWindow(25, 2, 10)).toEqual({ page: 2, pageCount: 3, offset: 10, limit: 10 });
  });

  it('moves past-the-end pages to the last one', () => {
    expect(pageWindow(25, 99, 10)).toMatchObject({ page: 3, offset: 20 });
  });
});

describe('pageFromQuery', () => {
  it('reads a positive whole page number', () => {
    expect(pageFromQuery({ page: '4' })).toBe(4);
    expect(pageFromQuery({ page: ['2', '5'] })).toBe(2);
  });

  it('falls back to the first page for anything else', () => {
    for (const page of [undefined, '', '0', '-1', '1.5', 'abc', '02', '99999999999']) {
      expect(pageFromQuery({ page })).toBe(1);
    }
  });
});

describe('pageHref', () => {
  it('keeps other parameters and replaces the page', () => {
    expect(pageHref('/rankings', { page: '2', q: 'zell', tag: ['a', 'b'] }, 3)).toBe(
      '/rankings?q=zell&tag=a&tag=b&page=3',
    );
  });

  it('leaves the first page out of the link', () => {
    expect(pageHref('/rankings', { page: '2' }, 1)).toBe('/rankings');
  });
});
