/**
 * Starter decks, managed by admins. New players receive a copy of each (see `grantStarterDecks`);
 * changing them later does not affect existing players.
 */
import { randomUUID } from 'node:crypto';
import { validateDeck, type DeckViolation } from '@triple-triad/engine';
import { asc, count, eq, inArray, ne } from 'drizzle-orm';
import type { DeckContents } from '@/lib/validation/deck';
import { compareCards, toCardSummary } from '../cards/cards';
import type { AppDatabase } from '../db/client';
import { cards, starterDeckCards, starterDecks } from '../db/schema';
import type { DeckEntry } from '../decks/decks';
import { getGameSettings } from '../settings/settings';

export interface StarterDeckSummary {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly entries: readonly DeckEntry[];
  readonly size: number;
  readonly violations: readonly DeckViolation[];
}

export type StarterDeckError = 'DECK_NOT_FOUND' | 'TOO_MANY_CARDS' | 'NOT_A_GENERIC_CARD';

export type StarterDeckResult<T = null> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: StarterDeckError };

export function listStarterDecks(db: AppDatabase): StarterDeckSummary[] {
  const { scoring, deckRules } = getGameSettings(db);
  const decks = db
    .select()
    .from(starterDecks)
    .orderBy(asc(starterDecks.sortOrder), asc(starterDecks.createdAt))
    .all();
  const rows = db
    .select({
      deckId: starterDeckCards.starterDeckId,
      quantity: starterDeckCards.quantity,
      card: cards,
    })
    .from(starterDeckCards)
    .innerJoin(cards, eq(starterDeckCards.cardId, cards.id))
    .all();

  return decks.map((deck) => {
    const entries = rows
      .filter((row) => row.deckId === deck.id)
      .map((row) => ({ card: toCardSummary(row.card, scoring), quantity: row.quantity }))
      .sort((a, b) => compareCards(a.card, b.card));
    return {
      id: deck.id,
      name: deck.name,
      isDefault: deck.isDefault,
      entries,
      size: entries.reduce((total, entry) => total + entry.quantity, 0),
      violations: validateDeck(
        entries.flatMap(({ card, quantity }) =>
          Array.from({ length: quantity }, () => ({
            stats: card.stats,
            element: card.element,
            stars: card.stars,
          })),
        ),
        deckRules,
      ),
    };
  });
}

/** Creates an empty starter deck. The first one becomes the default. */
export function createStarterDeck(
  db: AppDatabase,
  name: string,
): StarterDeckResult<{ deckId: string }> {
  return db.transaction((tx) => {
    const existing = tx.select({ total: count() }).from(starterDecks).get()?.total ?? 0;
    const deckId = `starter-${randomUUID()}`;
    tx.insert(starterDecks)
      .values({ id: deckId, name, isDefault: existing === 0, sortOrder: existing })
      .run();
    return { ok: true, data: { deckId } };
  });
}

/** Replaces a starter deck's name and contents. Only generic cards are allowed. */
export function saveStarterDeck(
  db: AppDatabase,
  deckId: string,
  { name, entries }: DeckContents,
): StarterDeckResult {
  if (!findDeck(db, deckId)) return { ok: false, error: 'DECK_NOT_FOUND' };
  const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  if (total > getGameSettings(db).deckRules.size) return { ok: false, error: 'TOO_MANY_CARDS' };

  const ids = entries.map((entry) => entry.cardId);
  const kinds = new Map(
    ids.length === 0
      ? []
      : db
          .select({ id: cards.id, kind: cards.kind })
          .from(cards)
          .where(inArray(cards.id, ids))
          .all()
          .map((row) => [row.id, row.kind]),
  );
  if (ids.some((id) => kinds.get(id) !== 'generic')) {
    return { ok: false, error: 'NOT_A_GENERIC_CARD' };
  }

  db.transaction((tx) => {
    tx.delete(starterDeckCards).where(eq(starterDeckCards.starterDeckId, deckId)).run();
    if (entries.length > 0) {
      tx.insert(starterDeckCards)
        .values(
          entries.map(({ cardId, quantity }) => ({ starterDeckId: deckId, cardId, quantity })),
        )
        .run();
    }
    tx.update(starterDecks).set({ name }).where(eq(starterDecks.id, deckId)).run();
  });
  return { ok: true, data: null };
}

/** Makes `deckId` the deck pre-selected for new players. */
export function setDefaultStarterDeck(db: AppDatabase, deckId: string): StarterDeckResult {
  if (!findDeck(db, deckId)) return { ok: false, error: 'DECK_NOT_FOUND' };
  db.transaction((tx) => {
    // Clear first: the unique index allows only one default at a time.
    tx.update(starterDecks).set({ isDefault: false }).run();
    tx.update(starterDecks).set({ isDefault: true }).where(eq(starterDecks.id, deckId)).run();
  });
  return { ok: true, data: null };
}

/** Deletes a starter deck; if it was the default, the first remaining deck becomes the default. */
export function deleteStarterDeck(db: AppDatabase, deckId: string): StarterDeckResult {
  const deck = findDeck(db, deckId);
  if (!deck) return { ok: false, error: 'DECK_NOT_FOUND' };
  db.transaction((tx) => {
    tx.delete(starterDecks).where(eq(starterDecks.id, deckId)).run();
    if (deck.isDefault) {
      const next = tx
        .select({ id: starterDecks.id })
        .from(starterDecks)
        .where(ne(starterDecks.id, deckId))
        .orderBy(asc(starterDecks.sortOrder))
        .get();
      if (next) {
        tx.update(starterDecks).set({ isDefault: true }).where(eq(starterDecks.id, next.id)).run();
      }
    }
  });
  return { ok: true, data: null };
}

function findDeck(db: AppDatabase, deckId: string) {
  return db
    .select({ id: starterDecks.id, isDefault: starterDecks.isDefault })
    .from(starterDecks)
    .where(eq(starterDecks.id, deckId))
    .get();
}
