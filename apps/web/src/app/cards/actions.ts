'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import type { CardFormState } from '@/components/cards/card-form';
import { cardErrorMessage, readCardForm } from '@/server/cards/card-form-data';
import { createCustomCard, deleteCustomCard } from '@/server/cards/custom-cards';
import { getDatabase } from '@/server/db';
import { getStorage } from '@/server/storage';
import { requireUser } from '@/server/web/current-user';

export async function createCardAction(
  _previous: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  const user = await requireUser();
  const form = await readCardForm(formData);
  if (!form.ok) return { error: form.error };

  const result = await createCustomCard(getDatabase(), getStorage(), user.id, form.input, form.art);
  if (!result.ok) {
    return {
      error:
        result.error === 'CARD_LIMIT'
          ? 'You have reached the maximum number of custom cards.'
          : cardErrorMessage(result.error),
    };
  }
  redirect('/cards');
}

export async function deleteCardAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const cardId = formData.get('cardId');
  if (typeof cardId !== 'string') return;
  if (await deleteCustomCard(getDatabase(), getStorage(), user.id, cardId)) refresh();
}
