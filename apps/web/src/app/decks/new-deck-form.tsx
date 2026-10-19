'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose } from '@/components/ui/modal';
import { Window } from '@/components/ui/window';
import { DECK_NAME_MAX_LENGTH } from '@/lib/validation/deck';
import { createDeckAction, type NewDeckState } from './actions';

const INITIAL_STATE: NewDeckState = { error: null };

/** Name a new deck: inline on wider screens, behind a "+ New" button on phones. */
export function NewDeck() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="max-sm:hidden">
        <NewDeckForm />
      </div>
      <Button
        className="shrink-0 !px-3 !py-1.5 text-sm sm:hidden"
        onClick={() => {
          setOpen(true);
        }}
      >
        + New
      </Button>
      {open && (
        <Modal
          label="New deck"
          onClose={() => {
            setOpen(false);
          }}
        >
          <Window className="space-y-4 p-5">
            <h2 className="font-display text-lg font-bold tracking-wider text-cream">New deck</h2>
            <NewDeckForm />
            <ModalClose variant="quiet">Cancel</ModalClose>
          </Window>
        </Modal>
      )}
    </>
  );
}

function NewDeckForm() {
  const [state, formAction, isPending] = useActionState(createDeckAction, INITIAL_STATE);
  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2">
      <div className="max-sm:min-w-0 max-sm:flex-1">
        <input
          name="name"
          aria-label="New deck name"
          placeholder="New deck name"
          required
          maxLength={DECK_NAME_MAX_LENGTH}
          className="rounded-md border border-frame/50 bg-black/30 px-3 py-2 text-sm max-sm:w-full"
        />
        {state.error && (
          <p role="alert" className="mt-1 text-sm text-status-live">
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isPending}>
        New deck
      </Button>
    </form>
  );
}
