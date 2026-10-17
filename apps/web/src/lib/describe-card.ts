import type { Element, Stats } from '@triple-triad/engine';
import { ELEMENT_LABELS, formatStat } from './elements';

export interface DescribableCard {
  readonly name: string;
  readonly stats: Stats;
  readonly element: Element | null;
  readonly stars: number;
}

/** Text alternative for a card, e.g. "Iron Knight, 3 stars, top 8, right 4, �, no element". */
export function describeCard(card: DescribableCard): string {
  const { top, right, bottom, left } = card.stats;
  const stats = `top ${formatStat(top)}, right ${formatStat(right)}, bottom ${formatStat(bottom)}, left ${formatStat(left)}`;
  const element = card.element ? `${ELEMENT_LABELS[card.element]} element` : 'no element';
  return `${card.name}, ${String(card.stars)} ${card.stars === 1 ? 'star' : 'stars'}, ${stats}, ${element}`;
}
