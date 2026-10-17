'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import type { SaveDeckResult } from '@/components/decks/deck-editor';
import { deckContentsSchema, deckNameSchema } from '@/lib/validation/deck';
import { getDatabase } from '@/server/db';
import { createDeck, deleteDeck, saveDeck, type DeckEditError } from '@/server/decks/deck-editing';
import { setActiveDeck } from '@/server/decks/decks';
import { requireUser } from '@/server/web/current-user';

export async function makeDeckActive(formData: FormData): Promise<void> {
  const user = await requireUser();
  const deckId = formData.get('deckId');
  if (typeof deckId !== 'string') return;

  // setActiveDeck checks ownership, so a forged deck id cannot touch another player's data.
  if (setActiveDeck(getDatabase(), user.id, deckId)) refresh();
}

export interface NewDeckState {
  readonly error: string | null;
}

export async function createDeckAction(
  _previous: NewDeckState,
  formData: FormData,
): Promise<NewDeckState> {
  const user = await requireUser();
  const name = deckNameSchema.safeParse(formData.get('name'));
  if (!name.success) return { error: name.error.issues[0]?.message ?? 'Invalid name.' };

  const result = createDeck(getDatabase(), user.id, name.data);
  if (!result.ok) return { error: 'You have reached the maximum number of decks.' };
  redirect(`/decks/${result.data.deckId}`);
}

export async function deleteDeckAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const deckId = formData.get('deckId');
  if (typeof deckId !== 'string') return;
  if (deleteDeck(getDatabase(), user.id, deckId).ok) refresh();
}

const SAVE_ERRORS: Record<DeckEditError, string> = {
  DECK_NOT_FOUND: 'That deck no longer exists.',
  DECK_LIMIT: 'You have reached the maximum number of decks.',
  TOO_MANY_CARDS: 'A deck can hold at most 20 cards.',
  NOT_ENOUGH_COPIES: 'You do not own enough copies of a card in this deck.',
};

/**
 * Bound to a deck id on the server (`saveDeckAction.bind(null, id)`) and called by the deck
 * editor with plain data, so every argument is validated like any request.
 */
export async function saveDeckAction(deckId: unknown, contents: unknown): Promise<SaveDeckResult> {
  const user = await requireUser();
  if (typeof deckId !== 'string') return { ok: false, error: 'Invalid deck.' };
  const parsed = deckContentsSchema.safeParse(contents);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid deck.' };
  }

  const result = saveDeck(getDatabase(), user.id, deckId, parsed.data);
  return result.ok ? { ok: true } : { ok: false, error: SAVE_ERRORS[result.error] };
}
