'use client';

import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { Button } from './button';

interface ModalProps {
  /** Accessible name of the dialog. */
  readonly label: string;
  readonly onClose: () => void;
  /** `center`: a window in the middle of the screen. `sheet`: slides up from the bottom. */
  readonly variant?: 'center' | 'sheet';
  /** The content; use ModalClose for buttons that close it. */
  readonly children: ReactNode;
}

const VARIANTS = {
  center: 'm-auto w-[min(100%-2rem,28rem)]',
  sheet: 'mx-0 mt-auto mb-0 w-full max-w-full motion-safe:animate-sheet-up',
} as const;

/**
 * A modal dialog (the browser's own, so focus is kept inside and Escape closes it). Clicking the
 * backdrop closes it too. Render it only while it should be open.
 */
export function Modal({ label, onClose, variant = 'center', children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // Removing the element closes it, so there is no close() on unmount.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className={`max-h-[90dvh] overflow-y-auto bg-transparent p-0 text-slate-100 backdrop:bg-night/75 backdrop:backdrop-blur-sm ${VARIANTS[variant]}`}
    >
      {children}
    </dialog>
  );
}

/** A button that closes the modal it is in (a native `method="dialog"` form, no script needed). */
export function ModalClose(props: Omit<ComponentProps<typeof Button>, 'type'>) {
  return (
    <form method="dialog" className="contents">
      <Button {...props} type="submit" />
    </form>
  );
}
