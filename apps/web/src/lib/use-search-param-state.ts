'use client';

import { usePathname, useSearchParams } from 'next/navigation';

/**
 * State kept in the URL query, e.g. list filters: it survives reloads and the back button, and can
 * be shared as a link. Updates use `history.replaceState`, which Next.js keeps in sync with
 * `useSearchParams`, so typing in a search box neither reloads the page nor floods the history.
 *
 * `read` must tolerate any query (ignore invalid values); `write` returns the new query, keeping
 * parameters it does not own.
 */
export function useSearchParamState<T>(
  read: (params: URLSearchParams) => T,
  write: (value: T, current: URLSearchParams) => URLSearchParams,
): readonly [T, (value: T) => void] {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = new URLSearchParams(searchParams.toString());

  const set = (value: T) => {
    const search = write(value, current).toString();
    window.history.replaceState(null, '', search === '' ? pathname : `${pathname}?${search}`);
  };

  return [read(current), set] as const;
}
