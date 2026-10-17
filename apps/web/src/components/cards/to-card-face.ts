import { cardArtUrl } from '@/lib/media';
import type { CardSummary } from '@/server/cards/cards';
import type { CardFace } from './card-view';

/** What the renderer needs from a stored card. */
export function toCardFace(card: CardSummary): CardFace {
  return {
    name: card.name,
    stats: card.stats,
    element: card.element,
    stars: card.stars,
    artUrl: cardArtUrl(card.artKey),
  };
}
