import { describe, expect, it } from 'vitest';
import { DEFAULT_DECK_RULES, statKey, validateDeck, type DeckCard } from './deck';
import type { Element, StatValue } from './types';

type Sides = [StatValue, StatValue, StatValue, StatValue];

let counter = 0;
/** Stats that differ from every other call (unique bottom/left pair). */
function uniqueSides(): Sides {
  const n = counter++;
  return [1, 1, ((n % 9) + 1) as StatValue, ((Math.floor(n / 9) % 9) + 1) as StatValue];
}

function deckCard(
  stars = 1,
  element: Element | null = null,
  sides: Sides = uniqueSides(),
): DeckCard {
  const [top, right, bottom, left] = sides;
  return { stats: { top, right, bottom, left }, element, stars };
}

const validDeck = (): DeckCard[] => Array.from({ length: 20 }, () => deckCard());

describe('statKey', () => {
  it('combines the four sides in order and the element', () => {
    expect(statKey({ top: 10, right: 4, bottom: 6, left: 9 }, 'fire')).toBe('10-4-6-9-fire');
    expect(statKey({ top: 10, right: 4, bottom: 6, left: 9 }, null)).toBe('10-4-6-9-none');
  });
});

describe('validateDeck', () => {
  it('accepts a legal deck', () => {
    expect(validateDeck(validDeck())).toEqual([]);
  });

  it('requires exactly 20 cards', () => {
    expect(validateDeck(validDeck().slice(0, 19))).toEqual([
      { code: 'WRONG_SIZE', actual: 19, expected: 20 },
    ]);
  });

  it('limits copies by stats and element, whatever the card', () => {
    const deck = validDeck();
    for (let i = 0; i < 4; i++) deck[i] = deckCard(1, 'fire', [10, 4, 6, 9]);

    expect(validateDeck(deck)).toEqual([
      { code: 'TOO_MANY_COPIES', key: '10-4-6-9-fire', count: 4, max: 3 },
    ]);
  });

  it('treats a different element or a rotation as a different card', () => {
    const deck = validDeck();
    deck[0] = deckCard(1, 'fire', [10, 4, 6, 9]);
    deck[1] = deckCard(1, 'fire', [10, 4, 6, 9]);
    deck[2] = deckCard(1, 'fire', [10, 4, 6, 9]);
    deck[3] = deckCard(1, 'ice', [10, 4, 6, 9]);
    deck[4] = deckCard(1, 'fire', [9, 10, 4, 6]);

    expect(validateDeck(deck)).toEqual([]);
  });

  it('enforces the star caps', () => {
    const deck = validDeck();
    deck[0] = deckCard(5);
    deck[1] = deckCard(5);
    for (let i = 2; i < 6; i++) deck[i] = deckCard(4);

    expect(validateDeck(deck)).toEqual([
      { code: 'STAR_CAP_EXCEEDED', stars: 4, count: 4, max: 3 },
      { code: 'STAR_CAP_EXCEEDED', stars: 5, count: 2, max: 1 },
    ]);
  });

  it('reports every violation at once', () => {
    const deck = [deckCard(5), deckCard(5)];

    expect(validateDeck(deck).map((violation) => violation.code)).toEqual([
      'WRONG_SIZE',
      'STAR_CAP_EXCEEDED',
    ]);
  });

  it('uses custom rules', () => {
    expect(validateDeck(validDeck().slice(0, 10), { ...DEFAULT_DECK_RULES, size: 10 })).toEqual([]);
  });
});
