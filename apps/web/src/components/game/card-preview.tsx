'use client';

import type { PlayerColor } from '@triple-triad/engine';
import type { AssetPack } from '@/lib/asset-packs';
import { CardView, type CardFace } from '../cards/card-view';
import { Button } from '../ui/button';
import { useModalDialog } from '../ui/use-modal-dialog';

interface CardPreviewProps {
  readonly card: CardFace;
  readonly side: PlayerColor;
  readonly pack: AssetPack;
  /** An optional action next to Close, e.g. playing the card. */
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly onClose: () => void;
}

/**
 * A card shown as large as the screen allows, in a modal dialog. Escape, Close or a click outside
 * the card closes it. Render it only while it should be open.
 */
export function CardPreview({ card, side, pack, action, onClose }: CardPreviewProps) {
  const ref = useModalDialog(onClose);

  return (
    <dialog
      ref={ref}
      aria-label={`Preview: ${card.name}`}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) ref.current?.close();
      }}
      className="m-auto max-h-none max-w-none overflow-visible bg-transparent p-0 backdrop:bg-night/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 p-4">
        <div className="w-[min(85vw,360px,calc((100svh-130px)*0.714))]">
          <CardView card={card} side={side} pack={pack} />
        </div>
        <div className="flex gap-3">
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
          <Button
            variant="secondary"
            onClick={() => {
              ref.current?.close();
            }}
          >
            Close
          </Button>
        </div>
      </div>
    </dialog>
  );
}
