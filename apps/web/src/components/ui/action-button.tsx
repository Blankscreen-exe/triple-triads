'use client';

import { useState, useTransition } from 'react';
import { Button, type ButtonVariant } from './button';

export type ActionResult =
  { readonly ok: true; readonly message?: string } | { readonly ok: false; readonly error: string };

interface ActionButtonProps {
  /** A server action, usually bound to its arguments on the server. */
  readonly action: () => Promise<ActionResult>;
  readonly children: string;
  readonly variant?: ButtonVariant;
  /** Asked before running, for destructive actions. */
  readonly confirmation?: string;
  readonly className?: string;
}

/** Runs a server action and shows its outcome next to the button. */
export function ActionButton({
  action,
  children,
  variant = 'secondary',
  confirmation,
  className = '',
}: ActionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        className={`!px-3 !py-1 text-sm ${className}`}
        disabled={isPending}
        onClick={() => {
          if (confirmation && !window.confirm(confirmation)) return;
          startTransition(async () => {
            setResult(await action());
          });
        }}
      >
        {children}
      </Button>
      {result && !result.ok && (
        <span role="alert" className="text-xs text-status-live">
          {result.error}
        </span>
      )}
      {result?.ok && result.message && (
        <span
          role="status"
          className="rounded-sm bg-black/40 px-2 py-1 font-mono text-xs text-cream select-all"
        >
          {result.message}
        </span>
      )}
    </span>
  );
}
