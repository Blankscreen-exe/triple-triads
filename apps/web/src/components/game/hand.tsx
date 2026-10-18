'use client';

import type { HandView, PlayerColor } from '@triple-triad/engine';
import type { AssetPack } from '@/lib/asset-packs';
import type { CardInfo } from '@/lib/realtime/protocol';
import { CardBack, CardView } from '../cards/card-view';
import type { CardDragControls } from './card-drag';

interface HandProps {
  readonly label: string;
  readonly hand: HandView;
  readonly color: PlayerColor;
  readonly pack: AssetPack;
  readonly cards: Readonly<Record<string, CardInfo>>;
  /** Present for the viewer's own hand: lets them pick a card to play. */
  readonly selection?: {
    readonly selectedId: string | null;
    readonly enabled: boolean;
    readonly onSelect: (instanceId: string) => void;
    /** Drag-and-drop onto the board, alongside click-to-select. */
    readonly drag: CardDragControls;
  };
}

/** A hand of cards, stacked so the top of each card (with its numbers) stays visible. */
export function Hand({ label, hand, color, pack, cards, selection }: HandProps) {
  const overlap = (index: number) => (index > 0 ? '-mt-[100%]' : '');

  if (hand.cards === null) {
    return (
      <ol aria-label={`${label} (${String(hand.size)} hidden cards)`} className="flex flex-col">
        {Array.from({ length: hand.size }, (_, index) => (
          <li key={index} className={overlap(index)} style={{ zIndex: index }}>
            <CardBack pack={pack} />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol aria-label={label} className="flex flex-col">
      {hand.cards.map((instance, index) => {
        const face = cards[instance.card.id];
        const card = face ? (
          <CardView card={face} side={color} pack={pack} />
        ) : (
          <CardBack pack={pack} />
        );
        const selected = selection?.selectedId === instance.instanceId;
        const dragged = selection?.drag.drag?.instanceId === instance.instanceId;
        return (
          <li
            key={instance.instanceId}
            className={`relative transition-transform ${overlap(index)} ${selected ? '-translate-x-4 sm:-translate-x-6' : ''}`}
            style={{ zIndex: selected ? 20 : index }}
          >
            {selection ? (
              <button
                type="button"
                disabled={!selection.enabled}
                aria-pressed={selected}
                onClick={() => {
                  selection.onSelect(instance.instanceId);
                }}
                {...selection.drag.sourceProps(instance.instanceId)}
                className={`block w-full rounded-[3%/2.2%] transition-opacity select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream enabled:cursor-grab enabled:touch-none ${
                  selected ? 'outline-3 outline-offset-2 outline-cream' : ''
                } ${dragged ? 'opacity-30' : ''}`}
              >
                {card}
              </button>
            ) : (
              card
            )}
          </li>
        );
      })}
    </ol>
  );
}
