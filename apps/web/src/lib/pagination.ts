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

/** Where a page sits in a list of `total` items, for fetching just that page (e.g. from SQL). */
export interface PageWindow {
  readonly page: number;
  readonly pageCount: number;
  /** Items to skip and to take. */
  readonly offset: number;
  readonly limit: number;
}

/** The window for page `page` (from 1) of `total` items; out-of-range pages move to the nearest. */
export function pageWindow(total: number, page: number, pageSize: number): PageWindow {
  const limit = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return { page: current, pageCount, offset: (current - 1) * limit, limit };
}

/**
 * Loads one page of a list stored elsewhere: `load` receives the offset and limit (e.g. for SQL's
 * OFFSET and LIMIT) and returns that page's items.
 */
export function loadPage<T>(
  total: number,
  page: number,
  pageSize: number,
  load: (offset: number, limit: number) => readonly T[],
): Page<T> {
  const window = pageWindow(total, page, pageSize);
  const items = total === 0 ? [] : load(window.offset, window.limit);
  return {
    items,
    page: window.page,
    pageCount: window.pageCount,
    total,
    first: items.length > 0 ? window.offset + 1 : 0,
    last: window.offset + items.length,
  };
}

/** Cuts a list into pages of `pageSize` and returns page `page` (from 1). */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  return loadPage(items.length, page, pageSize, (offset, limit) =>
    items.slice(offset, offset + limit),
  );
}

/** The query parameter that holds the page number on server-paged lists. */
export const PAGE_PARAM = 'page';

type Query = Readonly<Record<string, string | readonly string[] | undefined>>;

/** The page asked for in a URL query; 1 when it is missing or not a positive whole number. */
export function pageFromQuery(query: Query): number {
  const value = query[PAGE_PARAM];
  const text = typeof value === 'string' ? value : value?.[0];
  return text !== undefined && /^[1-9]\d{0,8}$/.test(text) ? Number(text) : 1;
}

/** A link to page `page` of a list, keeping the query's other parameters (e.g. filters). */
export function pageHref(pathname: string, query: Query, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === PAGE_PARAM || value === undefined) continue;
    for (const item of typeof value === 'string' ? [value] : value) params.append(key, item);
  }
  if (page > 1) params.set(PAGE_PARAM, String(page));
  const search = params.toString();
  return search === '' ? pathname : `${pathname}?${search}`;
}
