import { rankCard, statKey, validateDeck } from '@triple-triad/engine';
import { describe, expect, it } from 'vitest';
import { STARTER_CARDS, STARTER_DECKS, type StarterCard } from './starter-content';

const cardsById = new Map(STARTER_CARDS.map((card) => [card.id, card]));

const rank = ({ stats: [top, right, bottom, left], element }: StarterCard) =>
  rankCard({ top, right, bottom, left }, element);

describe('starter content', () => {
  it('has unique card ids, names and stat keys', () => {
    const keys = STARTER_CARDS.map(({ stats: [top, right, bottom, left], element }) =>
      statKey({ top, right, bottom, left }, element),
    );

    expect(cardsById.size).toBe(STARTER_CARDS.length);
    expect(new Set(STARTER_CARDS.map((card) => card.name)).size).toBe(STARTER_CARDS.length);
    expect(new Set(keys).size).toBe(STARTER_CARDS.length);
  });

  it('only has cards the card maker would allow', () => {
    for (const card of STARTER_CARDS) expect(rank(card).allowed, card.name).toBe(true);
  });

  it('marks exactly one starter deck as the default', () => {
    expect(STARTER_DECKS.filter((deck) => deck.isDefault)).toHaveLength(1);
  });

  it.each(STARTER_DECKS.map((deck) => [deck.name, deck] as const))(
    'the %s deck follows the deck rules',
    (_, deck) => {
      const deckCards = Object.entries(deck.cards).flatMap(([id, quantity]) => {
        const card = cardsById.get(id);
        if (!card) throw new Error(`Unknown card ${id} in ${deck.name}`);
        const [top, right, bottom, left] = card.stats;
        const stats = { top, right, bottom, left };
        return Array.from({ length: quantity }, () => ({
          stats,
          element: card.element,
          stars: rank(card).stars,
        }));
      });

      expect(validateDeck(deckCards)).toEqual([]);
    },
  );
});
