import type { Element } from '@triple-triad/engine';

export const ELEMENT_LABELS: Readonly<Record<Element, string>> = {
  fire: 'Fire',
  ice: 'Ice',
  thunder: 'Thunder',
  earth: 'Earth',
  poison: 'Poison',
  wind: 'Wind',
  water: 'Water',
  holy: 'Holy',
};

/** How a stat value is printed on a card: 10 is shown as "A". */
export function formatStat(value: number): string {
  return value === 10 ? 'A' : String(value);
}
