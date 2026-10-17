import { describe, expect, it } from 'vitest';
import { createSession, validateSessionToken } from '../auth/sessions';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import { authenticateUser } from '../users/users';
import { listUsers, resetPassword, setBanned, setRole } from './users';

/** The first account is the admin; the second a player. */
async function adminAndPlayer() {
  const db = createTestDatabase();
  const admin = await createTestUser(db, 'admin');
  const player = await createTestUser(db, 'player');
  return { db, admin, player };
}

describe('listUsers', () => {
  it('lists everyone with their role and status', async () => {
    const { db } = await adminAndPlayer();

    expect(listUsers(db).map((user) => [user.username, user.role, user.bannedAt])).toEqual([
      ['admin', 'admin', null],
      ['player', 'player', null],
    ]);
  });
});

describe('setBanned', () => {
  it('bans a player: their sessions end and they cannot log in', async () => {
    const { db, admin, player } = await adminAndPlayer();
    const { token } = createSession(db, player.id);

    expect(setBanned(db, admin.id, player.id, true)).toEqual({ ok: true, data: null });

    expect(validateSessionToken(db, token)).toBeNull();
    expect(
      await authenticateUser(db, { username: 'player', password: 'correct horse battery' }),
    ).toEqual({
      ok: false,
      error: 'BANNED',
    });
  });

  it('lifts a ban', async () => {
    const { db, admin, player } = await adminAndPlayer();
    setBanned(db, admin.id, player.id, true);

    setBanned(db, admin.id, player.id, false);

    expect(
      (await authenticateUser(db, { username: 'player', password: 'correct horse battery' })).ok,
    ).toBe(true);
  });

  it('refuses to ban yourself or another admin', async () => {
    const { db, admin, player } = await adminAndPlayer();
    setRole(db, admin.id, player.id, 'admin');

    expect(setBanned(db, admin.id, admin.id, true)).toEqual({
      ok: false,
      error: 'CANNOT_CHANGE_SELF',
    });
    expect(setBanned(db, admin.id, player.id, true)).toEqual({
      ok: false,
      error: 'ADMIN_CANNOT_BE_BANNED',
    });
  });
});

describe('setRole', () => {
  it('promotes and demotes', async () => {
    const { db, admin, player } = await adminAndPlayer();

    setRole(db, admin.id, player.id, 'admin');
    expect(listUsers(db).find((user) => user.id === player.id)?.role).toBe('admin');

    setRole(db, player.id, admin.id, 'player');
    expect(listUsers(db).find((user) => user.id === admin.id)?.role).toBe('player');
  });

  it('never leaves the game without an admin', async () => {
    const { db, admin, player } = await adminAndPlayer();
    setRole(db, admin.id, player.id, 'admin');
    setRole(db, player.id, admin.id, 'player');

    // `player` is now the only admin and cannot be demoted by anyone.
    expect(setRole(db, admin.id, player.id, 'player')).toEqual({ ok: false, error: 'LAST_ADMIN' });
  });

  it('refuses to change your own role', async () => {
    const { db, admin } = await adminAndPlayer();

    expect(setRole(db, admin.id, admin.id, 'player')).toEqual({
      ok: false,
      error: 'CANNOT_CHANGE_SELF',
    });
  });
});

describe('resetPassword', () => {
  it('sets a new password, which works, and ends existing sessions', async () => {
    const { db, admin, player } = await adminAndPlayer();
    const { token } = createSession(db, player.id);

    const result = await resetPassword(db, admin.id, player.id);
    if (!result.ok) throw new Error(result.error);

    expect(result.data.password).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(validateSessionToken(db, token)).toBeNull();
    expect(
      (await authenticateUser(db, { username: 'player', password: result.data.password })).ok,
    ).toBe(true);
  });

  it('refuses unknown users', async () => {
    const { db, admin } = await adminAndPlayer();

    expect(await resetPassword(db, admin.id, 'nobody')).toEqual({
      ok: false,
      error: 'USER_NOT_FOUND',
    });
  });
});
