/**
 * Match results, ratings and streaks (design/SPEC.md, section 10).
 */
import { randomUUID } from 'node:crypto';
import { PLAYER_COLORS, opponentOf, type PlayerColor } from '@triple-triad/engine';
import { and, count, desc, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';
import { loadPage, type Page, type PageRequest } from '@/lib/pagination';
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
        rounds: game.rounds,
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
  /** Rounds played; more than 1 when drawn rounds were replayed. */
  readonly rounds: number;
}

/** One page of the player's games, newest first, from their point of view. */
export function matchHistory(
  db: DbExecutor,
  userId: string,
  { page, pageSize }: PageRequest,
): Page<MatchSummary> {
  const playedBy = or(eq(matches.redUserId, userId), eq(matches.blueUserId, userId));
  const total = db.select({ total: count() }).from(matches).where(playedBy).get()?.total ?? 0;
  return loadPage(total, page, pageSize, (offset, limit) =>
    summarise(
      db,
      userId,
      db
        .select()
        .from(matches)
        .where(playedBy)
        // rowid breaks ties between games recorded in the same millisecond.
        .orderBy(desc(matches.playedAt), desc(sql`rowid`))
        .limit(limit)
        .offset(offset)
        .all(),
    ),
  );
}

/** Matches as seen by one of their players, with the opponents' current names. */
function summarise(
  db: DbExecutor,
  userId: string,
  rows: readonly (typeof matches.$inferSelect)[],
): MatchSummary[] {
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
      rounds: row.rounds,
    };
  });
}

/** A player on the leaderboard, with their position on it (from 1). */
export interface RankedPlayer extends PlayerStats {
  readonly position: number;
}

/** Only players who have finished a game are ranked. */
const RANKED = gt(sql`${users.wins} + ${users.losses} + ${users.draws}`, 0);

/** One page of the leaderboard: highest rating first, then most wins, then by name. */
export function leaderboard(db: DbExecutor, { page, pageSize }: PageRequest): Page<RankedPlayer> {
  const total = db.select({ total: count() }).from(users).where(RANKED).get()?.total ?? 0;
  return loadPage(total, page, pageSize, (offset, limit) =>
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
      .where(RANKED)
      .orderBy(desc(users.rating), desc(users.wins), users.username)
      .limit(limit)
      .offset(offset)
      .all()
      .map((player, index) => ({ ...player, position: offset + index + 1 })),
  );
}

/** Where the player stands on the leaderboard (from 1), or null if they are not on it yet. */
export function leaderboardPosition(db: DbExecutor, userId: string): number | null {
  const player = db
    .select({ rating: users.rating, wins: users.wins, username: users.username })
    .from(users)
    .where(and(eq(users.id, userId), RANKED))
    .get();
  if (!player) return null;
  // Everyone the leaderboard's order puts first.
  const ahead =
    db
      .select({ total: count() })
      .from(users)
      .where(
        and(
          RANKED,
          or(
            gt(users.rating, player.rating),
            and(eq(users.rating, player.rating), gt(users.wins, player.wins)),
            and(
              eq(users.rating, player.rating),
              eq(users.wins, player.wins),
              lt(users.username, player.username),
            ),
          ),
        ),
      )
      .get()?.total ?? 0;
  return ahead + 1;
}
