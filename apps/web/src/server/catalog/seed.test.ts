import { count } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { cards, starterDecks } from '../db/schema';
import { createTestDatabase } from '../testing/test-database';
import { seedStarterContent } from './seed';
import { STARTER_CARDS, STARTER_DECKS } from './starter-content';

describe('seedStarterContent', () => {
  it('inserts the starter cards and decks into an empty database', () => {
    const db = createTestDatabase({ seed: false });

    expect(seedStarterContent(db)).toBe(true);
    expect(db.select({ n: count() }).from(cards).get()?.n).toBe(STARTER_CARDS.length);
    expect(db.select({ n: count() }).from(starterDecks).get()?.n).toBe(STARTER_DECKS.length);
  });

  it('does nothing when starter decks already exist', () => {
    const db = createTestDatabase({ seed: false });
    seedStarterContent(db);

    expect(seedStarterContent(db)).toBe(false);
    expect(db.select({ n: count() }).from(starterDecks).get()?.n).toBe(STARTER_DECKS.length);
  });
});
