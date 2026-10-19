'use client';

import { useState } from 'react';
import { paginate, type Page } from './pagination';

/**
 * Pages through a list in a client component. The page goes back to 1 whenever `resetKey`
 * changes (e.g. the filters, so a new search starts on its first page), and is kept in range
 * when the list or page size shrinks.
 */
export function usePagination<T>(
  items: readonly T[],
  pageSize: number,
  resetKey: string,
): Page<T> & { readonly setPage: (page: number) => void } {
  const [state, setState] = useState({ page: 1, key: resetKey });
  const requested = state.key === resetKey ? state.page : 1;
  const current = paginate(items, requested, pageSize);
  return {
    ...current,
    setPage: (page) => {
      setState({ page, key: resetKey });
    },
  };
}
