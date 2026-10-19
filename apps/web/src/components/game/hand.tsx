'use client';

import type { HandView, PlayerColor } from '@triple-triad/engine';
import type { CSSProperties } from 'react';
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

/** On phones, how wide each card in the row is, as a percentage of the row. */
const ROW_CARD_PERCENT = 24;

/**
 * A hand of cards. On phones: a row, overlapping sideways only when the cards would not fit, so
 * the left edge of each card (with its numbers) stays visible. On wider screens: a column,
 * stacked so the top of each card stays visible.
 */
export function Hand({ label, hand, color, pack, cards, selection }: HandProps) {
  const count = hand.cards?.length ?? hand.size;
  const rowOverlap =
    count > 1 ? Math.max(0, ROW_CARD_PERCENT - (100 - ROW_CARD_PERCENT) / (count - 1)) : 0;
  const slot = (index: number) =>
    `w-[24%] shrink-0 px-0.5 max-sm:ml-(--row-shift) sm:w-auto sm:px-0 ${index > 0 ? 'sm:-mt-[100%]' : ''}`;
  const slotStyle = (index: number, zIndex: number) =>
    ({
      zIndex,
      '--row-shift': index > 0 ? `${String(-rowOverlap)}%` : '0%',
    }) as CSSProperties;
  const list = 'flex w-full justify-center sm:flex-col';

  if (hand.cards === null) {
    return (
      <ol aria-label={`${label} (${String(hand.size)} hidden cards)`} className={list}>
        {Array.from({ length: hand.size }, (_, index) => (
          <li key={index} className={slot(index)} style={slotStyle(index, index)}>
            <CardBack pack={pack} />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol aria-label={label} className={list}>
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
            className={`relative transition-transform ${slot(index)} ${selected ? '-translate-y-3 sm:translate-y-0 sm:-translate-x-6' : ''}`}
            style={slotStyle(index, selected ? 20 : index)}
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
