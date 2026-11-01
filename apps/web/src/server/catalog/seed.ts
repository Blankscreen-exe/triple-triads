import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/client';
import { cards, settings, starterDeckCards, starterDecks } from '../db/schema';
import { STARDUST_CRUSADERS_DECK_ID, STARTER_CARDS, STARTER_DECKS } from './starter-content';

/** Marks that the default content was inserted, so it is never inserted again. */
const SEEDED_FLAG = 'seed:starterContent';
/** Marks that an existing installation was offered the Stardust Crusaders deck. */
const STARDUST_FLAG = 'seed:stardustCrusaders';

/** The starter deck the Stardust Crusaders replaced. */
const ELEMENTALIST_DECK_ID = 'starter-elementalist';

const insertStarterCards = (tx: Pick<AppDatabase, 'insert'>) => {
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
};

const insertStarterDeckCards = (
  tx: Pick<AppDatabase, 'insert'>,
  deck: (typeof STARTER_DECKS)[number],
) => {
  tx.insert(starterDeckCards)
    .values(
      Object.entries(deck.cards).map(([cardId, quantity]) => ({
        starterDeckId: deck.id,
        cardId,
        quantity,
      })),
    )
    .run();
};

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

    insertStarterCards(tx);

    STARTER_DECKS.forEach((deck, sortOrder) => {
      tx.insert(starterDecks)
        .values({ id: deck.id, name: deck.name, isDefault: deck.isDefault, sortOrder })
        .run();
      insertStarterDeckCards(tx, deck);
    });
    markSeeded();
    return true;
  });
}

/**
 * Brings the Stardust Crusaders to installations seeded before they existed: adds their cards, and
 * swaps them in for the Elementalist starter deck, unless an admin has removed or renamed it. New
 * players get the new deck; decks players already have are theirs and stay as they are. Runs once.
 * Returns true if the deck was swapped.
 */
export function addStardustCrusaders(db: AppDatabase): boolean {
  return db.transaction((tx) => {
    if (
      tx.select({ key: settings.key }).from(settings).where(eq(settings.key, STARDUST_FLAG)).get()
    ) {
      return false;
    }
    tx.insert(settings)
      .values({ key: STARDUST_FLAG, value: { at: new Date().toISOString() } })
      .run();
    insertStarterCards(tx);

    const deck = STARTER_DECKS.find((starter) => starter.id === STARDUST_CRUSADERS_DECK_ID);
    const replaced = tx
      .select()
      .from(starterDecks)
      .where(eq(starterDecks.id, ELEMENTALIST_DECK_ID))
      .get();
    if (!deck || replaced?.name !== 'Elementalist') return false;

    tx.delete(starterDecks).where(eq(starterDecks.id, replaced.id)).run();
    tx.insert(starterDecks)
      .values({
        id: deck.id,
        name: deck.name,
        isDefault: replaced.isDefault,
        sortOrder: replaced.sortOrder,
      })
      .run();
    insertStarterDeckCards(tx, deck);
    return true;
  });
}
