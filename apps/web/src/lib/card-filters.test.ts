import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
  hasMixedSources,
  isFiltered,
  NO_FILTERS,
  type CardFilters,
  type FilterableCard,
} from './card-filters';

const card = (
  overrides: Partial<FilterableCard> & Pick<FilterableCard, 'name'>,
): FilterableCard => ({
  stars: 1,
  element: null,
  score: 100,
  source: 'starter',
  ...overrides,
});

const CARDS = [
  card({ name: 'Geezard', stars: 1, score: 108 }),
  card({ name: 'Ifrit', stars: 4, score: 358, element: 'fire' }),
  card({ name: 'Bomb', stars: 2, score: 210, element: 'fire', source: 'made' }),
  card({ name: 'Malboro', stars: 2, score: 243, element: 'poison' }),
  card({ name: 'Squall', stars: 5, score: 451, source: 'made' }),
];

const names = (cards: readonly FilterableCard[]) => cards.map((c) => c.name);
const filter = (overrides: Partial<CardFilters>) =>
  names(applyFilters(CARDS, { ...NO_FILTERS, ...overrides }));

describe('applyFilters', () => {
  it('shows every card strongest first by default', () => {
    expect(filter({})).toEqual(['Squall', 'Ifrit', 'Malboro', 'Bomb', 'Geezard']);
  });

  it('searches names without caring about case or surrounding spaces', () => {
    expect(filter({ query: '  BO ' })).toEqual(['Malboro', 'Bomb']);
  });

  it('filters by stars, element, no element and source', () => {
    expect(filter({ stars: 2 })).toEqual(['Malboro', 'Bomb']);
    expect(filter({ element: 'fire' })).toEqual(['Ifrit', 'Bomb']);
    expect(filter({ element: 'none' })).toEqual(['Squall', 'Geezard']);
    expect(filter({ source: 'made' })).toEqual(['Squall', 'Bomb']);
  });

  it('combines filters', () => {
    expect(filter({ element: 'fire', source: 'made' })).toEqual(['Bomb']);
    expect(filter({ stars: 5, element: 'fire' })).toEqual([]);
  });

  it('sorts weakest first or by name', () => {
    expect(filter({ sort: 'weakest' })).toEqual(['Geezard', 'Bomb', 'Malboro', 'Ifrit', 'Squall']);
    expect(filter({ sort: 'name' })).toEqual(['Bomb', 'Geezard', 'Ifrit', 'Malboro', 'Squall']);
  });

  it('leaves the input untouched', () => {
    const before = names(CARDS);
    applyFilters(CARDS, { ...NO_FILTERS, sort: 'name' });

    expect(names(CARDS)).toEqual(before);
  });
});

describe('hasMixedSources', () => {
  it('is true only when starter cards and the player’s own are both listed', () => {
    expect(hasMixedSources(CARDS)).toBe(true);
    expect(hasMixedSources(CARDS.filter((c) => c.source === 'starter'))).toBe(false);
    expect(hasMixedSources([])).toBe(false);
  });
});

describe('isFiltered', () => {
  it('ignores the sort order and blank searches', () => {
    expect(isFiltered({ ...NO_FILTERS, sort: 'name', query: '   ' })).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, element: 'none' })).toBe(true);
  });
});

describe('URL parameters', () => {
  it('round-trip every filter', () => {
    const filters: CardFilters = {
      query: 'wyrm',
      stars: 3,
      element: 'none',
      source: 'made',
      sort: 'name',
    };

    expect(filtersFromSearchParams(filtersToSearchParams(filters))).toEqual(filters);
  });

  it('keep an unfiltered URL clean and keep unrelated parameters', () => {
    expect(filtersToSearchParams(NO_FILTERS).toString()).toBe('');
    expect(
      filtersToSearchParams(
        { ...NO_FILTERS, stars: 4 },
        new URLSearchParams('tab=1&q=old'),
      ).toString(),
    ).toBe('tab=1&stars=4');
  });

  it('ignore values that are not valid filters', () => {
    expect(
      filtersFromSearchParams(
        new URLSearchParams('stars=9&element=lava&source=shop&sort=random&q=ok'),
      ),
    ).toEqual({ ...NO_FILTERS, query: 'ok' });
  });
});
