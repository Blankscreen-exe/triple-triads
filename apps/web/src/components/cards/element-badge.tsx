import type { Element } from '@triple-triad/engine';
import { ElementIcon } from '@/components/game/element-icon';
import { ELEMENT_LABELS } from '@/lib/elements';

/** Each element's colours, matching its icon. */
const ELEMENT_CLASSES: Readonly<Record<Element, string>> = {
  fire: 'bg-orange-500/20 text-orange-200 ring-orange-400/60',
  ice: 'bg-cyan-400/15 text-cyan-100 ring-cyan-300/60',
  thunder: 'bg-yellow-400/15 text-yellow-100 ring-yellow-300/60',
  earth: 'bg-amber-700/30 text-amber-200 ring-amber-500/60',
  poison: 'bg-violet-500/20 text-violet-200 ring-violet-400/60',
  wind: 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/60',
  water: 'bg-blue-500/20 text-blue-200 ring-blue-400/60',
  holy: 'bg-amber-50/15 text-amber-50 ring-amber-100/60',
};

interface ElementBadgeProps {
  readonly element: Element;
  /** How many cards have it, shown after the name. */
  readonly count?: number;
  /** Shows only the icon and count, for tight spaces; the name stays for screen readers. */
  readonly compact?: boolean;
}

/** An element's icon and name in its own colour. */
export function ElementBadge({ element, count, compact = false }: ElementBadgeProps) {
  const label = ELEMENT_LABELS[element];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-xs font-semibold ring-1 ${ELEMENT_CLASSES[element]}`}
    >
      <span aria-hidden className="flex">
        <ElementIcon element={element} className="size-4" />
      </span>
      {compact ? <span className="sr-only">{label}</span> : label}
      {count !== undefined && <span className="tabular-nums">×{count}</span>}
    </span>
  );
}
