'use client';

import { useState, type ReactNode } from 'react';
import {
  applyFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
  hasMixedSources,
  type FilterableCard,
} from '@/lib/card-filters';
import { useItemsThatFit } from '@/lib/use-items-that-fit';
import { usePagination } from '@/lib/use-pagination';
import { useSearchParamState } from '@/lib/use-search-param-state';
import { Pagination } from '../ui/pagination';
import { CardFilterBar } from './card-filter-bar';

/** Rows of cards per page; the columns follow the screen width. */
const ROWS_PER_PAGE = 4;

export interface FilterableCardItem {
  readonly key: string;
  readonly card: FilterableCard;
  /** The grid cell's contents, rendered on the server (card, badges, buttons). */
  readonly content: ReactNode;
}

interface FilterableCardGridProps {
  readonly items: readonly FilterableCardItem[];
}

/**
 * A paged card grid with search, filters and sorting. Filters live in the URL query, so a reload,
 * the back button or a shared link keeps them; filtering itself happens instantly in the browser.
 * A page is four rows, however many columns the screen has room for.
 */
export function FilterableCardGrid({ items }: FilterableCardGridProps) {
  const [filters, setFilters] = useSearchParamState(filtersFromSearchParams, filtersToSearchParams);

  const cards = items.map((item) => item.card);
  const byCard = new Map(items.map((item) => [item.card, item]));
  const visible = applyFilters(cards, filters).flatMap((card) => byCard.get(card) ?? []);
  const [list, setList] = useState<HTMLUListElement | null>(null);
  const pageSize = useItemsThatFit(list, { fit: false, rows: ROWS_PER_PAGE, columns: 6 });
  const pages = usePagination(visible, pageSize, JSON.stringify(filters));

  return (
    <div className="space-y-4">
      <CardFilterBar
        filters={filters}
        onChange={setFilters}
        showSource={hasMixedSources(cards)}
        shown={visible.length}
        total={items.length}
      />
      {visible.length === 0 && (
        <p className="py-10 text-center text-slate-300">No cards match these filters.</p>
      )}
      {/* Always rendered, so its columns are known before cards appear. */}
      <ul
        ref={setList}
        aria-label="Cards"
        className="grid scroll-mt-24 grid-cols-3 gap-x-3 gap-y-4 sm:gap-5 md:grid-cols-4 lg:grid-cols-6"
      >
        {pages.items.map((item) => (
          <li key={item.key} className="relative space-y-2">
            {item.content}
          </li>
        ))}
      </ul>
      <Pagination
        label="Cards"
        page={pages.page}
        pageCount={pages.pageCount}
        onChange={(page) => {
          pages.setPage(page);
          // From the controls under a long page, go back up to the first row.
          if (list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: 'start' });
        }}
      />
    </div>
  );
}
