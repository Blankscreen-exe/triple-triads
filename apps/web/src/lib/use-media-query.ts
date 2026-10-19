'use client';

import { useSyncExternalStore } from 'react';

/** Whether a CSS media query matches, kept up to date. False during server rendering. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phones: below Tailwind's `sm` breakpoint. */
export const PHONE_QUERY = '(max-width: 639.98px)';
