import { describe, expect, it } from 'vitest';
import {
  applyDeckFilters,
  deckFiltersFromSearchParams,
  deckFiltersToSearchParams,
  isDeckFiltered,
  NO_DECK_FILTERS,
  type DeckFilters,
  type FilterableDeck,
} from './deck-filters';

const deck = (name: string, overrides: Partial<FilterableDeck> = {}): FilterableDeck => ({
  name,
  isActive: false,
  isReady: true,
  updatedAt: 0,
  totalScore: 4000,
  ...overrides,
});

const DECKS = [
  deck('Wanderer', { updatedAt: 1, totalScore: 3900 }),
  deck('Vanguard', { isActive: true, updatedAt: 2, totalScore: 4100 }),
  deck('Lizard swarm', { isReady: false, updatedAt: 5, totalScore: 900 }),
  deck('Elementalist', { updatedAt: 3, totalScore: 4200 }),
];

const names = (overrides: Partial<DeckFilters>) =>
  applyDeckFilters(DECKS, { ...NO_DECK_FILTERS, ...overrides }).map((d) => d.name);

describe('applyDeckFilters', () => {
  it('puts the active deck first, then the most recently edited', () => {
    expect(names({})).toEqual(['Vanguard', 'Lizard swarm', 'Elementalist', 'Wanderer']);
  });

  it('sorts by recent edits, strength or name', () => {
    expect(names({ sort: 'recent' })).toEqual([
      'Lizard swarm',
      'Elementalist',
      'Vanguard',
      'Wanderer',
    ]);
    expect(names({ sort: 'strongest' })).toEqual([
      'Elementalist',
      'Vanguard',
      'Wanderer',
      'Lizard swarm',
    ]);
    expect(names({ sort: 'name' })).toEqual([
      'Elementalist',
      'Lizard swarm',
      'Vanguard',
      'Wanderer',
    ]);
  });

  it('searches names and filters by whether the deck can be played', () => {
    expect(names({ query: ' AN ' })).toEqual(['Vanguard', 'Wanderer']);
    expect(names({ status: 'needs-fixing' })).toEqual(['Lizard swarm']);
    expect(names({ status: 'ready', query: 'el' })).toEqual(['Elementalist']);
  });
});

describe('deck filter URLs', () => {
  it('round-trip, omit defaults and ignore invalid values', () => {
    const filters: DeckFilters = { query: 'swarm', status: 'needs-fixing', sort: 'name' };

    expect(deckFiltersFromSearchParams(deckFiltersToSearchParams(filters))).toEqual(filters);
    expect(deckFiltersToSearchParams(NO_DECK_FILTERS).toString()).toBe('');
    expect(deckFiltersFromSearchParams(new URLSearchParams('status=broken&sort=size'))).toEqual(
      NO_DECK_FILTERS,
    );
  });

  it('count only real filters as filtering', () => {
    expect(isDeckFiltered({ ...NO_DECK_FILTERS, sort: 'name', query: '  ' })).toBe(false);
    expect(isDeckFiltered({ ...NO_DECK_FILTERS, status: 'ready' })).toBe(true);
  });
});
