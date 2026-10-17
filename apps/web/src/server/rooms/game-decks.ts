/**
 * Loading a player's active deck for a game.
 */
import type { CardDefinition } from '@triple-triad/engine';
import { cardArtUrl } from '@/lib/media';
import type { CardInfo } from '@/lib/realtime/protocol';
import type { DbExecutor } from '../db/client';
import { listDecks } from '../decks/decks';
import type { GameDeck } from './model';

export type DeckLoadResult =
  | { readonly ok: true; readonly deck: GameDeck }
  | { readonly ok: false; readonly error: 'NO_ACTIVE_DECK' | 'INVALID_DECK' };

export interface DeckProvider {
  loadActiveDeck(userId: string): DeckLoadResult;
}

export function createDatabaseDeckProvider(db: DbExecutor): DeckProvider {
  return {
    loadActiveDeck(userId) {
      const deck = listDecks(db, userId).find((candidate) => candidate.isActive);
      if (!deck) return { ok: false, error: 'NO_ACTIVE_DECK' };
      if (deck.violations.length > 0) return { ok: false, error: 'INVALID_DECK' };

      const cards: CardDefinition[] = [];
      const faces = new Map<string, CardInfo>();
      for (const { card, quantity } of deck.entries) {
        const definition = { id: card.id, stats: card.stats, element: card.element };
        for (let copy = 0; copy < quantity; copy++) cards.push(definition);
        faces.set(card.id, {
          name: card.name,
          stats: card.stats,
          element: card.element,
          stars: card.stars,
          artUrl: cardArtUrl(card.artKey),
        });
      }
      return { ok: true, deck: { cards, faces } };
    },
  };
}
