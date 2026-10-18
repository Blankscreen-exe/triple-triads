/**
 * Filtering and sorting card lists (trunk, card maker, deck editor), and storing the choice in
 * the URL so it survives reloads and can be shared. Pure functions; the UI lives in
 * components/cards/card-filter-bar.tsx.
 */
import { ELEMENTS, type Element } from '@triple-triad/engine';

/** Where a card comes from: the admins' generic cards (starter decks) or the player's own. */
export const CARD_SOURCES = ['starter', 'made'] as const;
export type CardSource = (typeof CARD_SOURCES)[number];

export const CARD_SORTS = ['strongest', 'weakest', 'name'] as const;
export type CardSort = (typeof CARD_SORTS)[number];

export const STAR_RANKS = [1, 2, 3, 4, 5] as const;

export interface CardFilters {
  /** Part of the card name, case-insensitive. */
  readonly query: string;
  readonly stars: number | null;
  /** A specific element, 'none' for cards without one, or null for any. */
  readonly element: Element | 'none' | null;
  readonly source: CardSource | null;
  readonly sort: CardSort;
}

export const NO_FILTERS: CardFilters = {
  query: '',
  stars: null,
  element: null,
  source: null,
  sort: 'strongest',
};

/** What filtering needs to know about a card. */
export interface FilterableCard {
  readonly name: string;
  readonly stars: number;
  readonly element: Element | null;
  /** Total stat score (see engine `rankCard`); orders cards with the same stars. */
  readonly score: number;
  readonly source: CardSource;
}

/** The source filter only helps when the list mixes starter cards and the player's own. */
export function hasMixedSources(cards: readonly FilterableCard[]): boolean {
  return new Set(cards.map((card) => card.source)).size > 1;
}

/** True when any filter (not the sort order) narrows the list. */
export function isFiltered(filters: CardFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.stars !== null ||
    filters.element !== null ||
    filters.source !== null
  );
}

export function matchesFilters(card: FilterableCard, filters: CardFilters): boolean {
  const query = filters.query.trim().toLocaleLowerCase();
  return (
    (query === '' || card.name.toLocaleLowerCase().includes(query)) &&
    (filters.stars === null || card.stars === filters.stars) &&
    (filters.element === null ||
      (filters.element === 'none' ? card.element === null : card.element === filters.element)) &&
    (filters.source === null || card.source === filters.source)
  );
}

const byName = (a: FilterableCard, b: FilterableCard) => a.name.localeCompare(b.name);

const COMPARATORS: Record<CardSort, (a: FilterableCard, b: FilterableCard) => number> = {
  strongest: (a, b) => b.stars - a.stars || b.score - a.score || byName(a, b),
  weakest: (a, b) => a.stars - b.stars || a.score - b.score || byName(a, b),
  name: (a, b) => byName(a, b) || b.stars - a.stars,
};

/** The cards that match, in the chosen order. Does not modify the input. */
export function applyFilters<T extends FilterableCard>(
  cards: readonly T[],
  filters: CardFilters,
): T[] {
  return cards.filter((card) => matchesFilters(card, filters)).sort(COMPARATORS[filters.sort]);
}

// ---- URL ------------------------------------------------------------------------------------

const PARAMS = {
  query: 'q',
  stars: 'stars',
  element: 'element',
  source: 'source',
  sort: 'sort',
} as const;

const findIn = <T extends string | number>(options: readonly T[], value: unknown): T | null =>
  options.find((option) => String(option) === value) ?? null;

/** Reads filters from a URL query; unknown or invalid values are ignored rather than rejected. */
export function filtersFromSearchParams(params: URLSearchParams): CardFilters {
  const element = params.get(PARAMS.element);
  return {
    query: params.get(PARAMS.query) ?? '',
    stars: findIn(STAR_RANKS, params.get(PARAMS.stars)),
    element: element === 'none' ? 'none' : findIn(ELEMENTS, element),
    source: findIn(CARD_SOURCES, params.get(PARAMS.source)),
    sort: findIn(CARD_SORTS, params.get(PARAMS.sort)) ?? NO_FILTERS.sort,
  };
}

/**
 * Writes filters into a copy of `current`, leaving unrelated parameters alone and omitting
 * defaults so an unfiltered page keeps a clean URL.
 */
export function filtersToSearchParams(
  filters: CardFilters,
  current: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(current);
  const set = (key: string, value: string | null) => {
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
  };
  set(PARAMS.query, filters.query);
  set(PARAMS.stars, filters.stars === null ? null : String(filters.stars));
  set(PARAMS.element, filters.element);
  set(PARAMS.source, filters.source);
  set(PARAMS.sort, filters.sort === NO_FILTERS.sort ? null : filters.sort);
  return params;
}
