/**
 * Deck editing input, shared by the deck editor and the server.
 */
import { DEFAULT_DECK_RULES } from '@triple-triad/engine';
import { z } from 'zod';

export const DECK_NAME_MAX_LENGTH = 30;

export const deckNameSchema = z
  .string()
  .trim()
  .min(1, 'Give the deck a name.')
  .max(
    DECK_NAME_MAX_LENGTH,
    `Deck names can be at most ${String(DECK_NAME_MAX_LENGTH)} characters.`,
  );

export const deckContentsSchema = z.object({
  name: deckNameSchema,
  entries: z
    .array(
      z.object({
        cardId: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(DEFAULT_DECK_RULES.size),
      }),
    )
    .max(DEFAULT_DECK_RULES.size)
    .refine((entries) => new Set(entries.map((entry) => entry.cardId)).size === entries.length, {
      message: 'Each card may appear only once.',
    }),
});

export type DeckContents = z.infer<typeof deckContentsSchema>;
