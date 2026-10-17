/**
 * Match results, ratings and streaks (design/SPEC.md, section 10).
 */
import { randomUUID } from 'node:crypto';
import { PLAYER_COLORS, opponentOf, type PlayerColor } from '@triple-triad/engine';
import { desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import type { MatchOutcome } from '@/lib/realtime/protocol';
import { ratingChange } from '@/lib/rating';
import type { AppDatabase, DbExecutor } from '../db/client';
import { matches, users } from '../db/schema';
import type { FinishedGame } from '../rooms/model';

/**
 * Stores a finished game and updates both players' ratings, records and streaks in one
 * transaction. Draws are recorded but change neither ratings nor streaks.
 */
export function recordMatch(db: AppDatabase, game: FinishedGame): MatchOutcome {
  return db.transaction((tx) => {
    const ids = PLAYER_COLORS.map((color) => game.players[color].id);
    const rows = tx.select().from(users).where(inArray(users.id, ids)).all();
    const player = (color: PlayerColor) => {
      const row = rows.find((candidate) => candidate.id === game.players[color].id);
      if (!row) throw new Error(`Player ${game.players[color].id} not found`);
      return row;
    };
    const red = player('red');
    const blue = player('blue');

    const { winner } = game.result;
    const delta = winner
      ? ratingChange(player(winner).rating, player(opponentOf(winner)).rating)
      : 0;
    const after = (row: typeof red, color: PlayerColor) => {
      const won = winner === color;
      const lost = winner !== null && !won;
      return {
        ratingBefore: row.rating,
        ratingAfter: row.rating + (won ? delta : lost ? -delta : 0),
        streak: won ? Math.max(row.streak, 0) + 1 : lost ? Math.min(row.streak, 0) - 1 : row.streak,
      };
    };
    const outcome: MatchOutcome = { red: after(red, 'red'), blue: after(blue, 'blue') };

    for (const color of PLAYER_COLORS) {
      const row = color === 'red' ? red : blue;
      const result = winner === null ? 'draws' : winner === color ? 'wins' : 'losses';
      tx.update(users)
        .set({
          rating: outcome[color].ratingAfter,
          streak: outcome[color].streak,
          [result]: row[result] + 1,
        })
        .where(eq(users.id, row.id))
        .run();
    }

    tx.insert(matches)
      .values({
        id: randomUUID(),
        redUserId: red.id,
        blueUserId: blue.id,
        winner,
        redScore: game.result.score.red,
        blueScore: game.result.score.blue,
        forfeit: game.forfeit,
        redRatingBefore: outcome.red.ratingBefore,
        redRatingAfter: outcome.red.ratingAfter,
        blueRatingBefore: outcome.blue.ratingBefore,
        blueRatingAfter: outcome.blue.ratingAfter,
      })
      .run();
    return outcome;
  });
}

export interface PlayerStats {
  readonly username: string;
  readonly rating: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly streak: number;
}

export function getPlayerStats(db: DbExecutor, userId: string): PlayerStats | null {
  return (
    db
      .select({
        username: users.username,
        rating: users.rating,
        wins: users.wins,
        losses: users.losses,
        draws: users.draws,
        streak: users.streak,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get() ?? null
  );
}

export interface MatchSummary {
  readonly id: string;
  readonly playedAt: Date;
  readonly opponent: string | null;
  readonly result: 'win' | 'loss' | 'draw';
  readonly score: string;
  readonly ratingChange: number;
  readonly forfeit: boolean;
}

/** The player's most recent games, newest first, from their point of view. */
export function listRecentMatches(db: DbExecutor, userId: string, limit = 10): MatchSummary[] {
  const rows = db
    .select()
    .from(matches)
    .where(or(eq(matches.redUserId, userId), eq(matches.blueUserId, userId)))
    // rowid breaks ties between games recorded in the same millisecond.
    .orderBy(desc(matches.playedAt), desc(sql`rowid`))
    .limit(limit)
    .all();
  const opponentIds = rows.map((row) =>
    row.redUserId === userId ? row.blueUserId : row.redUserId,
  );
  const names = new Map(
    db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(
        inArray(
          users.id,
          opponentIds.filter((id): id is string => id !== null),
        ),
      )
      .all()
      .map((row) => [row.id, row.username]),
  );

  return rows.map((row, index) => {
    const color: PlayerColor = row.redUserId === userId ? 'red' : 'blue';
    const opponentId = opponentIds[index];
    const before = color === 'red' ? row.redRatingBefore : row.blueRatingBefore;
    const after = color === 'red' ? row.redRatingAfter : row.blueRatingAfter;
    return {
      id: row.id,
      playedAt: row.playedAt,
      opponent: opponentId ? (names.get(opponentId) ?? null) : null,
      result: row.winner === null ? 'draw' : row.winner === color ? 'win' : 'loss',
      score: `${String(row.redScore)}–${String(row.blueScore)}`,
      ratingChange: after - before,
      forfeit: row.forfeit,
    };
  });
}

/** Highest-rated players who have played at least one game. */
export function leaderboard(db: DbExecutor, limit = 50): PlayerStats[] {
  return db
    .select({
      username: users.username,
      rating: users.rating,
      wins: users.wins,
      losses: users.losses,
      draws: users.draws,
      streak: users.streak,
    })
    .from(users)
    .where(gt(sql`${users.wins} + ${users.losses} + ${users.draws}`, 0))
    .orderBy(desc(users.rating), desc(users.wins), users.username)
    .limit(limit)
    .all();
}
