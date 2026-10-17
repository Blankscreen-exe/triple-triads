import { describe, expect, it } from 'vitest';
import { createCustomCard } from '../cards/custom-cards';
import type { FileStorage } from '../storage/storage';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import { createDeck, deleteDeck, MAX_DECKS_PER_PLAYER, saveDeck } from './deck-editing';
import { listDecks } from './decks';

/** Storage is not touched when cards are created without art. */
const NO_STORAGE = {} as FileStorage;

describe('createDeck', () => {
  it('adds an empty deck', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);

    const result = createDeck(db, user.id, 'Fire deck');

    expect(result.ok).toBe(true);
    expect(listDecks(db, user.id).find((deck) => deck.name === 'Fire deck')).toMatchObject({
      size: 0,
      isActive: false,
    });
  });

  it('limits how many decks a player can have', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    for (let i = listDecks(db, user.id).length; i < MAX_DECKS_PER_PLAYER; i++) {
      createDeck(db, user.id, `D${String(i)}`);
    }

    expect(createDeck(db, user.id, 'One too many')).toEqual({ ok: false, error: 'DECK_LIMIT' });
  });
});

describe('saveDeck', () => {
  it('replaces the contents and the name', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    const [wanderer] = listDecks(db, user.id);
    if (!wanderer) throw new Error('missing deck');

    const result = saveDeck(db, user.id, wanderer.id, {
      name: 'Lizards',
      entries: [{ cardId: 'generic-sand-lizard', quantity: 3 }],
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(listDecks(db, user.id)[0]).toMatchObject({ name: 'Lizards', size: 3 });
  });

  it('refuses more copies than the trunk holds', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    const [deck] = listDecks(db, user.id);
    if (!deck) throw new Error('missing deck');

    // Sky Wyrm: the player owns exactly one.
    expect(
      saveDeck(db, user.id, deck.id, {
        name: 'X',
        entries: [{ cardId: 'generic-sky-wyrm', quantity: 2 }],
      }),
    ).toEqual({ ok: false, error: 'NOT_ENOUGH_COPIES', cardId: 'generic-sky-wyrm' });
  });

  it('allows any number of the player’s own custom cards', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    const created = await createCustomCard(
      db,
      NO_STORAGE,
      user.id,
      { name: 'Mine', stats: { top: 2, right: 2, bottom: 2, left: 2 }, element: null },
      null,
    );
    if (!created.ok) throw new Error(created.error);
    const deck = createDeck(db, user.id, 'Custom');
    if (!deck.ok) throw new Error(deck.error);

    expect(
      saveDeck(db, user.id, deck.data.deckId, {
        name: 'Custom',
        entries: [{ cardId: created.cardId, quantity: 20 }],
      }).ok,
    ).toBe(true);
    // Saved, but 20 identical cards break the copy limit, so the deck cannot be played.
    expect(listDecks(db, user.id).find((d) => d.id === deck.data.deckId)?.violations).toEqual([
      { code: 'TOO_MANY_COPIES', key: '2-2-2-2-none', count: 20, max: 3 },
    ]);
  });

  it('refuses cards the player does not own', async () => {
    const db = createTestDatabase();
    const alice = await createTestUser(db, 'alice');
    const bob = await createTestUser(db, 'bob');
    const bobsCard = await createCustomCard(
      db,
      NO_STORAGE,
      bob.id,
      { name: 'Bob only', stats: { top: 2, right: 2, bottom: 2, left: 2 }, element: null },
      null,
    );
    if (!bobsCard.ok) throw new Error(bobsCard.error);
    const [deck] = listDecks(db, alice.id);
    if (!deck) throw new Error('missing deck');

    expect(
      saveDeck(db, alice.id, deck.id, {
        name: 'X',
        entries: [{ cardId: bobsCard.cardId, quantity: 1 }],
      }),
    ).toMatchObject({ ok: false, error: 'NOT_ENOUGH_COPIES' });
  });

  it('refuses decks over the size limit and other players’ decks', async () => {
    const db = createTestDatabase();
    const alice = await createTestUser(db, 'alice');
    const bob = await createTestUser(db, 'bob');
    const [alicesDeck] = listDecks(db, alice.id);
    if (!alicesDeck) throw new Error('missing deck');

    expect(
      saveDeck(db, alice.id, alicesDeck.id, {
        name: 'Big',
        entries: [
          { cardId: 'generic-sand-lizard', quantity: 5 },
          { cardId: 'generic-iron-knight', quantity: 5 },
          { cardId: 'generic-thorn-wolf', quantity: 5 },
          { cardId: 'generic-storm-hawk', quantity: 5 },
          { cardId: 'generic-spore-cap', quantity: 3 },
        ],
      }),
    ).toEqual({ ok: false, error: 'TOO_MANY_CARDS' });
    expect(saveDeck(db, bob.id, alicesDeck.id, { name: 'Mine now', entries: [] })).toEqual({
      ok: false,
      error: 'DECK_NOT_FOUND',
    });
  });
});

describe('deleteDeck', () => {
  it('makes the oldest remaining deck active when the active deck is deleted', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    const [wanderer] = listDecks(db, user.id);
    if (!wanderer) throw new Error('missing deck');

    expect(deleteDeck(db, user.id, wanderer.id).ok).toBe(true);

    expect(listDecks(db, user.id).map((deck) => [deck.name, deck.isActive])).toEqual([
      ['Elementalist', true],
      ['Vanguard', false],
    ]);
  });

  it('refuses another player’s deck', async () => {
    const db = createTestDatabase();
    const alice = await createTestUser(db, 'alice');
    const bob = await createTestUser(db, 'bob');
    const [alicesDeck] = listDecks(db, alice.id);
    if (!alicesDeck) throw new Error('missing deck');

    expect(deleteDeck(db, bob.id, alicesDeck.id)).toEqual({ ok: false, error: 'DECK_NOT_FOUND' });
  });
});
