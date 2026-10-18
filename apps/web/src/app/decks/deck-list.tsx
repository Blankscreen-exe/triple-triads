'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button, buttonClasses } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import {
  applyDeckFilters,
  DECK_SORTS,
  DECK_STATUSES,
  deckFiltersFromSearchParams,
  deckFiltersToSearchParams,
  isDeckFiltered,
  NO_DECK_FILTERS,
  type DeckSort,
  type DeckStatus,
  type FilterableDeck,
} from '@/lib/deck-filters';
import type { DeckStats } from '@/lib/deck-stats';
import { useSearchParamState } from '@/lib/use-search-param-state';
import { deleteDeckAction, makeDeckActive } from './actions';

export interface DeckListItem extends FilterableDeck {
  readonly id: string;
  readonly stats: DeckStats;
  /** Deck-rule problems, already described for players; empty when the deck is ready. */
  readonly problems: readonly string[];
}

const STATUS_LABELS: Record<DeckStatus, string> = {
  ready: 'Ready to play',
  'needs-fixing': 'Needs fixing',
};

const SORT_LABELS: Record<DeckSort, string> = {
  active: 'Active first',
  recent: 'Recently edited',
  strongest: 'Strongest',
  name: 'Name',
};

interface DeckListProps {
  readonly decks: readonly DeckListItem[];
  /** Cards a complete deck holds, for "18 / 20 cards". */
  readonly deckSize: number;
}

/** The player's decks: searchable, filterable and scrollable, with actions on each row. */
export function DeckList({ decks, deckSize }: DeckListProps) {
  const [filters, setFilters] = useSearchParamState(
    deckFiltersFromSearchParams,
    deckFiltersToSearchParams,
  );
  const visible = applyDeckFilters(decks, filters);
  const filtered = isDeckFiltered(filters);

  return (
    <div className="space-y-4">
      <div role="search" aria-label="Filter decks" className="space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Search"
            type="search"
            placeholder="Deck name"
            value={filters.query}
            className="min-w-40 flex-1"
            onChange={(event) => {
              setFilters({ ...filters, query: event.target.value });
            }}
          />
          <SelectField
            label="Status"
            value={filters.status ?? ''}
            onChange={(value) => {
              setFilters({ ...filters, status: DECK_STATUSES.find((s) => s === value) ?? null });
            }}
          >
            <option value="">All decks</option>
            {DECK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Sort"
            value={filters.sort}
            onChange={(value) => {
              setFilters({
                ...filters,
                sort: DECK_SORTS.find((sort) => sort === value) ?? NO_DECK_FILTERS.sort,
              });
            }}
          >
            {DECK_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex min-h-8 items-center gap-3 text-sm text-slate-300/80">
          <p aria-live="polite">
            {filtered
              ? `Showing ${String(visible.length)} of ${String(decks.length)} decks`
              : `${String(decks.length)} ${decks.length === 1 ? 'deck' : 'decks'}`}
          </p>
          {filtered && (
            <Button
              variant="quiet"
              className="!px-2 !py-1 text-xs"
              onClick={() => {
                setFilters({ ...NO_DECK_FILTERS, sort: filters.sort });
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-slate-300">No decks match these filters.</p>
      ) : (
        <ul
          aria-label="Decks"
          className="max-h-[min(40rem,65vh)] space-y-2 overflow-y-auto overscroll-contain pr-1"
        >
          {visible.map((deck) => (
            <DeckRow key={deck.id} deck={deck} deckSize={deckSize} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DeckRow({ deck, deckSize }: { readonly deck: DeckListItem; readonly deckSize: number }) {
  const headingId = `deck-${deck.id}`;
  const { stats } = deck;
  const starCounts = stats.byStars
    .map((count, index) => ({ stars: index + 1, count }))
    .filter(({ count }) => count > 0)
    .reverse();

  return (
    <li
      aria-labelledby={headingId}
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border bg-black/20 px-4 py-3 ${deck.isActive ? 'border-cream/70' : 'border-frame/30'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id={headingId}
            className="truncate font-display text-lg font-bold tracking-wider text-cream"
          >
            {deck.name}
          </h2>
          {deck.isActive && <Badge className="bg-action ring-1 ring-white/60">Active</Badge>}
          {deck.isReady ? (
            <Badge className="bg-status-open/70">Ready</Badge>
          ) : (
            <Badge className="bg-status-live/70">Needs fixing</Badge>
          )}
        </div>
        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
          <Stat label="Cards">
            {stats.cards} / {deckSize}
          </Stat>
          <Stat label="Average">
            {stats.averageStars === null ? '–' : `${stats.averageStars.toFixed(1)}★`}
          </Stat>
          {starCounts.length > 0 && (
            <Stat label="By stars">
              {starCounts
                .map(({ stars, count }) => `${String(stars)}★ ×${String(count)}`)
                .join(' · ')}
            </Stat>
          )}
          <Stat label="With an element">{stats.elementalCards}</Stat>
        </dl>
        {deck.problems.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-xs text-score-red">
            {deck.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link href={`/decks/${deck.id}`} className={buttonClasses('secondary', '!py-1 text-sm')}>
          Edit
        </Link>
        {!deck.isActive && (
          <form action={makeDeckActive}>
            <input type="hidden" name="deckId" value={deck.id} />
            <Button type="submit" variant="secondary" className="!py-1 text-sm">
              Make active
            </Button>
          </form>
        )}
        <form action={deleteDeckAction}>
          <input type="hidden" name="deckId" value={deck.id} />
          <ConfirmButton
            variant="quiet"
            className="!py-1 text-sm"
            confirmation={`Delete the deck "${deck.name}"?`}
          >
            Delete
          </ConfirmButton>
        </form>
      </div>
    </li>
  );
}

function Stat({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex gap-1">
      <dt className="text-slate-400">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}

function Badge({ className, children }: { readonly className: string; readonly children: string }) {
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${className}`}
    >
      {children}
    </span>
  );
}
