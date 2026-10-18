'use client';

import { isPosition, type Position } from '@triple-triad/engine';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Drag a card from your hand onto the board. Uses pointer events, so it works with a mouse, a
 * finger or a pen; clicking a card and then a square still works (and is the keyboard path).
 *
 * Drop targets are any elements with a `data-drop-position` attribute (see Board). A drag only
 * starts once the pointer has moved a few pixels, so a plain click is never mistaken for one.
 */

/** Movement (px) before a press becomes a drag. */
const DRAG_THRESHOLD = 6;

export interface CardDrag {
  readonly instanceId: string;
  /** The square under the pointer, if it accepts a card. */
  readonly over: Position | null;
  /** Width of the card being dragged, so the ghost matches it. */
  readonly width: number;
}

interface Session {
  readonly instanceId: string;
  readonly pointerId: number;
  readonly source: HTMLElement;
  readonly startX: number;
  readonly startY: number;
  /** Where on the card it was grabbed, so it does not jump under the pointer. */
  readonly grabX: number;
  readonly grabY: number;
  readonly width: number;
  x: number;
  y: number;
  started: boolean;
  over: Position | null;
}

export interface CardDragControls {
  readonly drag: CardDrag | null;
  /** Spread onto each draggable card in the viewer's hand. */
  readonly sourceProps: (instanceId: string) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onClickCapture: (event: ReactMouseEvent) => void;
  };
  /** Internal: lets DragGhost follow the pointer. */
  readonly ghostRef: RefObject<HTMLDivElement | null>;
}

export function useCardDrag({
  enabled,
  onDrop,
}: {
  readonly enabled: boolean;
  readonly onDrop: (instanceId: string, position: Position) => void;
}): CardDragControls {
  const [drag, setDrag] = useState<CardDrag | null>(null);
  const session = useRef<Session | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  // A drag ends with a pointerup on the card, which the browser follows with a click.
  const swallowNextClick = useRef(false);

  const moveGhost = () => {
    const current = session.current;
    const ghost = ghostRef.current;
    if (!current || !ghost) return;
    ghost.style.transform = `translate(${String(current.x - current.grabX)}px, ${String(current.y - current.grabY)}px)`;
  };

  const finish = (dropped: boolean) => {
    const current = session.current;
    session.current = null;
    if (!current) return;
    if (current.source.hasPointerCapture(current.pointerId)) {
      current.source.releasePointerCapture(current.pointerId);
    }
    if (!current.started) return;
    swallowNextClick.current = true;
    setDrag(null);
    if (dropped && current.over !== null) onDrop(current.instanceId, current.over);
  };

  // Escape cancels a drag; a turn ending mid-drag (e.g. the timer) cancels it too.
  useEffect(() => {
    if (!drag) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  });
  useEffect(() => {
    if (!enabled) finish(false);
  });

  // Place the ghost before the browser paints it, so it never flashes at the corner.
  useLayoutEffect(moveGhost, [drag]);

  return {
    drag,
    ghostRef,
    sourceProps: (instanceId) => ({
      onPointerDown: (event) => {
        if (!enabled || !event.isPrimary || event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);
        session.current = {
          instanceId,
          pointerId: event.pointerId,
          source: event.currentTarget,
          startX: event.clientX,
          startY: event.clientY,
          grabX: event.clientX - rect.left,
          grabY: event.clientY - rect.top,
          width: rect.width,
          x: event.clientX,
          y: event.clientY,
          started: false,
          over: null,
        };
      },
      onPointerMove: (event) => {
        const current = session.current;
        if (current?.pointerId !== event.pointerId) return;
        current.x = event.clientX;
        current.y = event.clientY;
        if (!current.started) {
          const moved = Math.hypot(current.x - current.startX, current.y - current.startY);
          if (moved < DRAG_THRESHOLD) return;
          current.started = true;
          setDrag({ instanceId, over: null, width: current.width });
        }
        moveGhost();
        const over = dropTargetAt(current.x, current.y);
        if (over !== current.over) {
          current.over = over;
          setDrag({ instanceId, over, width: current.width });
        }
      },
      onPointerUp: (event) => {
        if (session.current?.pointerId === event.pointerId) finish(true);
      },
      onPointerCancel: () => {
        finish(false);
      },
      onClickCapture: (event) => {
        if (!swallowNextClick.current) return;
        swallowNextClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    }),
  };
}

/** The empty square under a point, if it accepts a card. The ghost ignores the pointer. */
function dropTargetAt(x: number, y: number): Position | null {
  const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-position]');
  const value = Number(target?.dataset['dropPosition']);
  return target && isPosition(value) ? value : null;
}

/** The card following the pointer while dragging. */
export function DragGhost({
  controls: { drag, ghostRef },
  children,
}: {
  readonly controls: CardDragControls;
  readonly children: ReactNode;
}) {
  if (!drag) return null;
  return createPortal(
    <div
      ref={ghostRef}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-50 rotate-3 drop-shadow-[0_12px_18px_rgb(0_0_0/0.6)]"
      style={{ width: drag.width }}
    >
      {children}
    </div>,
    document.body,
  );
}
