/**
 * Moderation of player-made content (design/SPEC.md, section 11).
 */
import { count, desc, eq, sql } from 'drizzle-orm';
import { loadPage, type Page, type PageRequest } from '@/lib/pagination';
import { toCardSummary, type CardSummary } from '../cards/cards';
import type { AppDatabase } from '../db/client';
import { cards, users } from '../db/schema';
import { getGameSettings } from '../settings/settings';
import type { FileStorage } from '../storage/storage';

export interface ModeratedCard {
  readonly card: CardSummary;
  readonly creator: string;
  readonly createdAt: Date;
}

/** One page of every custom card, newest first, with its creator. */
export function listCustomCards(
  db: AppDatabase,
  { page, pageSize }: PageRequest,
): Page<ModeratedCard> {
  const { scoring } = getGameSettings(db);
  const total =
    db
      .select({ total: count() })
      .from(cards)
      .innerJoin(users, eq(cards.creatorId, users.id))
      .where(eq(cards.kind, 'custom'))
      .get()?.total ?? 0;
  return loadPage(total, page, pageSize, (offset, limit) =>
    db
      .select({ card: cards, creator: users.username })
      .from(cards)
      .innerJoin(users, eq(cards.creatorId, users.id))
      .where(eq(cards.kind, 'custom'))
      // rowid breaks ties between cards made in the same millisecond, so pages never overlap.
      .orderBy(desc(cards.createdAt), desc(sql`${cards}.rowid`))
      .limit(limit)
      .offset(offset)
      .all()
      .map(({ card, creator }) => ({
        card: toCardSummary(card, scoring),
        creator,
        createdAt: card.createdAt,
      })),
  );
}

/** Removes any player's custom card and its art. Returns false if there is no such card. */
export async function removeCustomCard(
  db: AppDatabase,
  storage: FileStorage,
  cardId: string,
): Promise<boolean> {
  const card = db.select({ kind: cards.kind }).from(cards).where(eq(cards.id, cardId)).get();
  if (card?.kind !== 'custom') return false;
  db.delete(cards).where(eq(cards.id, cardId)).run();
  await storage.deleteFolder(`cards/${cardId}`);
  return true;
}
