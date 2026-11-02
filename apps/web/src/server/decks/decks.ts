/**
 * Player decks: granting starter decks, listing decks and choosing the active deck.
 */
import { randomUUID } from 'node:crypto';
import { validateDeck, type DeckCard, type DeckViolation } from '@triple-triad/engine';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { compareCards, toCardSummary, type CardSummary } from '../cards/cards';
import type { DbExecutor } from '../db/client';
import {
  cards,
  deckCards,
  decks,
  starterDeckCards,
  starterDeckGrants,
  starterDecks,
  trunkCards,
  users,
} from '../db/schema';
import { getGameSettings } from '../settings/settings';

export interface DeckEntry {
  readonly card: CardSummary;
  readonly quantity: number;
}

export interface DeckSummary {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  /** When the deck's name or cards last changed. */
  readonly updatedAt: Date;
  readonly entries: readonly DeckEntry[];
  readonly size: number;
  /** Deck-building rules the deck breaks; empty when it can be used in a game. */
  readonly violations: readonly DeckViolation[];
}

interface StarterContents {
  readonly cardId: string;
  readonly quantity: number;
}

/**
 * Gives a player a copy of a starter deck, adds its cards to their trunk and records that they
 * received it. Returns the id of the player's copy.
 */
export function copyStarterDeck(
  tx: DbExecutor,
  userId: string,
  starter: { readonly id: string; readonly name: string },
  contents: readonly StarterContents[],
): string {
  const deckId = randomUUID();
  tx.insert(decks).values({ id: deckId, userId, name: starter.name }).run();
  if (contents.length > 0) {
    tx.insert(deckCards)
      .values(contents.map(({ cardId, quantity }) => ({ deckId, cardId, quantity })))
      .run();
    tx.insert(trunkCards)
      .values(contents.map(({ cardId, quantity }) => ({ userId, cardId, quantity })))
      .onConflictDoUpdate({
        target: [trunkCards.userId, trunkCards.cardId],
        set: { quantity: sql`${trunkCards.quantity} + excluded.quantity` },
      })
      .run();
  }
  tx.insert(starterDeckGrants).values({ starterDeckId: starter.id, userId }).run();
  return deckId;
}

/**
 * Gives a new player a copy of every starter deck and adds their cards to the player's trunk.
 * Returns the id of the player's copy of the default starter deck (or of the first one if none
 * is marked default), or null if no starter decks exist.
 */
export function grantStarterDecks(tx: DbExecutor, userId: string): string | null {
  const starters = tx.select().from(starterDecks).orderBy(asc(starterDecks.sortOrder)).all();
  if (starters.length === 0) return null;

  const starterCards = tx
    .select()
    .from(starterDeckCards)
    .where(
      inArray(
        starterDeckCards.starterDeckId,
        starters.map((starter) => starter.id),
      ),
    )
    .all();

  let activeDeckId: string | null = null;
  for (const starter of starters) {
    const contents = starterCards.filter((entry) => entry.starterDeckId === starter.id);
    const deckId = copyStarterDeck(tx, userId, starter, contents);
    if (starter.isDefault || activeDeckId === null) activeDeckId = deckId;
  }
  return activeDeckId;
}

export function listDecks(db: DbExecutor, userId: string): DeckSummary[] {
  const { scoring, deckRules } = getGameSettings(db);
  const user = db
    .select({ activeDeckId: users.activeDeckId })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  const ownDecks = db
    .select()
    .from(decks)
    .where(eq(decks.userId, userId))
    // rowid (insertion order) breaks ties between decks created in the same millisecond.
    .orderBy(asc(decks.createdAt), sql`rowid`)
    .all();
  if (ownDecks.length === 0) return [];

  const rows = db
    .select({ deckId: deckCards.deckId, quantity: deckCards.quantity, card: cards })
    .from(deckCards)
    .innerJoin(cards, eq(deckCards.cardId, cards.id))
    .where(
      inArray(
        deckCards.deckId,
        ownDecks.map((deck) => deck.id),
      ),
    )
    .all();

  return ownDecks.map((deck) => {
    const entries = rows
      .filter((row) => row.deckId === deck.id)
      .map((row) => ({ card: toCardSummary(row.card, scoring), quantity: row.quantity }))
      .sort((a, b) => compareCards(a.card, b.card));
    return {
      id: deck.id,
      name: deck.name,
      isActive: deck.id === user?.activeDeckId,
      updatedAt: deck.updatedAt,
      entries,
      size: entries.reduce((total, entry) => total + entry.quantity, 0),
      violations: validateDeck(expandEntries(entries), deckRules),
    };
  });
}

/** Makes `deckId` the player's active deck. Returns false if the deck does not belong to them. */
export function setActiveDeck(db: DbExecutor, userId: string, deckId: string): boolean {
  const owned = db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .get();
  if (!owned) return false;

  db.update(users).set({ activeDeckId: deckId }).where(eq(users.id, userId)).run();
  return true;
}

function expandEntries(entries: readonly DeckEntry[]): DeckCard[] {
  return entries.flatMap(({ card, quantity }) =>
    Array.from({ length: quantity }, () => ({
      stats: card.stats,
      element: card.element,
      stars: card.stars,
    })),
  );
}
