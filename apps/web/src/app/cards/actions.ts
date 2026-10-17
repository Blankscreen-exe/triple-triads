'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { CARD_ART_MAX_BYTES, cardInputSchema } from '@/lib/validation/card';
import {
  createCustomCard,
  deleteCustomCard,
  type CustomCardError,
} from '@/server/cards/custom-cards';
import { getDatabase } from '@/server/db';
import { getStorage } from '@/server/storage';
import { requireUser } from '@/server/web/current-user';

export interface CardMakerState {
  readonly error: string | null;
}

const ERROR_MESSAGES: Record<CustomCardError, string> = {
  TOO_STRONG: 'This card is too strong: it would be worth more than 5 stars.',
  CARD_LIMIT: 'You have reached the maximum number of custom cards.',
  IMAGE_TOO_LARGE: `The art file is too large (maximum ${String(CARD_ART_MAX_BYTES / 1024 / 1024)} MB).`,
  IMAGE_TOO_SMALL: 'The art is too small. Use an image at least 256 pixels on each side.',
  UNSUPPORTED_IMAGE: 'The art must be a PNG, WebP or JPEG image.',
};

export async function createCardAction(
  _previous: CardMakerState,
  formData: FormData,
): Promise<CardMakerState> {
  const user = await requireUser();

  const element = formData.get('element');
  const parsed = cardInputSchema.safeParse({
    name: formData.get('name'),
    stats: {
      top: formData.get('top'),
      right: formData.get('right'),
      bottom: formData.get('bottom'),
      left: formData.get('left'),
    },
    element: element === '' ? null : element,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid card.' };

  const art = formData.get('art');
  const artBuffer =
    art instanceof File && art.size > 0 ? Buffer.from(await art.arrayBuffer()) : null;

  const result = await createCustomCard(
    getDatabase(),
    getStorage(),
    user.id,
    parsed.data,
    artBuffer,
  );
  if (!result.ok) return { error: ERROR_MESSAGES[result.error] };
  redirect('/cards');
}

export async function deleteCardAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const cardId = formData.get('cardId');
  if (typeof cardId !== 'string') return;
  if (await deleteCustomCard(getDatabase(), getStorage(), user.id, cardId)) refresh();
}
