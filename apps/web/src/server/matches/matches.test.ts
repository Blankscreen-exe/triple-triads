import type { PlayerColor } from '@triple-triad/engine';
import { describe, expect, it } from 'vitest';
import type { AppDatabase } from '../db/client';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import {
  getPlayerStats,
  leaderboard,
  leaderboardPosition,
  matchHistory,
  recordMatch,
} from './matches';

const FIRST_PAGE = { page: 1, pageSize: 10 };

async function twoPlayers(db: AppDatabase) {
  const alice = await createTestUser(db, 'alice');
  const bob = await createTestUser(db, 'bob');
  return { alice, bob };
}

function finish(
  db: AppDatabase,
  red: { id: string; username: string },
  blue: { id: string; username: string },
  winner: PlayerColor | null,
  forfeit = false,
  rounds = 1,
) {
  const score =
    winner === 'red'
      ? { red: 7, blue: 3 }
      : winner === 'blue'
        ? { red: 3, blue: 7 }
        : { red: 5, blue: 5 };
  return recordMatch(db, {
    roomId: 'room',
    players: { red, blue },
    result: { winner, score },
    forfeit,
    rounds,
  });
}

describe('recordMatch', () => {
  it('moves rating points from the loser to the winner and records the result', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);

    const outcome = finish(db, alice, bob, 'red');

    expect(outcome).toEqual({
      red: { ratingBefore: 1000, ratingAfter: 1016, streak: 1 },
      blue: { ratingBefore: 1000, ratingAfter: 984, streak: -1 },
    });
    expect(getPlayerStats(db, alice.id)).toMatchObject({
      rating: 1016,
      wins: 1,
      losses: 0,
      streak: 1,
    });
    expect(getPlayerStats(db, bob.id)).toMatchObject({
      rating: 984,
      wins: 0,
      losses: 1,
      streak: -1,
    });
  });

  it('extends a streak and turns it around on the first result the other way', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);

    finish(db, alice, bob, 'red');
    finish(db, bob, alice, 'blue');
    expect(getPlayerStats(db, alice.id)?.streak).toBe(2);

    finish(db, alice, bob, 'blue');
    expect(getPlayerStats(db, alice.id)?.streak).toBe(-1);
    expect(getPlayerStats(db, bob.id)?.streak).toBe(1);
  });

  it('records a draw without touching ratings or streaks', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);
    finish(db, alice, bob, 'red');

    const outcome = finish(db, alice, bob, null);

    expect(outcome.red).toEqual({ ratingBefore: 1016, ratingAfter: 1016, streak: 1 });
    expect(getPlayerStats(db, alice.id)).toMatchObject({ draws: 1, streak: 1 });
  });

  it('counts a forfeit as a normal win and loss', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);

    finish(db, alice, bob, 'blue', true);

    expect(matchHistory(db, bob.id, FIRST_PAGE).items[0]).toMatchObject({
      result: 'win',
      forfeit: true,
      ratingChange: 16,
    });
  });
});

describe('matchHistory', () => {
  it('shows each game from the player’s point of view, newest first', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);
    finish(db, alice, bob, 'red');
    finish(db, bob, alice, null);

    const history = matchHistory(db, alice.id, FIRST_PAGE).items;

    expect(history.map((match) => [match.opponent, match.result])).toEqual([
      ['bob', 'draw'],
      ['bob', 'win'],
    ]);
    expect(history[1]).toMatchObject({ score: '7–3', ratingChange: 16 });
  });

  it('includes how many rounds a match took', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);
    finish(db, alice, bob, 'blue', false, 3);

    expect(matchHistory(db, alice.id, FIRST_PAGE).items[0]).toMatchObject({
      result: 'loss',
      rounds: 3,
    });
  });

  it('pages through the games, newest first', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);
    for (const rounds of [1, 2, 3, 4, 5]) finish(db, alice, bob, 'red', false, rounds);

    const second = matchHistory(db, alice.id, { page: 2, pageSize: 2 });

    expect(second).toMatchObject({ page: 2, pageCount: 3, total: 5, first: 3, last: 4 });
    expect(second.items.map((match) => match.rounds)).toEqual([3, 2]);
  });
});

describe('leaderboard', () => {
  it('ranks players who have played by rating, leaving out those who have not', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);
    await createTestUser(db, 'carol');
    finish(db, alice, bob, 'blue');

    expect(leaderboard(db, FIRST_PAGE).items.map((player) => player.username)).toEqual([
      'bob',
      'alice',
    ]);
  });

  it('pages the ranking and numbers players by their position', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);
    const carol = await createTestUser(db, 'carol');
    finish(db, alice, bob, 'red');
    finish(db, carol, bob, 'red');

    const second = leaderboard(db, { page: 2, pageSize: 2 });

    expect(second).toMatchObject({ page: 2, pageCount: 2, total: 3 });
    expect(second.items.map((player) => [player.position, player.username])).toEqual([[3, 'bob']]);
  });
});

describe('leaderboardPosition', () => {
  it('matches the leaderboard, ties broken by wins and then by name', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);
    const carol = await createTestUser(db, 'carol');
    const dave = await createTestUser(db, 'dave');
    finish(db, alice, bob, null);
    finish(db, carol, dave, null);

    const ranking = leaderboard(db, FIRST_PAGE).items;
    for (const player of [alice, bob, carol, dave]) {
      expect(leaderboardPosition(db, player.id)).toBe(
        ranking.find((ranked) => ranked.username === player.username)?.position,
      );
    }
    expect(ranking.map((player) => player.username)).toEqual(['alice', 'bob', 'carol', 'dave']);
  });

  it('is null for players who have not finished a game', async () => {
    const db = createTestDatabase();
    const { alice } = await twoPlayers(db);

    expect(leaderboardPosition(db, alice.id)).toBeNull();
  });
});
