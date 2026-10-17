/**
 * Player rating (design/SPEC.md, section 10): Elo, shown as named tiers with divisions.
 */

export const STARTING_RATING = 1000;
/** How far one game can move a rating. 32 suits a small, casual player base. */
export const K_FACTOR = 32;

/** Probability that a player rated `rating` beats one rated `opponent`, by the Elo formula. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/**
 * Points the winner gains and the loser loses. Zero-sum and always at least 1, so a win is never
 * worthless even against a much weaker opponent.
 */
export function ratingChange(winnerRating: number, loserRating: number): number {
  return Math.max(1, Math.round(K_FACTOR * (1 - expectedScore(winnerRating, loserRating))));
}

export const TIERS = [
  { name: 'Bronze', min: -Infinity },
  { name: 'Silver', min: 1100 },
  { name: 'Gold', min: 1300 },
  { name: 'Platinum', min: 1500 },
  { name: 'Diamond', min: 1700 },
] as const;

export type TierName = (typeof TIERS)[number]['name'];
export type Division = 'III' | 'II' | 'I';

export interface Tier {
  readonly name: TierName;
  /** Null for Diamond, which has no divisions. */
  readonly division: Division | null;
  readonly label: string;
}

/** Each tier below Diamond spans 200 points, split evenly into divisions III, II and I. */
const TIER_SPAN = 200;
const DIVISIONS: readonly Division[] = ['III', 'II', 'I'];

export function tierFor(rating: number): Tier {
  const index = Math.max(
    0,
    TIERS.findLastIndex((tier) => rating >= tier.min),
  );
  const tier = TIERS[index] ?? TIERS[0];
  if (tier.name === 'Diamond') return { name: tier.name, division: null, label: tier.name };

  // Bronze has no lower bound: its divisions are counted from 200 below Silver.
  const floor = Number.isFinite(tier.min) ? tier.min : TIERS[1].min - TIER_SPAN;
  const step = TIER_SPAN / DIVISIONS.length;
  const position = Math.min(DIVISIONS.length - 1, Math.max(0, Math.floor((rating - floor) / step)));
  const division = DIVISIONS[position] ?? 'III';
  return { name: tier.name, division, label: `${tier.name} ${division}` };
}

/** Positive for a win streak, negative for a loss streak. */
export function formatStreak(streak: number): string {
  if (streak === 0) return '—';
  return streak > 0 ? `W${String(streak)}` : `L${String(-streak)}`;
}
