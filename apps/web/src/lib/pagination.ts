/** One page of a list. */
export interface Page<T> {
  readonly items: readonly T[];
  /** The page shown, from 1. Out-of-range requests are moved to the nearest page. */
  readonly page: number;
  /** At least 1, even for an empty list. */
  readonly pageCount: number;
  /** Items in the whole list. */
  readonly total: number;
  /** Position (from 1) of the first and last item shown; both 0 for an empty list. */
  readonly first: number;
  readonly last: number;
}

/** Cuts a list into pages of `pageSize` and returns page `page` (from 1). */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * size;
  const shown = items.slice(start, start + size);
  return {
    items: shown,
    page: current,
    pageCount,
    total: items.length,
    first: shown.length > 0 ? start + 1 : 0,
    last: start + shown.length,
  };
}
