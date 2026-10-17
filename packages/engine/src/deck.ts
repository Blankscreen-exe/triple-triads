/**
 * Deck-building rules (design/SPEC.md, section 5).
 */
import { SIDES, type Element, type Stats } from './types';

export interface DeckRules {
  /** Exact number of cards in a deck. */
  readonly size: number;
  /** Maximum cards sharing one stat key (see {@link statKey}). */
  readonly maxCopies: number;
  /** Maximum cards per star rank; ranks not listed are unlimited. */
  readonly starCaps: Readonly<Partial<Record<number, number>>>;
}

export const DEFAULT_DECK_RULES: DeckRules = {
  size: 20,
  maxCopies: 3,
  starCaps: { 5: 1, 4: 3, 3: 6 },
};

export interface DeckCard {
  readonly stats: Stats;
  readonly element: Element | null;
  readonly stars: number;
}

export type DeckViolation =
  | { readonly code: 'WRONG_SIZE'; readonly actual: number; readonly expected: number }
  | {
      readonly code: 'TOO_MANY_COPIES';
      readonly key: string;
      readonly count: number;
      readonly max: number;
    }
  | {
      readonly code: 'STAR_CAP_EXCEEDED';
      readonly stars: number;
      readonly count: number;
      readonly max: number;
    };

/**
 * Cards with the same stat key count as copies of each other, whatever their name, art or
 * creator: the exact top/right/bottom/left values plus the element.
 */
export function statKey(stats: Stats, element: Element | null): string {
  return [...SIDES.map((side) => stats[side]), element ?? 'none'].join('-');
}

/** Returns every rule the deck breaks; an empty array means the deck is valid. */
export function validateDeck(
  cards: readonly DeckCard[],
  rules: DeckRules = DEFAULT_DECK_RULES,
): DeckViolation[] {
  const violations: DeckViolation[] = [];

  if (cards.length !== rules.size) {
    violations.push({ code: 'WRONG_SIZE', actual: cards.length, expected: rules.size });
  }

  for (const [key, count] of countBy(cards, (card) => statKey(card.stats, card.element))) {
    if (count > rules.maxCopies) {
      violations.push({ code: 'TOO_MANY_COPIES', key, count, max: rules.maxCopies });
    }
  }

  const starCounts = countBy(cards, (card) => card.stars);
  for (const [stars, max] of Object.entries(rules.starCaps)) {
    const count = starCounts.get(Number(stars)) ?? 0;
    if (max !== undefined && count > max) {
      violations.push({ code: 'STAR_CAP_EXCEEDED', stars: Number(stars), count, max });
    }
  }

  return violations;
}

function countBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, number> {
  const counts = new Map<K, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
