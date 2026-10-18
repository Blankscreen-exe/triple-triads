/**
 * Filtering and sorting the deck list, and storing the choice in the URL (like card-filters.ts).
 */

export const DECK_STATUSES = ['ready', 'needs-fixing'] as const;
export type DeckStatus = (typeof DECK_STATUSES)[number];

export const DECK_SORTS = ['active', 'recent', 'strongest', 'name'] as const;
export type DeckSort = (typeof DECK_SORTS)[number];

export interface DeckFilters {
  readonly query: string;
  readonly status: DeckStatus | null;
  readonly sort: DeckSort;
}

export const NO_DECK_FILTERS: DeckFilters = { query: '', status: null, sort: 'active' };

/** What filtering needs to know about a deck. */
export interface FilterableDeck {
  readonly name: string;
  readonly isActive: boolean;
  /** True when the deck follows the deck rules and can be used in a game. */
  readonly isReady: boolean;
  /** Last change, in milliseconds since the epoch. */
  readonly updatedAt: number;
  readonly totalScore: number;
}

export function isDeckFiltered(filters: DeckFilters): boolean {
  return filters.query.trim() !== '' || filters.status !== null;
}

function matches(deck: FilterableDeck, filters: DeckFilters): boolean {
  const query = filters.query.trim().toLocaleLowerCase();
  return (
    (query === '' || deck.name.toLocaleLowerCase().includes(query)) &&
    (filters.status === null || (filters.status === 'ready') === deck.isReady)
  );
}

const byName = (a: FilterableDeck, b: FilterableDeck) => a.name.localeCompare(b.name);
const byRecent = (a: FilterableDeck, b: FilterableDeck) => b.updatedAt - a.updatedAt;

const COMPARATORS: Record<DeckSort, (a: FilterableDeck, b: FilterableDeck) => number> = {
  active: (a, b) => Number(b.isActive) - Number(a.isActive) || byRecent(a, b) || byName(a, b),
  recent: (a, b) => byRecent(a, b) || byName(a, b),
  strongest: (a, b) => b.totalScore - a.totalScore || byName(a, b),
  name: (a, b) => byName(a, b) || byRecent(a, b),
};

/** The decks that match, in the chosen order. Does not modify the input. */
export function applyDeckFilters<T extends FilterableDeck>(
  decks: readonly T[],
  filters: DeckFilters,
): T[] {
  return decks.filter((deck) => matches(deck, filters)).sort(COMPARATORS[filters.sort]);
}

// ---- URL ------------------------------------------------------------------------------------

const PARAMS = { query: 'q', status: 'status', sort: 'sort' } as const;

const findIn = <T extends string>(options: readonly T[], value: string | null): T | null =>
  options.find((option) => option === value) ?? null;

/** Reads filters from a URL query; invalid values are ignored. */
export function deckFiltersFromSearchParams(params: URLSearchParams): DeckFilters {
  return {
    query: params.get(PARAMS.query) ?? '',
    status: findIn(DECK_STATUSES, params.get(PARAMS.status)),
    sort: findIn(DECK_SORTS, params.get(PARAMS.sort)) ?? NO_DECK_FILTERS.sort,
  };
}

/** Writes filters into a copy of `current`, omitting defaults. */
export function deckFiltersToSearchParams(
  filters: DeckFilters,
  current: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(current);
  const set = (key: string, value: string | null) => {
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
  };
  set(PARAMS.query, filters.query);
  set(PARAMS.status, filters.status);
  set(PARAMS.sort, filters.sort === NO_DECK_FILTERS.sort ? null : filters.sort);
  return params;
}
