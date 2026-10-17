/**
 * Rules for player-made cards, shared by the card maker form and the server.
 */
import { ELEMENTS, MAX_STAT_VALUE, MIN_STAT_VALUE, type StatValue } from '@triple-triad/engine';
import { z } from 'zod';

export const CARD_NAME_MAX_LENGTH = 24;

/** Uploaded art: largest accepted file and smallest accepted side, in bytes and pixels. */
export const CARD_ART_MAX_BYTES = 5 * 1024 * 1024;
export const CARD_ART_MIN_SIDE = 256;
export const CARD_ART_TYPES = ['image/png', 'image/webp', 'image/jpeg'] as const;

const stat = z.coerce
  .number()
  .int()
  .min(MIN_STAT_VALUE)
  .max(MAX_STAT_VALUE)
  .transform((value) => value as StatValue);

export const cardInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the card a name.')
    .max(CARD_NAME_MAX_LENGTH, `Names can be at most ${String(CARD_NAME_MAX_LENGTH)} characters.`),
  stats: z.object({ top: stat, right: stat, bottom: stat, left: stat }),
  element: z.enum(ELEMENTS).nullable(),
});

export type CardInput = z.infer<typeof cardInputSchema>;
