'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { DECK_NAME_MAX_LENGTH } from '@/lib/validation/deck';
import { createStarterDeckAction, type NewStarterDeckState } from '../actions';

const INITIAL_STATE: NewStarterDeckState = { error: null };

export function NewStarterDeckForm() {
  const [state, formAction, isPending] = useActionState(createStarterDeckAction, INITIAL_STATE);
  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2">
      <div>
        <input
          name="name"
          aria-label="New starter deck name"
          placeholder="New starter deck name"
          required
          maxLength={DECK_NAME_MAX_LENGTH}
          className="rounded-md border border-frame/50 bg-black/30 px-3 py-2 text-sm"
        />
        {state.error && (
          <p role="alert" className="mt-1 text-sm text-status-live">
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isPending}>
        New starter deck
      </Button>
    </form>
  );
}
