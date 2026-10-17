/**
 * Player-made cards (design/SPEC.md, sections 4.3 and 6). The creator owns unlimited copies.
 */
import { randomUUID } from 'node:crypto';
import { DEFAULT_SCORING, rankCard, type ScoringConfig } from '@triple-triad/engine';
import { and, count, eq } from 'drizzle-orm';
import type { CardInput } from '@/lib/validation/card';
import type { AppDatabase } from '../db/client';
import { cards } from '../db/schema';
import type { FileStorage } from '../storage/storage';
import { processCardArt, type CardArtError } from './card-art';

/** Upper bound on custom cards per player, to keep one account from filling the disk. */
export const MAX_CUSTOM_CARDS_PER_PLAYER = 200;

export type CustomCardError = 'TOO_STRONG' | 'CARD_LIMIT' | CardArtError;

export type CreateCardResult =
  | { readonly ok: true; readonly cardId: string }
  | { readonly ok: false; readonly error: CustomCardError };

export async function createCustomCard(
  db: AppDatabase,
  storage: FileStorage,
  creatorId: string,
  input: CardInput,
  art: Buffer | null,
  scoring: ScoringConfig = DEFAULT_SCORING,
): Promise<CreateCardResult> {
  if (!rankCard(input.stats, input.element, scoring).allowed) {
    return { ok: false, error: 'TOO_STRONG' };
  }

  const owned = db
    .select({ total: count() })
    .from(cards)
    .where(and(eq(cards.kind, 'custom'), eq(cards.creatorId, creatorId)))
    .get();
  if ((owned?.total ?? 0) >= MAX_CUSTOM_CARDS_PER_PLAYER) return { ok: false, error: 'CARD_LIMIT' };

  const cardId = randomUUID();
  let artKey: string | null = null;
  if (art) {
    const processed = await processCardArt(art);
    if (!processed.ok) return processed;
    artKey = `cards/${cardId}/${processed.art.hash}`;
    await storage.put(`${artKey}-full.webp`, processed.art.full, 'image/webp');
    await storage.put(`${artKey}-card.webp`, processed.art.card, 'image/webp');
  }

  try {
    db.insert(cards)
      .values({
        id: cardId,
        name: input.name,
        artKey,
        ...input.stats,
        element: input.element,
        kind: 'custom',
        creatorId,
      })
      .run();
  } catch (error) {
    // Do not leave orphaned files behind if the row could not be written.
    if (artKey) await storage.deletePrefix(`cards/${cardId}`);
    throw error;
  }
  return { ok: true, cardId };
}

/**
 * Deletes one of the player's own custom cards and its art. Decks that contained it lose those
 * copies (and show as incomplete). Returns false if the card is not theirs to delete.
 */
export async function deleteCustomCard(
  db: AppDatabase,
  storage: FileStorage,
  userId: string,
  cardId: string,
): Promise<boolean> {
  const removed = db
    .delete(cards)
    .where(and(eq(cards.id, cardId), eq(cards.kind, 'custom'), eq(cards.creatorId, userId)))
    .run();
  if (removed.changes === 0) return false;
  await storage.deletePrefix(`cards/${cardId}`);
  return true;
}
