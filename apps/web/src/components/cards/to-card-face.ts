import type { CardSummary } from '@/server/cards/cards';
import type { CardFace } from './card-view';

/**
 * What the renderer needs from a stored card. Art files arrive with uploads (roadmap step 9);
 * until then cards are drawn without art.
 */
export function toCardFace(card: CardSummary): CardFace {
  return {
    name: card.name,
    stats: card.stats,
    element: card.element,
    stars: card.stars,
    artUrl: null,
  };
}
