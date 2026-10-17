/**
 * A player's trunk: every card they can put in a deck.
 */
import { and, eq } from 'drizzle-orm';
import { compareCards, toCardSummary, type CardSummary } from '../cards/cards';
import type { DbExecutor } from '../db/client';
import { cards, trunkCards } from '../db/schema';
import { getGameSettings } from '../settings/settings';

/** Creators have unlimited copies of their own custom cards. */
export type TrunkQuantity = number | 'unlimited';

export interface TrunkEntry {
  readonly card: CardSummary;
  readonly quantity: TrunkQuantity;
}

export function listTrunk(db: DbExecutor, userId: string): TrunkEntry[] {
  const { scoring } = getGameSettings(db);
  const owned = db
    .select({ card: cards, quantity: trunkCards.quantity })
    .from(trunkCards)
    .innerJoin(cards, eq(trunkCards.cardId, cards.id))
    .where(eq(trunkCards.userId, userId))
    .all()
    .map(({ card, quantity }): TrunkEntry => ({ card: toCardSummary(card, scoring), quantity }));

  const created = db
    .select()
    .from(cards)
    .where(and(eq(cards.kind, 'custom'), eq(cards.creatorId, userId)))
    .all()
    .map((card): TrunkEntry => ({ card: toCardSummary(card, scoring), quantity: 'unlimited' }));

  return [...owned, ...created].sort((a, b) => compareCards(a.card, b.card));
}
