/**
 * Card ranking (design/SPEC.md, section 4.2).
 *
 * Every stat value has a score; a card's score is the sum of its four stat scores plus a bonus if
 * it has an element. Stars = round(score / 100), shown as 1 to `maxStars`. Cards that would round
 * above `maxStars` are not allowed. The table is configurable from the admin panel.
 */
import { SIDES, type Element, type StatValue, type Stats } from './types';

export interface ScoringConfig {
  readonly statScores: Readonly<Record<StatValue, number>>;
  readonly elementBonus: number;
  readonly maxStars: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  statScores: { 1: 8, 2: 15, 3: 25, 4: 38, 5: 54, 6: 73, 7: 95, 8: 120, 9: 150, 10: 190 },
  elementBonus: 10,
  maxStars: 5,
};

const POINTS_PER_STAR = 100;
const MIN_STARS = 1;

export interface CardRank {
  readonly score: number;
  /** Displayed star count, clamped to [1, maxStars]. */
  readonly stars: number;
  /** False when the card is too strong to be saved (it would round above `maxStars`). */
  readonly allowed: boolean;
}

export function rankCard(
  stats: Stats,
  element: Element | null,
  config: ScoringConfig = DEFAULT_SCORING,
): CardRank {
  const statTotal = SIDES.reduce((total, side) => total + config.statScores[stats[side]], 0);
  const score = statTotal + (element === null ? 0 : config.elementBonus);
  const rounded = Math.round(score / POINTS_PER_STAR);
  return {
    score,
    stars: Math.min(config.maxStars, Math.max(MIN_STARS, rounded)),
    allowed: rounded <= config.maxStars,
  };
}
