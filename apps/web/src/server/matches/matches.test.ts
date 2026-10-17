import type { PlayerColor } from '@triple-triad/engine';
import { describe, expect, it } from 'vitest';
import type { AppDatabase } from '../db/client';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import { getPlayerStats, leaderboard, listRecentMatches, recordMatch } from './matches';

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

    expect(listRecentMatches(db, bob.id)[0]).toMatchObject({
      result: 'win',
      forfeit: true,
      ratingChange: 16,
    });
  });
});

describe('listRecentMatches', () => {
  it('shows each game from the player’s point of view, newest first', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);
    finish(db, alice, bob, 'red');
    finish(db, bob, alice, null);

    const history = listRecentMatches(db, alice.id);

    expect(history.map((match) => [match.opponent, match.result])).toEqual([
      ['bob', 'draw'],
      ['bob', 'win'],
    ]);
    expect(history[1]).toMatchObject({ score: '7–3', ratingChange: 16 });
  });
});

describe('leaderboard', () => {
  it('ranks players who have played by rating, leaving out those who have not', async () => {
    const db = createTestDatabase();
    const { alice, bob } = await twoPlayers(db);
    await createTestUser(db, 'carol');
    finish(db, alice, bob, 'blue');

    expect(leaderboard(db).map((player) => player.username)).toEqual(['bob', 'alice']);
  });
});
