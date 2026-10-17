'use client';

import type { ComponentProps } from 'react';
import { Button } from './button';

interface ConfirmButtonProps extends Omit<ComponentProps<typeof Button>, 'type' | 'onClick'> {
  /** Question shown before the form is submitted. */
  readonly confirmation: string;
}

/** Submit button that asks for confirmation first (for destructive actions). */
export function ConfirmButton({ confirmation, ...props }: ConfirmButtonProps) {
  return (
    <Button
      {...props}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmation)) event.preventDefault();
      }}
    />
  );
}
