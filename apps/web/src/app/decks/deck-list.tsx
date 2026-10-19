'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button, buttonClasses } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { FilterButton } from '@/components/ui/filter-button';
import { Modal, ModalClose } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
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
import { useItemsThatFit } from '@/lib/use-items-that-fit';
import { PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { usePagination } from '@/lib/use-pagination';
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

/** Decks per page on wider screens; phones show as many as fit. */
const PAGE_SIZE = 8;
/** Space between rows (Tailwind `space-y-2`), for working out how many fit. */
const ROW_GAP = 8;

interface DeckListProps {
  readonly decks: readonly DeckListItem[];
  /** Cards a complete deck holds, for "18 / 20 cards". */
  readonly deckSize: number;
}

/**
 * The player's decks: searchable, filterable and paged, with actions on each row. On phones the
 * list fills the screen's remaining height with compact rows (details and actions behind ⋯), and
 * the Status and Sort filters are behind a filter button.
 */
export function DeckList({ decks, deckSize }: DeckListProps) {
  const [filters, setFilters] = useSearchParamState(
    deckFiltersFromSearchParams,
    deckFiltersToSearchParams,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [list, setList] = useState<HTMLUListElement | null>(null);
  const phone = useMediaQuery(PHONE_QUERY);
  const pageSize = useItemsThatFit(list, { enabled: phone, gap: ROW_GAP, fallback: PAGE_SIZE });

  const visible = applyDeckFilters(decks, filters);
  const filtered = isDeckFiltered(filters);
  const pages = usePagination(visible, pageSize, JSON.stringify(filters));

  return (
    <div className="space-y-4 max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:gap-2 max-sm:space-y-0">
      <div role="search" aria-label="Filter decks" className="space-y-2">
        <div className="flex flex-wrap items-end gap-3 max-sm:gap-2">
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
          <FilterButton
            open={filtersOpen}
            onToggle={() => {
              setFiltersOpen((current) => !current);
            }}
            activeCount={filters.status === null ? 0 : 1}
            controls="deck-filter-options"
            className="sm:hidden"
          />
          <div
            id="deck-filter-options"
            className={`flex gap-3 max-sm:w-full max-sm:*:flex-1 ${filtersOpen ? '' : 'max-sm:hidden'}`}
          >
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

      {visible.length === 0 && (
        <p className="py-10 text-center text-slate-300">No decks match these filters.</p>
      )}
      {/* Always rendered, so its height can be measured on phones before rows appear. */}
      <ul
        ref={setList}
        aria-label="Decks"
        className="space-y-2 max-sm:min-h-0 max-sm:flex-1 max-sm:overflow-hidden"
      >
        {pages.items.map((deck) => (
          <DeckRow key={deck.id} deck={deck} deckSize={deckSize} />
        ))}
      </ul>
      <Pagination
        label="Decks"
        page={pages.page}
        pageCount={pages.pageCount}
        onChange={pages.setPage}
      />
    </div>
  );
}

function DeckRow({ deck, deckSize }: { readonly deck: DeckListItem; readonly deckSize: number }) {
  const headingId = `deck-${deck.id}`;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { stats } = deck;
  const summary = [
    `${String(stats.cards)} / ${String(deckSize)} cards`,
    deck.problems.length > 0
      ? `${String(deck.problems.length)} ${deck.problems.length === 1 ? 'problem' : 'problems'}`
      : stats.averageStars === null
        ? null
        : `avg ${stats.averageStars.toFixed(1)}★`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li
      aria-labelledby={headingId}
      className={`flex items-center gap-x-4 gap-y-3 rounded-md border bg-black/20 px-4 py-3 max-sm:gap-2 max-sm:px-3 max-sm:py-2 sm:flex-wrap ${deck.isActive ? 'border-cream/70' : 'border-frame/30'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 sm:flex-wrap">
          <h2
            id={headingId}
            className="min-w-0 truncate font-display text-lg font-bold tracking-wider text-cream max-sm:text-base"
          >
            {deck.name}
          </h2>
          <DeckBadges deck={deck} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-300 sm:hidden">{summary}</p>
        <div className="max-sm:hidden">
          <DeckDetails deck={deck} deckSize={deckSize} />
        </div>
      </div>

      <DeckActions deck={deck} className="max-sm:hidden" />

      <button
        type="button"
        aria-label={`More about ${deck.name}`}
        aria-haspopup="dialog"
        onClick={() => {
          setDetailsOpen(true);
        }}
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-xl leading-none text-cream hover:bg-white/10 sm:hidden"
      >
        ⋯
      </button>
      {detailsOpen && (
        <Modal
          label={deck.name}
          variant="sheet"
          onClose={() => {
            setDetailsOpen(false);
          }}
        >
          <div className="space-y-4 rounded-t-lg border-2 border-b-0 border-frame/75 bg-linear-to-b from-window-top to-window-bottom p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold tracking-wider text-cream">
                {deck.name}
              </h2>
              <DeckBadges deck={deck} />
            </div>
            <DeckDetails deck={deck} deckSize={deckSize} />
            <div className="flex flex-wrap items-center gap-2">
              <DeckActions deck={deck} />
              <ModalClose variant="quiet" className="ml-auto">
                Close
              </ModalClose>
            </div>
          </div>
        </Modal>
      )}
    </li>
  );
}

function DeckBadges({ deck }: { readonly deck: DeckListItem }) {
  return (
    <>
      {deck.isActive && <Badge className="bg-action ring-1 ring-white/60">Active</Badge>}
      {deck.isReady ? (
        <Badge className="bg-status-open/70">Ready</Badge>
      ) : (
        <Badge className="bg-status-live/70">Needs fixing</Badge>
      )}
    </>
  );
}

/** A deck's stats and any rule problems. */
function DeckDetails({
  deck,
  deckSize,
}: {
  readonly deck: DeckListItem;
  readonly deckSize: number;
}) {
  const { stats } = deck;
  const starCounts = stats.byStars
    .map((count, index) => ({ stars: index + 1, count }))
    .filter(({ count }) => count > 0)
    .reverse();
  return (
    <>
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
    </>
  );
}

function DeckActions({
  deck,
  className = '',
}: {
  readonly deck: DeckListItem;
  readonly className?: string;
}) {
  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
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
      className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${className}`}
    >
      {children}
    </span>
  );
}
