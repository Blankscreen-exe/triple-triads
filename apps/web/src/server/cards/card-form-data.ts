/**
 * Reading the card form (see components/cards/card-form.tsx) in server actions.
 */
import { CARD_ART_MAX_BYTES, cardInputSchema, type CardInput } from '@/lib/validation/card';
import type { CardArtError } from './card-art';

export async function readCardForm(
  formData: FormData,
): Promise<{ ok: true; input: CardInput; art: Buffer | null } | { ok: false; error: string }> {
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
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid card.' };
  }

  const art = formData.get('art');
  const buffer = art instanceof File && art.size > 0 ? Buffer.from(await art.arrayBuffer()) : null;
  return { ok: true, input: parsed.data, art: buffer };
}

const MESSAGES: Record<CardArtError | 'TOO_STRONG', string> = {
  TOO_STRONG: 'This card is too strong: it would be worth more than 5 stars.',
  IMAGE_TOO_LARGE: `The art file is too large (maximum ${String(CARD_ART_MAX_BYTES / 1024 / 1024)} MB).`,
  IMAGE_TOO_SMALL: 'The art is too small. Use an image at least 256 pixels on each side.',
  UNSUPPORTED_IMAGE: 'The art must be a PNG, WebP or JPEG image.',
};

export function cardErrorMessage(error: CardArtError | 'TOO_STRONG'): string {
  return MESSAGES[error];
}
