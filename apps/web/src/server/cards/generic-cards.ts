/**
 * Generic cards, managed by admins (design/SPEC.md, section 11). They make up the starter decks.
 */
import { randomUUID } from 'node:crypto';
import { rankCard } from '@triple-triad/engine';
import { and, eq } from 'drizzle-orm';
import type { CardInput } from '@/lib/validation/card';
import type { AppDatabase } from '../db/client';
import { cards, starterDeckCards } from '../db/schema';
import { getGameSettings } from '../settings/settings';
import type { FileStorage } from '../storage/storage';
import { deleteCardArt, storeCardArt, type CardArtError } from './card-art';
import { compareCards, toCardSummary, type CardSummary } from './cards';

export type GenericCardError = 'TOO_STRONG' | 'CARD_NOT_FOUND' | 'IN_STARTER_DECK' | CardArtError;

export type GenericCardResult<T = null> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: GenericCardError };

export function listGenericCards(db: AppDatabase): CardSummary[] {
  const { scoring } = getGameSettings(db);
  return db
    .select()
    .from(cards)
    .where(eq(cards.kind, 'generic'))
    .all()
    .map((row) => toCardSummary(row, scoring))
    .sort(compareCards);
}

export function getGenericCard(db: AppDatabase, cardId: string): CardSummary | null {
  const row = db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.kind, 'generic')))
    .get();
  return row ? toCardSummary(row, getGameSettings(db).scoring) : null;
}

/**
 * Creates a generic card (`cardId` null) or updates one. New art replaces the old art; the old
 * files are deleted only after the card points at the new ones.
 */
export async function saveGenericCard(
  db: AppDatabase,
  storage: FileStorage,
  cardId: string | null,
  input: CardInput,
  art: Buffer | null,
): Promise<GenericCardResult<{ cardId: string }>> {
  if (!rankCard(input.stats, input.element, getGameSettings(db).scoring).allowed) {
    return { ok: false, error: 'TOO_STRONG' };
  }
  const existing = cardId === null ? null : getGenericCard(db, cardId);
  if (cardId !== null && !existing) return { ok: false, error: 'CARD_NOT_FOUND' };

  const id = cardId ?? `generic-${randomUUID()}`;
  let artKey = existing?.artKey ?? null;
  if (art) {
    const stored = await storeCardArt(storage, id, art);
    if (!stored.ok) return stored;
    artKey = stored.artKey;
  }

  const values = { name: input.name, artKey, ...input.stats, element: input.element };
  if (existing) {
    db.update(cards).set(values).where(eq(cards.id, id)).run();
  } else {
    db.insert(cards)
      .values({ id, ...values, kind: 'generic' })
      .run();
  }

  if (existing?.artKey && existing.artKey !== artKey) await deleteCardArt(storage, existing.artKey);
  return { ok: true, data: { cardId: id } };
}

/**
 * Deletes a generic card. Cards used by a starter deck must be removed from it first. Players
 * lose the card from their trunks and decks.
 */
export async function deleteGenericCard(
  db: AppDatabase,
  storage: FileStorage,
  cardId: string,
): Promise<GenericCardResult> {
  const card = getGenericCard(db, cardId);
  if (!card) return { ok: false, error: 'CARD_NOT_FOUND' };
  const inStarterDeck = db
    .select({ id: starterDeckCards.starterDeckId })
    .from(starterDeckCards)
    .where(eq(starterDeckCards.cardId, cardId))
    .get();
  if (inStarterDeck) return { ok: false, error: 'IN_STARTER_DECK' };

  db.delete(cards).where(eq(cards.id, cardId)).run();
  await storage.deleteFolder(`cards/${cardId}`);
  return { ok: true, data: null };
}
