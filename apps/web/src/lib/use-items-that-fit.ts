'use client';

import { useEffect, useState } from 'react';

interface Layout {
  readonly columns: number;
  /** Rows that fit the list's height; null until measured. */
  readonly rows: number | null;
}

/**
 * How many items a page of a list or grid should hold: whole rows times its columns. Pass the list
 * element (from a callback ref, so a list that appears later is measured too).
 *
 * Columns are read from the element's CSS grid (1 for anything else), so they follow its
 * breakpoints. With `fit`, the rows are as many as fit the element's height, for pages that fill
 * the screen without scrolling (its height must come from the layout, e.g. `flex-1 min-h-0`);
 * otherwise they are `rows`. Items are assumed to be of equal height; the first one is measured.
 * `columns` is the guess used before the first measurement (e.g. during server rendering).
 */
export function useItemsThatFit(
  list: HTMLElement | null,
  { fit, rows, columns = 1 }: { fit: boolean; rows: number; columns?: number },
): number {
  const [layout, setLayout] = useState<Layout>({ columns, rows: null });

  useEffect(() => {
    if (!list) return;
    const measure = () => {
      const style = getComputedStyle(list);
      const template = style.display.includes('grid') ? style.gridTemplateColumns : 'none';
      const measuredColumns = template === 'none' ? 1 : template.split(' ').length;
      const row = list.firstElementChild?.getBoundingClientRect().height;
      const gap = Number.parseFloat(style.rowGap) || 0;
      const measuredRows = row
        ? Math.max(1, Math.floor((list.clientHeight + gap) / (row + gap)))
        : null;
      setLayout((current) =>
        current.columns === measuredColumns && current.rows === (measuredRows ?? current.rows)
          ? current
          : { columns: measuredColumns, rows: measuredRows ?? current.rows },
      );
    };
    // Also called once on observe, with the first layout.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => {
      observer.disconnect();
    };
  }, [list]);

  return layout.columns * (fit ? (layout.rows ?? rows) : rows);
}
