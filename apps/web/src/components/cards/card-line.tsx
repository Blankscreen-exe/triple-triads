import type { Element, Stats } from '@triple-triad/engine';
import { ELEMENT_LABELS, formatStat } from '@/lib/elements';

export interface CardLineProps {
  readonly name: string;
  readonly stats: Stats;
  readonly element: Element | null;
  readonly stars: number;
  /** Shown at the end of the row, e.g. "×3". */
  readonly count?: string;
}

const MAX_STARS = 5;

/**
 * Compact one-line card listing: stat diamond, name, element and stars.
 * Placeholder until the full card renderer (asset packs) is built.
 */
export function CardLine({ name, stats, element, stars, count }: CardLineProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-frame/25 bg-black/20 px-3 py-2">
      <StatDiamond stats={stats} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-slate-100">{name}</div>
        <div className="text-xs text-slate-300/70">
          {element ? ELEMENT_LABELS[element] : 'No element'}
        </div>
      </div>
      <div
        className="text-sm tracking-tight text-amber-300"
        aria-label={`${String(stars)} of ${String(MAX_STARS)} stars`}
      >
        {'★'.repeat(stars)}
        <span className="opacity-25">{'★'.repeat(MAX_STARS - stars)}</span>
      </div>
      {count && <div className="w-10 text-right text-sm font-semibold text-cream">{count}</div>}
    </div>
  );
}

function StatDiamond({ stats }: { readonly stats: Stats }) {
  const cell = 'flex items-center justify-center';
  return (
    <div
      className="grid size-10 shrink-0 grid-cols-3 grid-rows-3 font-display text-[11px] leading-none font-bold text-white"
      aria-label={`Top ${formatStat(stats.top)}, right ${formatStat(stats.right)}, bottom ${formatStat(stats.bottom)}, left ${formatStat(stats.left)}`}
    >
      <span className={`${cell} col-start-2`}>{formatStat(stats.top)}</span>
      <span className={`${cell} col-start-1 row-start-2`}>{formatStat(stats.left)}</span>
      <span className={`${cell} col-start-3 row-start-2`}>{formatStat(stats.right)}</span>
      <span className={`${cell} col-start-2 row-start-3`}>{formatStat(stats.bottom)}</span>
    </div>
  );
}
