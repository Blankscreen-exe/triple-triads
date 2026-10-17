import type { AppDatabase } from '../db/client';
import { cards, starterDeckCards, starterDecks } from '../db/schema';
import { STARTER_CARDS, STARTER_DECKS } from './starter-content';

/**
 * Inserts the default generic cards and starter decks if no starter decks exist yet.
 * Returns true if anything was inserted. Safe to call on every startup.
 */
export function seedStarterContent(db: AppDatabase): boolean {
  return db.transaction((tx) => {
    if (tx.select({ id: starterDecks.id }).from(starterDecks).limit(1).get()) return false;

    tx.insert(cards)
      .values(
        STARTER_CARDS.map(({ id, name, stats: [top, right, bottom, left], element }) => ({
          id,
          name,
          top,
          right,
          bottom,
          left,
          element,
          kind: 'generic' as const,
        })),
      )
      .onConflictDoNothing()
      .run();

    STARTER_DECKS.forEach((deck, sortOrder) => {
      tx.insert(starterDecks)
        .values({ id: deck.id, name: deck.name, isDefault: deck.isDefault, sortOrder })
        .run();
      tx.insert(starterDeckCards)
        .values(
          Object.entries(deck.cards).map(([cardId, quantity]) => ({
            starterDeckId: deck.id,
            cardId,
            quantity,
          })),
        )
        .run();
    });
    return true;
  });
}
