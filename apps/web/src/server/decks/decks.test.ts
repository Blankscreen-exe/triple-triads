import { describe, expect, it } from 'vitest';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import { listDecks, setActiveDeck } from './decks';

describe('setActiveDeck', () => {
  it('switches the active deck', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    const vanguard = listDecks(db, user.id).find((deck) => deck.name === 'Vanguard');
    if (!vanguard) throw new Error('missing deck');

    expect(setActiveDeck(db, user.id, vanguard.id)).toBe(true);
    expect(
      listDecks(db, user.id)
        .filter((deck) => deck.isActive)
        .map((deck) => deck.name),
    ).toEqual(['Vanguard']);
  });

  it('refuses another player’s deck', async () => {
    const db = createTestDatabase();
    const alice = await createTestUser(db, 'alice');
    const bob = await createTestUser(db, 'bob');
    const bobsDeck = listDecks(db, bob.id)[0];
    if (!bobsDeck) throw new Error('missing deck');

    expect(setActiveDeck(db, alice.id, bobsDeck.id)).toBe(false);
  });
});

describe('listDecks', () => {
  it('lists deck contents strongest first', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);

    const [wanderer] = listDecks(db, user.id);
    const stars = wanderer?.entries.map((entry) => entry.card.stars) ?? [];

    expect(stars).toEqual([...stars].sort((a, b) => b - a));
  });

  it('returns nothing for a player without decks', () => {
    const db = createTestDatabase();

    expect(listDecks(db, 'nobody')).toEqual([]);
  });
});
