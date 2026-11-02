import { count } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { cards, starterDecks } from '../db/schema';
import { createStarterDeck, deleteStarterDeck, listStarterDecks } from './starter-decks';
import { createTestDatabase } from '../testing/test-database';
import { addNewStarterDecks, addStardustCrusaders, seedStarterContent } from './seed';
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

describe('addStardustCrusaders', () => {
  /** A database as it was seeded before the Stardust Crusaders. */
  function olderInstallation() {
    const db = createTestDatabase({ seed: false });
    db.insert(starterDecks)
      .values([
        { id: 'starter-wanderer', name: 'Wanderer', isDefault: true, sortOrder: 0 },
        { id: 'starter-elementalist', name: 'Elementalist', isDefault: false, sortOrder: 1 },
        { id: 'starter-vanguard', name: 'Vanguard', isDefault: false, sortOrder: 2 },
      ])
      .run();
    return db;
  }
  const deckNames = (db: ReturnType<typeof olderInstallation>) =>
    listStarterDecks(db).map((deck) => deck.name);

  it('swaps them in for the Elementalist deck, once', () => {
    const db = olderInstallation();

    expect(addStardustCrusaders(db)).toBe(true);

    expect(deckNames(db)).toEqual(['Wanderer', 'Stardust Crusaders', 'Vanguard']);
    expect(listStarterDecks(db)[1]).toMatchObject({ size: 20, violations: [] });
    expect(db.select({ n: count() }).from(cards).get()?.n).toBe(STARTER_CARDS.length);

    deleteStarterDeck(db, 'starter-stardust-crusaders');
    expect(addStardustCrusaders(db)).toBe(false);
    expect(deckNames(db)).toEqual(['Wanderer', 'Vanguard']);
  });

  it('leaves an Elementalist deck that an admin renamed or deleted', () => {
    const db = olderInstallation();
    deleteStarterDeck(db, 'starter-elementalist');
    createStarterDeck(db, 'House rules');

    expect(addStardustCrusaders(db)).toBe(false);

    expect(deckNames(db)).toEqual(['Wanderer', 'Vanguard', 'House rules']);
    expect(db.select({ n: count() }).from(cards).get()?.n).toBe(STARTER_CARDS.length);
  });

  it('changes nothing on a new installation', () => {
    const db = createTestDatabase({ seed: false });
    seedStarterContent(db);

    expect(addStardustCrusaders(db)).toBe(false);

    expect(deckNames(db)).toEqual([
      'Wanderer',
      'Stardust Crusaders',
      'Vanguard',
      'Netherworld',
      'Pretty Derby',
    ]);
  });
});

describe('addNewStarterDecks', () => {
  /** A database as it was seeded before the Netherworld deck. */
  function olderInstallation() {
    const db = createTestDatabase({ seed: false });
    db.insert(starterDecks)
      .values([
        { id: 'starter-wanderer', name: 'Wanderer', isDefault: true, sortOrder: 0 },
        { id: 'starter-stardust-crusaders', name: 'Stardust Crusaders', sortOrder: 1 },
        { id: 'starter-vanguard', name: 'Vanguard', isDefault: false, sortOrder: 2 },
      ])
      .run();
    return db;
  }
  const deckNames = (db: ReturnType<typeof olderInstallation>) =>
    listStarterDecks(db).map((deck) => deck.name);

  it('adds the decks after the others, once', () => {
    const db = olderInstallation();

    expect(addNewStarterDecks(db)).toEqual(['Netherworld', 'Pretty Derby']);

    expect(deckNames(db)).toEqual([
      'Wanderer',
      'Stardust Crusaders',
      'Vanguard',
      'Netherworld',
      'Pretty Derby',
    ]);
    expect(listStarterDecks(db).slice(3)).toMatchObject([
      { isDefault: false, size: 20, violations: [] },
      { isDefault: false, size: 20, violations: [] },
    ]);
    expect(db.select({ n: count() }).from(cards).get()?.n).toBe(STARTER_CARDS.length);

    deleteStarterDeck(db, 'starter-netherworld');
    expect(addNewStarterDecks(db)).toEqual([]);
    expect(deckNames(db)).toEqual(['Wanderer', 'Stardust Crusaders', 'Vanguard', 'Pretty Derby']);
  });

  it('makes the first one the default when there are no other starter decks', () => {
    const db = createTestDatabase({ seed: false });

    addNewStarterDecks(db);

    expect(listStarterDecks(db)).toMatchObject([
      { name: 'Netherworld', isDefault: true },
      { name: 'Pretty Derby', isDefault: false },
    ]);
  });

  it('changes nothing on a new installation', () => {
    const db = createTestDatabase({ seed: false });
    seedStarterContent(db);

    expect(addNewStarterDecks(db)).toEqual([]);

    expect(deckNames(db)).toEqual([
      'Wanderer',
      'Stardust Crusaders',
      'Vanguard',
      'Netherworld',
      'Pretty Derby',
    ]);
  });
});
