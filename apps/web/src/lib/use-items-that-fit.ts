'use client';

import { useEffect, useState } from 'react';

/**
 * How many rows fit in a list whose height is set by its layout (e.g. `flex-1 min-h-0`), for
 * pages that should fill the screen without scrolling. Pass the list element (from a callback
 * ref, so a list that appears later is measured too). Rows are assumed to be of equal height;
 * the first one is measured. Updates when the list is resized.
 */
export function useItemsThatFit(
  list: HTMLElement | null,
  { enabled, gap, fallback }: { enabled: boolean; gap: number; fallback: number },
): number {
  const [count, setCount] = useState(fallback);

  useEffect(() => {
    if (!enabled || !list) return;
    const measure = () => {
      const row = list.firstElementChild?.getBoundingClientRect().height;
      if (!row) return;
      setCount(Math.max(1, Math.floor((list.clientHeight + gap) / (row + gap))));
    };
    // Also called once on observe, with the first layout.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => {
      observer.disconnect();
    };
  }, [list, enabled, gap]);

  return enabled ? count : fallback;
}
