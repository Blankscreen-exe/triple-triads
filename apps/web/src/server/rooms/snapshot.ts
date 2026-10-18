/**
 * Building what each participant receives. Snapshots are personalised: the game view comes from
 * the engine's `viewFor`, and display data is included only for cards the viewer can see.
 */
import { PLAYER_COLORS, viewFor, type GameView, type PlayerColor } from '@triple-triad/engine';
import type {
  CardInfo,
  GameSnapshot,
  MatchSnapshot,
  RoomSnapshot,
  RoomSummary,
  SeatInfo,
} from '@/lib/realtime/protocol';
import type { ActiveGame, Room } from './model';

export function summarizeRoom(room: Room): RoomSummary {
  const host = room.seats.find((seat) => seat.user.id === room.hostId);
  return {
    id: room.id,
    name: room.name,
    host: host?.user.username ?? '',
    hostColor: room.hostColor,
    hasPassword: room.passwordHash !== null,
    options: room.options,
    status: room.status,
    players: room.seats.map((seat) => seat.user.username),
    spectators: room.spectators.size,
    createdAt: room.createdAt,
  };
}

export function snapshotFor(room: Room, userId: string, now: number): RoomSnapshot {
  const isPlayer = room.seats.some((seat) => seat.user.id === userId);
  const color = room.game ? colorOf(room.game, userId) : null;
  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    hostColor: room.hostColor,
    status: room.status,
    options: room.options,
    hasPassword: room.passwordHash !== null,
    you: { userId, role: isPlayer ? 'player' : 'spectator', color },
    seats: room.seats.map((seat) => ({
      userId: seat.user.id,
      username: seat.user.username,
      connected: seat.connected,
    })),
    spectators: room.spectators.size,
    game: room.game ? gameSnapshot(room, room.game, color) : null,
    rematch: room.rematch
      ? { deadline: room.rematch.deadline, votes: Object.fromEntries(room.rematch.votes) }
      : null,
    serverTime: now,
  };
}

function gameSnapshot(room: Room, game: ActiveGame, viewerColor: PlayerColor | null): GameSnapshot {
  const view: GameView = {
    ...viewFor(game.state, viewerColor ?? 'spectator'),
    result: game.result,
  };
  const players = Object.fromEntries(
    PLAYER_COLORS.map((color) => {
      const { user, pack } = game.players[color];
      const seat = room.seats.find((candidate) => candidate.user.id === user.id);
      const info: SeatInfo = {
        userId: user.id,
        username: user.username,
        connected: seat?.connected ?? false,
      };
      return [color, { ...info, pack }];
    }),
  ) as GameSnapshot['players'];

  return {
    view,
    players,
    cards: visibleCards(view, game.faces),
    firstPlayer: { color: game.firstPlayer, reason: game.firstPlayerReason },
    match: matchSnapshot(room, game),
    lastMove: game.lastMove,
    turnDeadline: game.turnDeadline,
    paused: game.paused
      ? {
          username: usernameOf(game, game.paused.userId),
          forfeitAt: game.paused.forfeitAt,
        }
      : null,
    forfeit: game.forfeit,
    outcome: game.outcome,
  };
}

/** Display data for cards on the board and in hands the viewer may see. Hidden cards stay hidden. */
function visibleCards(
  view: GameView,
  faces: ReadonlyMap<string, CardInfo>,
): Record<string, CardInfo> {
  const ids = new Set<string>();
  for (const cell of view.board) if (cell.placed) ids.add(cell.placed.card.id);
  for (const color of PLAYER_COLORS) {
    for (const card of view.players[color].hand.cards ?? []) ids.add(card.card.id);
  }

  const cards: Record<string, CardInfo> = {};
  for (const id of ids) {
    const face = faces.get(id);
    if (face) cards[id] = face;
  }
  return cards;
}

export function colorOf(game: ActiveGame, userId: string): PlayerColor | null {
  return PLAYER_COLORS.find((color) => game.players[color].user.id === userId) ?? null;
}

function usernameOf(game: ActiveGame, userId: string): string {
  const color = colorOf(game, userId);
  return color ? game.players[color].user.username : '';
}

function matchSnapshot(room: Room, game: ActiveGame): MatchSnapshot {
  const match = room.match;
  const cardsLeft = Object.fromEntries(
    PLAYER_COLORS.map((color) => {
      const deck = match?.decks.get(game.players[color].user.id) ?? [];
      const placedThisRound = game.result === null ? game.state.players[color].placedCount : 0;
      return [color, deck.length - placedThisRound];
    }),
  ) as MatchSnapshot['cardsLeft'];
  const roundResults = (match?.roundResults ?? []).map((r) => ({
    winner: r.winner,
    score: r.score,
  }));
  const seriesScore = { red: 0, blue: 0 };
  for (const r of roundResults) {
    if (r.winner === 'red') seriesScore.red++;
    else if (r.winner === 'blue') seriesScore.blue++;
  }
  return {
    format: room.options.format,
    round: match?.round ?? 1,
    roundResults,
    seriesScore,
    nextRoundAt: match?.nextRoundAt ?? null,
    cardsLeft,
  };
}
