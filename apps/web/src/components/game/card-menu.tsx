'use client';

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

interface CardMenuProps {
  readonly cardName: string;
  /** Your turn: the card can be played. */
  readonly canUse: boolean;
  /** The card is already chosen to play, so the second item cancels that instead. */
  readonly selected: boolean;
  readonly onPreview: () => void;
  readonly onUse: () => void;
  readonly onCancel: () => void;
  readonly onClose: () => void;
}

const ITEM =
  'rounded px-3 py-2 text-left text-sm font-semibold text-slate-100 hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent';

/**
 * The menu shown over a card in your hand when it is tapped or clicked: Preview or Use. Place it
 * inside the card's (positioned) list item; a press anywhere outside that item closes it.
 */
export function CardMenu({
  cardName,
  canUse,
  selected,
  onPreview,
  onUse,
  onCancel,
  onClose,
}: CardMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Keyboard users land on the first item.
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const item = ref.current?.parentElement;
      if (item && event.target instanceof Node && !item.contains(event.target)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [
      ...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
    ];
    const current = items.findIndex((item) => item === document.activeElement);
    const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={cardName}
      onKeyDown={onKeyDown}
      className="absolute top-1/2 left-1/2 z-10 flex w-max min-w-full -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 rounded-md border-2 border-frame/75 bg-window-bottom/95 p-1 shadow-[0_8px_20px_rgb(0_0_0/0.6)]"
    >
      <button type="button" role="menuitem" onClick={onPreview} className={ITEM}>
        Preview
      </button>
      {selected ? (
        <button type="button" role="menuitem" onClick={onCancel} className={ITEM}>
          Cancel
        </button>
      ) : (
        <button type="button" role="menuitem" disabled={!canUse} onClick={onUse} className={ITEM}>
          Use
          {!canUse && (
            <span className="block text-[10px] font-normal text-slate-300">on your turn</span>
          )}
        </button>
      )}
    </div>
  );
}
