'use server';

import { refresh } from 'next/cache';
import { getDatabase } from '@/server/db';
import { setActiveDeck } from '@/server/decks/decks';
import { requireUser } from '@/server/web/current-user';

export async function makeDeckActive(formData: FormData): Promise<void> {
  const user = await requireUser();
  const deckId = formData.get('deckId');
  if (typeof deckId !== 'string') return;

  // setActiveDeck checks ownership, so a forged deck id cannot touch another player's data.
  if (setActiveDeck(getDatabase(), user.id, deckId)) refresh();
}
