/**
 * Creating, renaming, saving and deleting a player's decks (design/SPEC.md, section 5).
 *
 * Saving checks ownership (enough copies in the trunk; unlimited for the player's own custom
 * cards) and the deck size limit. Other deck rules (copy limit, star caps) are reported by
 * `listDecks` instead of blocking the save, so players can keep work in progress; a deck that
 * breaks them cannot be taken into a game.
 */
import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import type { DeckContents } from '@/lib/validation/deck';
import type { AppDatabase } from '../db/client';
import { deckCards, decks, users } from '../db/schema';
import { getGameSettings } from '../settings/settings';
import { listTrunk } from '../trunk/trunk';

export const MAX_DECKS_PER_PLAYER = 30;

export type DeckEditError =
  'DECK_NOT_FOUND' | 'DECK_LIMIT' | 'TOO_MANY_CARDS' | 'NOT_ENOUGH_COPIES';

export type DeckEditResult<T = null> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: DeckEditError; readonly cardId?: string };

export function createDeck(
  db: AppDatabase,
  userId: string,
  name: string,
): DeckEditResult<{ deckId: string }> {
  const owned = db.select({ total: count() }).from(decks).where(eq(decks.userId, userId)).get();
  if ((owned?.total ?? 0) >= MAX_DECKS_PER_PLAYER) return { ok: false, error: 'DECK_LIMIT' };

  const deckId = randomUUID();
  db.insert(decks).values({ id: deckId, userId, name }).run();
  return { ok: true, data: { deckId } };
}

export function saveDeck(
  db: AppDatabase,
  userId: string,
  deckId: string,
  { name, entries }: DeckContents,
): DeckEditResult {
  if (!ownsDeck(db, userId, deckId)) return { ok: false, error: 'DECK_NOT_FOUND' };

  const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  if (total > getGameSettings(db).deckRules.size) return { ok: false, error: 'TOO_MANY_CARDS' };

  const available = new Map(listTrunk(db, userId).map((entry) => [entry.card.id, entry.quantity]));
  for (const { cardId, quantity } of entries) {
    const owned = available.get(cardId);
    if (owned === undefined || (owned !== 'unlimited' && quantity > owned)) {
      return { ok: false, error: 'NOT_ENOUGH_COPIES', cardId };
    }
  }

  db.transaction((tx) => {
    tx.delete(deckCards).where(eq(deckCards.deckId, deckId)).run();
    if (entries.length > 0) {
      tx.insert(deckCards)
        .values(entries.map(({ cardId, quantity }) => ({ deckId, cardId, quantity })))
        .run();
    }
    tx.update(decks).set({ name, updatedAt: new Date() }).where(eq(decks.id, deckId)).run();
  });
  return { ok: true, data: null };
}

/**
 * Deletes a deck. If it was the active deck, the player's oldest remaining deck becomes active.
 */
export function deleteDeck(db: AppDatabase, userId: string, deckId: string): DeckEditResult {
  if (!ownsDeck(db, userId, deckId)) return { ok: false, error: 'DECK_NOT_FOUND' };

  db.transaction((tx) => {
    const user = tx
      .select({ activeDeckId: users.activeDeckId })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    tx.delete(decks).where(eq(decks.id, deckId)).run();
    if (user?.activeDeckId === deckId) {
      const next = tx
        .select({ id: decks.id })
        .from(decks)
        .where(and(eq(decks.userId, userId), ne(decks.id, deckId)))
        .orderBy(asc(decks.createdAt), sql`rowid`)
        .get();
      tx.update(users)
        .set({ activeDeckId: next?.id ?? null })
        .where(eq(users.id, userId))
        .run();
    }
  });
  return { ok: true, data: null };
}

function ownsDeck(db: AppDatabase, userId: string, deckId: string): boolean {
  return (
    db
      .select({ id: decks.id })
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
      .get() !== undefined
  );
}
