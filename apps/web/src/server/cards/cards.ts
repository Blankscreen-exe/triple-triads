/**
 * Mapping stored cards to the shapes the rest of the app uses.
 */
import {
  DEFAULT_SCORING,
  isStatValue,
  rankCard,
  type Element,
  type ScoringConfig,
  type StatValue,
  type Stats,
} from '@triple-triad/engine';
import type { CardKind, cards } from '../db/schema';

export type CardRow = typeof cards.$inferSelect;

export interface CardSummary {
  readonly id: string;
  readonly name: string;
  readonly artKey: string | null;
  readonly stats: Stats;
  readonly element: Element | null;
  readonly kind: CardKind;
  readonly creatorId: string | null;
  readonly score: number;
  readonly stars: number;
}

export function toCardSummary(row: CardRow, scoring: ScoringConfig = DEFAULT_SCORING): CardSummary {
  const stats: Stats = {
    top: toStatValue(row.top),
    right: toStatValue(row.right),
    bottom: toStatValue(row.bottom),
    left: toStatValue(row.left),
  };
  const { score, stars } = rankCard(stats, row.element, scoring);
  return {
    id: row.id,
    name: row.name,
    artKey: row.artKey,
    stats,
    element: row.element,
    kind: row.kind,
    creatorId: row.creatorId,
    score,
    stars,
  };
}

/** Strongest first, then alphabetical. */
export function compareCards(a: CardSummary, b: CardSummary): number {
  return b.stars - a.stars || b.score - a.score || a.name.localeCompare(b.name);
}

function toStatValue(value: number): StatValue {
  // The database enforces this range with CHECK constraints; this guards the type boundary.
  if (!isStatValue(value)) throw new RangeError(`Invalid stat value in database: ${String(value)}`);
  return value;
}
