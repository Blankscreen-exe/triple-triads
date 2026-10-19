'use client';

import type { HandView, PlayerColor } from '@triple-triad/engine';
import { useCallback, useState, type CSSProperties } from 'react';
import type { AssetPack } from '@/lib/asset-packs';
import type { CardInfo } from '@/lib/realtime/protocol';
import { CardBack, CardView } from '../cards/card-view';
import type { CardDragControls } from './card-drag';
import { CardMenu } from './card-menu';

interface HandProps {
  readonly label: string;
  readonly hand: HandView;
  readonly color: PlayerColor;
  readonly pack: AssetPack;
  readonly cards: Readonly<Record<string, CardInfo>>;
  /**
   * Present for the viewer's own hand. Tapping a card opens a menu: Preview, or Use (then choose a
   * square). Cards can also be dragged straight onto the board.
   */
  readonly selection?: {
    readonly selectedId: string | null;
    /** Your turn: cards can be used and dragged. */
    readonly enabled: boolean;
    /** Choose a card to play, or null to change your mind. */
    readonly onSelect: (instanceId: string | null) => void;
    readonly onPreview: (instanceId: string) => void;
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
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const closeMenu = useCallback(() => {
    setMenuFor(null);
  }, []);
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

  // Starting a drag, or the card leaving the hand, closes its menu.
  const openMenu =
    selection?.drag.drag || !hand.cards.some((card) => card.instanceId === menuFor)
      ? null
      : menuFor;

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
        const menuOpen = openMenu === instance.instanceId;
        return (
          <li
            key={instance.instanceId}
            className={`relative transition-transform ${slot(index)} ${selected ? '-translate-y-3 sm:translate-y-0 sm:-translate-x-6' : ''}`}
            style={slotStyle(index, menuOpen ? 30 : selected ? 20 : index)}
          >
            {selection ? (
              <>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-pressed={selected}
                  onClick={() => {
                    setMenuFor(menuOpen ? null : instance.instanceId);
                  }}
                  {...selection.drag.sourceProps(instance.instanceId)}
                  className={`block w-full rounded-[3%/2.2%] transition-opacity select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream ${
                    selection.enabled ? 'cursor-grab touch-none' : 'cursor-pointer'
                  } ${selected ? 'outline-3 outline-offset-2 outline-cream' : ''} ${dragged ? 'opacity-30' : ''}`}
                >
                  {card}
                </button>
                {menuOpen && (
                  <CardMenu
                    cardName={face?.name ?? 'Card'}
                    canUse={selection.enabled}
                    selected={selected}
                    onPreview={() => {
                      setMenuFor(null);
                      selection.onPreview(instance.instanceId);
                    }}
                    onUse={() => {
                      setMenuFor(null);
                      selection.onSelect(instance.instanceId);
                    }}
                    onCancel={() => {
                      setMenuFor(null);
                      selection.onSelect(null);
                    }}
                    onClose={closeMenu}
                  />
                )}
              </>
            ) : (
              card
            )}
          </li>
        );
      })}
    </ol>
  );
}
