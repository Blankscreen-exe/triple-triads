import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/client';
import { cards, settings, starterDeckCards, starterDecks } from '../db/schema';
import { STARTER_CARDS, STARTER_DECKS } from './starter-content';

/** Marks that the default content was inserted, so it is never inserted again. */
const SEEDED_FLAG = 'seed:starterContent';

/**
 * Inserts the default generic cards and starter decks on a fresh installation. Runs once:
 * afterwards admins own the catalogue, and deleting every starter deck must not bring the
 * defaults back. Returns true if anything was inserted. Safe to call on every startup.
 */
export function seedStarterContent(db: AppDatabase): boolean {
  return db.transaction((tx) => {
    if (
      tx.select({ key: settings.key }).from(settings).where(eq(settings.key, SEEDED_FLAG)).get()
    ) {
      return false;
    }
    const markSeeded = () => {
      tx.insert(settings)
        .values({ key: SEEDED_FLAG, value: { at: new Date().toISOString() } })
        .run();
    };
    // Installations seeded before this flag existed already have starter decks.
    if (tx.select({ id: starterDecks.id }).from(starterDecks).limit(1).get()) {
      markSeeded();
      return false;
    }

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
    markSeeded();
    return true;
  });
}
