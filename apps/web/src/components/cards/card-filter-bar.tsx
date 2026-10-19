'use client';

import { ELEMENTS } from '@triple-triad/engine';
import {
  CARD_SORTS,
  CARD_SOURCES,
  isFiltered,
  NO_FILTERS,
  STAR_RANKS,
  type CardFilters,
  type CardSort,
  type CardSource,
} from '@/lib/card-filters';
import { ELEMENT_LABELS } from '@/lib/elements';
import { useId, useState } from 'react';
import { Button } from '../ui/button';
import { FilterButton } from '../ui/filter-button';
import { SelectField } from '../ui/select-field';
import { TextField } from '../ui/text-field';

const SOURCE_LABELS: Record<CardSource, string> = {
  starter: 'Starter cards',
  made: 'Made by you',
};

const SORT_LABELS: Record<CardSort, string> = {
  strongest: 'Strongest first',
  weakest: 'Weakest first',
  name: 'Name',
};

/** Select value for "no filter". */
const ANY = '';

interface CardFilterBarProps {
  readonly filters: CardFilters;
  readonly onChange: (filters: CardFilters) => void;
  /** Offer the starter/made-by-you filter (only useful where both kinds appear). */
  readonly showSource?: boolean;
  /** How many cards match, out of how many, for the result count. */
  readonly shown: number;
  readonly total: number;
  /**
   * `row` for a full-width bar, its filters behind a button on phones only; `sidebar` for a narrow
   * column, its filters always behind the button to leave room for the cards.
   */
  readonly layout?: 'row' | 'sidebar';
}

/**
 * Search, filter and sort controls for a list of cards. Controlled: the caller owns the state.
 * Where space is short, everything but the search is behind a filter button (see `layout`).
 */
export function CardFilterBar({
  filters,
  onChange,
  showSource = false,
  shown,
  total,
  layout = 'row',
}: CardFilterBarProps) {
  const update = (changes: Partial<CardFilters>) => {
    onChange({ ...filters, ...changes });
  };
  const [open, setOpen] = useState(false);
  const optionsId = useId();
  const activeCount = [filters.stars, filters.element, filters.source].filter(
    (value) => value !== null,
  ).length;

  return (
    <div role="search" aria-label="Filter cards" className="space-y-3">
      <div
        className={
          layout === 'row' ? 'flex flex-wrap items-end gap-3' : 'grid grid-cols-2 items-end gap-2'
        }
      >
        <div
          className={`flex items-end gap-2 ${layout === 'row' ? 'min-w-40 flex-1' : 'col-span-2'}`}
        >
          <TextField
            label="Search"
            type="search"
            placeholder="Card name"
            value={filters.query}
            className="min-w-0 flex-1"
            onChange={(event) => {
              update({ query: event.target.value });
            }}
          />
          <FilterButton
            open={open}
            onToggle={() => {
              setOpen((current) => !current);
            }}
            activeCount={activeCount}
            controls={optionsId}
            className={layout === 'row' ? 'sm:hidden' : ''}
          />
        </div>
        <div
          id={optionsId}
          className={
            layout === 'row'
              ? `sm:contents max-sm:w-full ${open ? 'max-sm:grid max-sm:grid-cols-2 max-sm:items-end max-sm:gap-2' : 'max-sm:hidden'}`
              : `col-span-2 grid-cols-2 items-end gap-2 ${open ? 'grid' : 'hidden'}`
          }
        >
          <SelectField
            label="Stars"
            value={filters.stars === null ? ANY : String(filters.stars)}
            onChange={(value) => {
              update({ stars: STAR_RANKS.find((rank) => String(rank) === value) ?? null });
            }}
          >
            <option value={ANY}>Any</option>
            {STAR_RANKS.map((rank) => (
              <option key={rank} value={rank}>
                {'★'.repeat(rank)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Element"
            value={filters.element ?? ANY}
            onChange={(value) => {
              update({
                element: value === 'none' ? 'none' : (ELEMENTS.find((e) => e === value) ?? null),
              });
            }}
          >
            <option value={ANY}>Any</option>
            <option value="none">None</option>
            {ELEMENTS.map((element) => (
              <option key={element} value={element}>
                {ELEMENT_LABELS[element]}
              </option>
            ))}
          </SelectField>
          {showSource && (
            <SelectField
              label="Source"
              value={filters.source ?? ANY}
              onChange={(value) => {
                update({ source: CARD_SOURCES.find((source) => source === value) ?? null });
              }}
            >
              <option value={ANY}>All cards</option>
              {CARD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {SOURCE_LABELS[source]}
                </option>
              ))}
            </SelectField>
          )}
          <SelectField
            label="Sort"
            value={filters.sort}
            onChange={(value) => {
              update({ sort: CARD_SORTS.find((sort) => sort === value) ?? NO_FILTERS.sort });
            }}
          >
            {CARD_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      <div className="flex min-h-8 items-center gap-3 text-sm text-slate-300/80">
        <p aria-live="polite">
          {isFiltered(filters)
            ? `Showing ${String(shown)} of ${String(total)} cards`
            : `${String(total)} ${total === 1 ? 'card' : 'cards'}`}
        </p>
        {isFiltered(filters) && (
          <Button
            variant="quiet"
            className="!px-2 !py-1 text-xs"
            onClick={() => {
              onChange({ ...NO_FILTERS, sort: filters.sort });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
