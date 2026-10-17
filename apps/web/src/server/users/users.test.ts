import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { users } from '../db/schema';
import { listDecks } from '../decks/decks';
import { createTestDatabase } from '../testing/test-database';
import { listTrunk } from '../trunk/trunk';
import { authenticateUser, registerUser } from './users';

const credentials = { username: 'Squall', password: 'whatever-forever' };

describe('registerUser', () => {
  it('makes the first account an admin and later accounts players', async () => {
    const db = createTestDatabase();

    const first = await registerUser(db, credentials);
    const second = await registerUser(db, { username: 'Rinoa', password: 'angel-wing-1' });

    expect(first.ok && first.user.role).toBe('admin');
    expect(second.ok && second.user.role).toBe('player');
  });

  it('rejects a username that differs only in case', async () => {
    const db = createTestDatabase();
    await registerUser(db, credentials);

    expect(await registerUser(db, { ...credentials, username: 'sQuAlL' })).toEqual({
      ok: false,
      error: 'USERNAME_TAKEN',
    });
  });

  it('stores a password hash, never the password', async () => {
    const db = createTestDatabase();
    const result = await registerUser(db, credentials);
    if (!result.ok) throw new Error(result.error);

    const row = db.select().from(users).where(eq(users.id, result.user.id)).get();

    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row?.passwordHash).not.toContain(credentials.password);
  });

  it('gives every starter deck, with the default one active', async () => {
    const db = createTestDatabase();
    const result = await registerUser(db, credentials);
    if (!result.ok) throw new Error(result.error);

    const decks = listDecks(db, result.user.id);

    expect(decks.map((deck) => deck.name)).toEqual(['Wanderer', 'Elementalist', 'Vanguard']);
    expect(decks.filter((deck) => deck.isActive).map((deck) => deck.name)).toEqual(['Wanderer']);
    expect(decks.every((deck) => deck.size === 20 && deck.violations.length === 0)).toBe(true);
  });

  it('puts the cards of all starter decks in the trunk', async () => {
    const db = createTestDatabase();
    const result = await registerUser(db, credentials);
    if (!result.ok) throw new Error(result.error);

    const trunk = listTrunk(db, result.user.id);
    const total = trunk.reduce(
      (sum, entry) => sum + (entry.quantity === 'unlimited' ? 0 : entry.quantity),
      0,
    );

    expect(total).toBe(60);
    // Sand Lizard is in two starter decks: 3 + 2 copies.
    expect(trunk.find((entry) => entry.card.name === 'Sand Lizard')?.quantity).toBe(5);
  });

  it('trims surrounding spaces from the username', async () => {
    const db = createTestDatabase();

    const result = await registerUser(db, { ...credentials, username: '  Zell  ' });

    expect(result.ok && result.user.username).toBe('Zell');
  });
});

describe('authenticateUser', () => {
  it('returns the user for correct credentials, ignoring username case', async () => {
    const db = createTestDatabase();
    await registerUser(db, credentials);

    const result = await authenticateUser(db, { ...credentials, username: 'squall' });

    expect(result).toMatchObject({ ok: true, user: { username: 'Squall', role: 'admin' } });
  });

  it('rejects a wrong password', async () => {
    const db = createTestDatabase();
    await registerUser(db, credentials);

    expect(await authenticateUser(db, { ...credentials, password: 'wrong-password' })).toEqual({
      ok: false,
      error: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects an unknown user', async () => {
    const db = createTestDatabase();

    expect(await authenticateUser(db, credentials)).toEqual({
      ok: false,
      error: 'INVALID_CREDENTIALS',
    });
  });
});
