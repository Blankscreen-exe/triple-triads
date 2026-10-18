'use client';

import type { ReactNode } from 'react';
import {
  applyFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
  hasMixedSources,
  type FilterableCard,
} from '@/lib/card-filters';
import { useSearchParamState } from '@/lib/use-search-param-state';
import { CardFilterBar } from './card-filter-bar';

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
 * A card grid with search, filters and sorting. Filters live in the URL query, so a reload, the
 * back button or a shared link keeps them; filtering itself happens instantly in the browser.
 */
export function FilterableCardGrid({ items }: FilterableCardGridProps) {
  const [filters, setFilters] = useSearchParamState(filtersFromSearchParams, filtersToSearchParams);

  const cards = items.map((item) => item.card);
  const byCard = new Map(items.map((item) => [item.card, item]));
  const visible = applyFilters(cards, filters).flatMap((card) => byCard.get(card) ?? []);

  return (
    <div className="space-y-4">
      <CardFilterBar
        filters={filters}
        onChange={setFilters}
        showSource={hasMixedSources(cards)}
        shown={visible.length}
        total={items.length}
      />
      {visible.length === 0 ? (
        <p className="py-10 text-center text-slate-300">No cards match these filters.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((item) => (
            <li key={item.key} className="relative space-y-2">
              {item.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
