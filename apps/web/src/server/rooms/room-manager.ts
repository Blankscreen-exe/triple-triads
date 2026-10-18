/**
 * Rooms and live games (design/SPEC.md, sections 8 and 9).
 *
 * The manager owns all room state and timers. It never talks to sockets directly: it reports
 * changes through `RoomEvents`, and the socket layer turns those into personalised snapshots.
 * Clock, randomness and deck loading are injected so the game flow can be tested
 * deterministically.
 */
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  POSITIONS,
  applyMove,
  computeScore,
  createGame,
  opponentOf,
  playRandomMove,
  type Board,
  type CaptureEvent,
  type GameResult,
  type GameState,
  type PlayerColor,
  type Position,
} from '@triple-triad/engine';
import { DEFAULT_ASSET_PACK, type AssetPack } from '@/lib/asset-packs';
import {
  RECONNECT_GRACE_MS,
  REMATCH_VOTE_MS,
  type Ack,
  type CardInfo,
  type CreateRoomInput,
  type JoinRoomInput,
  type MatchOutcome,
  type MoveInput,
  type RoomError,
  type RoomSnapshot,
  type RoomSummary,
  type VoteChoice,
} from '@/lib/realtime/protocol';
import { DEFAULT_ROOM_POLICY, applyRoomPolicy, type RoomPolicy } from '@/lib/validation/settings';
import type { DeckProvider } from './game-decks';
import type { ActiveGame, FinishedGame, Room, RoomUser, Seat } from './model';
import { colorOf, snapshotFor, summarizeRoom } from './snapshot';

export interface RoomEvents {
  /** Participants of the room should receive a fresh snapshot. */
  roomChanged(roomId: string): void;
  /** The room no longer exists. */
  roomClosed(roomId: string): void;
  /** The lobby list changed. */
  lobbyChanged(): void;
}

export interface RoomManagerDeps {
  readonly decks: DeckProvider;
  readonly events: RoomEvents;
  /**
   * Called once per finished game, e.g. to record it and update ratings. The returned outcome
   * (rating changes) is shown to the players.
   */
  readonly onGameFinished?: (game: FinishedGame) => MatchOutcome | undefined;
  readonly now?: () => number;
  /** Coin flip: returns true when the first-seated player goes first. */
  readonly coinFlip?: () => boolean;
  readonly newSeed?: () => number;
  readonly newRoomId?: () => string;
  readonly packFor?: (userId: string) => AssetPack;
  /** The admin's room policy: defaults and locked options (read on each room creation). */
  readonly roomPolicy?: () => RoomPolicy;
  /** How long a disconnected player has to come back (spec: 2 minutes). */
  readonly reconnectGraceMs?: number;
  /** How long the rematch vote stays open (spec: 30 seconds). */
  readonly rematchVoteMs?: number;
}

type Result<T = null> = Ack<T>;

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: RoomError): { ok: false; error: RoomError } => ({ ok: false, error });

export class RoomManager {
  readonly #rooms = new Map<string, Room>();
  /** The room each user is seated in (a user can play in one room at a time). */
  readonly #playerRoom = new Map<string, string>();
  readonly #deps: Required<Omit<RoomManagerDeps, 'onGameFinished'>> &
    Pick<RoomManagerDeps, 'onGameFinished'>;

  constructor(deps: RoomManagerDeps) {
    this.#deps = {
      now: () => Date.now(),
      coinFlip: () => randomInt(2) === 0,
      newSeed: () => randomInt(2 ** 32 - 1),
      newRoomId: () => randomUUID(),
      packFor: () => DEFAULT_ASSET_PACK,
      roomPolicy: () => DEFAULT_ROOM_POLICY,
      reconnectGraceMs: RECONNECT_GRACE_MS,
      rematchVoteMs: REMATCH_VOTE_MS,
      ...deps,
    };
  }

  // ---- Queries -------------------------------------------------------------------------------

  listRooms(): RoomSummary[] {
    return [...this.#rooms.values()].sort((a, b) => a.createdAt - b.createdAt).map(summarizeRoom);
  }

  snapshot(roomId: string, userId: string): RoomSnapshot | null {
    const room = this.#rooms.get(roomId);
    return room ? snapshotFor(room, userId, this.#deps.now()) : null;
  }

  /** Everyone who should receive this room's snapshots. */
  participants(roomId: string): string[] {
    const room = this.#rooms.get(roomId);
    if (!room) return [];
    return [...room.seats.map((seat) => seat.user.id), ...room.spectators.keys()];
  }

  roomOfPlayer(userId: string): string | null {
    return this.#playerRoom.get(userId) ?? null;
  }

  // ---- Commands ------------------------------------------------------------------------------

  createRoom(user: RoomUser, input: CreateRoomInput): Result<{ roomId: string }> {
    if (this.#playerRoom.has(user.id)) return fail('ALREADY_IN_A_ROOM');
    const seat = this.#createSeat(user);
    if (!seat.ok) return seat;

    const room: Room = {
      id: this.#deps.newRoomId(),
      name: input.name.trim(),
      passwordHash: input.password ? hashPassword(input.password) : null,
      options: applyRoomPolicy(input.options, this.#deps.roomPolicy()),
      createdAt: this.#deps.now(),
      hostId: user.id,
      seats: [seat.data],
      spectators: new Map(),
      status: 'waiting',
      game: null,
      rematch: null,
      timers: { turn: null, rematch: null, reconnect: new Map() },
    };
    this.#rooms.set(room.id, room);
    this.#playerRoom.set(user.id, room.id);
    this.#deps.events.lobbyChanged();
    return ok({ roomId: room.id });
  }

  /** Joins as a player or spectator. A player already seated here is simply reconnected. */
  joinRoom(user: RoomUser, input: JoinRoomInput): Result {
    const room = this.#rooms.get(input.roomId);
    if (!room) return fail('ROOM_NOT_FOUND');

    if (room.seats.some((seat) => seat.user.id === user.id)) {
      this.#markConnected(room, user.id);
      this.#changed(room);
      return ok(null);
    }
    if (input.as === 'spectator' && room.spectators.has(user.id)) return ok(null);
    if (room.passwordHash !== null && !passwordMatches(room.passwordHash, input.password)) {
      return fail('WRONG_PASSWORD');
    }

    if (input.as === 'spectator') {
      if (!room.options.allowSpectators) return fail('SPECTATORS_NOT_ALLOWED');
      room.spectators.set(user.id, user);
      this.#changed(room, { lobby: true });
      return ok(null);
    }

    if (room.seats.length >= 2) return fail('ROOM_FULL');
    if (this.#playerRoom.has(user.id)) return fail('ALREADY_IN_A_ROOM');
    const seat = this.#createSeat(user);
    if (!seat.ok) return seat;

    room.seats.push(seat.data);
    room.spectators.delete(user.id);
    this.#playerRoom.set(user.id, room.id);

    const [first, second] = room.seats;
    if (first && second) {
      // A new pairing: the coin flip decides who goes first (design/SPEC.md, 9.1).
      this.#startGame(room, this.#deps.coinFlip() ? first.user.id : second.user.id);
    }
    this.#changed(room, { lobby: true });
    return ok(null);
  }

  /** Leaves the room. Leaving a game in progress forfeits it. */
  leaveRoom(userId: string, roomId: string): Result {
    const room = this.#rooms.get(roomId);
    if (!room) return fail('ROOM_NOT_FOUND');

    if (room.spectators.delete(userId)) {
      this.#changed(room, { lobby: true });
      return ok(null);
    }
    if (room.seats.some((seat) => seat.user.id === userId)) this.#removeSeat(room, userId);
    return ok(null);
  }

  /** The user has no open connection to the room any more. */
  disconnected(userId: string, roomId: string): void {
    const room = this.#rooms.get(roomId);
    if (!room) return;

    if (room.spectators.delete(userId)) {
      this.#changed(room, { lobby: true });
      return;
    }
    const seat = room.seats.find((candidate) => candidate.user.id === userId);
    if (!seat?.connected) return;

    seat.connected = false;
    const now = this.#deps.now();
    const forfeitAt = now + this.#deps.reconnectGraceMs;
    seat.awayUntil = forfeitAt;
    room.timers.reconnect.set(
      userId,
      setTimeout(() => {
        room.timers.reconnect.delete(userId);
        this.#removeSeat(room, userId);
      }, this.#deps.reconnectGraceMs),
    );

    const game = room.game;
    if (room.status === 'playing' && game && !game.paused) {
      game.pausedTurnRemaining = game.turnDeadline === null ? null : game.turnDeadline - now;
      game.turnDeadline = null;
      game.paused = { userId, forfeitAt };
      this.#clearTurnTimer(room);
    }
    this.#changed(room);
  }

  playMove(userId: string, input: MoveInput): Result {
    const room = this.#rooms.get(input.roomId);
    if (!room) return fail('ROOM_NOT_FOUND');
    const game = room.game;
    if (room.status !== 'playing' || !game || game.paused) return fail('NOT_PLAYING');

    const color = colorOf(game, userId);
    if (!color) return fail('NOT_A_PLAYER');
    if (game.state.activePlayer !== color) return fail('NOT_YOUR_TURN');

    const result = applyMove(game.state, {
      player: color,
      instanceId: input.instanceId,
      position: input.position as Position,
    });
    if (!result.ok) return fail('ILLEGAL_MOVE');

    this.#afterMove(
      room,
      game,
      { player: color, position: input.position as Position, ...result },
      false,
    );
    return ok(null);
  }

  vote(userId: string, roomId: string, choice: VoteChoice): Result {
    const room = this.#rooms.get(roomId);
    if (!room) return fail('ROOM_NOT_FOUND');
    const rematch = room.rematch;
    if (!rematch) return fail('NO_VOTE_OPEN');
    if (!rematch.votes.has(userId)) return fail('NOT_A_PLAYER');

    if (choice === 'leave') {
      this.#removeSeat(room, userId);
      return ok(null);
    }

    rematch.votes.set(userId, 'continue');
    if ([...rematch.votes.values()].every((vote) => vote === 'continue')) {
      this.#clearTimer(room, 'rematch');
      this.#startGame(room, rematch.nextFirstPlayerId);
      this.#changed(room, { lobby: true });
    } else {
      this.#changed(room);
    }
    return ok(null);
  }

  /** Stops every timer (server shutdown). */
  dispose(): void {
    for (const room of this.#rooms.values()) this.#clearAllTimers(room);
  }

  // ---- Internals -----------------------------------------------------------------------------

  #createSeat(user: RoomUser): Result<Seat> {
    const deck = this.#deps.decks.loadActiveDeck(user.id);
    if (!deck.ok) return fail(deck.error);
    return ok({
      user,
      deck: deck.deck,
      pack: this.#deps.packFor(user.id),
      connected: true,
      awayUntil: null,
    });
  }

  #startGame(room: Room, firstPlayerId: string): void {
    const red = room.seats.find((seat) => seat.user.id === firstPlayerId);
    const blue = room.seats.find((seat) => seat.user.id !== firstPlayerId);
    if (!red || !blue) throw new Error('A game needs two seated players');

    const faces = new Map<string, CardInfo>([...red.deck.faces, ...blue.deck.faces]);
    room.game = {
      state: createGame({
        rules: room.options.rules,
        decks: { red: red.deck.cards, blue: blue.deck.cards },
        seed: this.#deps.newSeed(),
      }),
      players: {
        red: { user: red.user, pack: red.pack },
        blue: { user: blue.user, pack: blue.pack },
      },
      faces,
      lastMove: null,
      turnDeadline: null,
      pausedTurnRemaining: null,
      paused: null,
      result: null,
      forfeit: false,
      outcome: null,
    };
    room.status = 'playing';
    room.rematch = null;
    this.#startTurnTimer(room);
  }

  #afterMove(
    room: Room,
    game: ActiveGame,
    move: {
      player: PlayerColor;
      position: Position;
      state: GameState;
      captures: readonly CaptureEvent[];
    },
    timedOut: boolean,
  ): void {
    game.state = move.state;
    game.lastMove = {
      player: move.player,
      position: move.position,
      captures: move.captures,
      timedOut,
    };
    if (move.state.result) {
      this.#finishGame(room, move.state.result, false);
    } else {
      this.#startTurnTimer(room);
    }
    this.#changed(room);
  }

  #onTurnTimeout(room: Room): void {
    room.timers.turn = null;
    const game = room.game;
    if (room.status !== 'playing' || !game || game.paused) return;

    const before = game.state;
    const result = playRandomMove(before);
    if (!result.ok) return;
    this.#afterMove(
      room,
      game,
      {
        player: before.activePlayer,
        position: placedPosition(before.board, result.state.board),
        ...result,
      },
      true,
    );
  }

  #finishGame(room: Room, result: GameResult, forfeit: boolean): void {
    const game = room.game;
    if (!game) return;
    this.#clearTurnTimer(room);
    game.result = result;
    game.forfeit = forfeit;
    game.turnDeadline = null;
    game.paused = null;
    game.pausedTurnRemaining = null;
    room.status = 'finished';

    game.outcome =
      this.#deps.onGameFinished?.({
        roomId: room.id,
        players: { red: game.players.red.user, blue: game.players.blue.user },
        result,
        forfeit,
      }) ?? null;

    if (!forfeit && room.seats.length === 2) {
      // Loser goes first next time; after a draw the order stays the same (spec 9.7).
      const nextFirst = result.winner ? opponentOf(result.winner) : 'red';
      room.rematch = {
        deadline: this.#deps.now() + this.#deps.rematchVoteMs,
        votes: new Map(room.seats.map((seat) => [seat.user.id, null])),
        nextFirstPlayerId: game.players[nextFirst].user.id,
      };
      room.timers.rematch = setTimeout(() => {
        room.timers.rematch = null;
        this.#onRematchTimeout(room);
      }, this.#deps.rematchVoteMs);
    }
  }

  #onRematchTimeout(room: Room): void {
    const rematch = room.rematch;
    if (!rematch) return;
    // No vote counts as leaving (spec 9.7).
    for (const [userId, vote] of [...rematch.votes]) {
      if (vote !== 'continue') this.#removeSeat(room, userId);
    }
  }

  #removeSeat(room: Room, userId: string): void {
    const timer = room.timers.reconnect.get(userId);
    if (timer) clearTimeout(timer);
    room.timers.reconnect.delete(userId);

    const game = room.game;
    if (room.status === 'playing' && game) {
      const color = colorOf(game, userId);
      if (color) {
        this.#finishGame(
          room,
          { winner: opponentOf(color), score: computeScore(game.state) },
          true,
        );
      }
    }
    if (room.rematch) {
      this.#clearTimer(room, 'rematch');
      room.rematch = null;
    }

    room.seats = room.seats.filter((seat) => seat.user.id !== userId);
    this.#playerRoom.delete(userId);

    const [remaining] = room.seats;
    if (!remaining) {
      this.#closeRoom(room);
      return;
    }
    if (room.hostId === userId) room.hostId = remaining.user.id;
    room.status = 'waiting';
    this.#changed(room, { lobby: true });
  }

  #markConnected(room: Room, userId: string): void {
    const seat = room.seats.find((candidate) => candidate.user.id === userId);
    if (!seat) return;
    seat.connected = true;
    seat.awayUntil = null;
    const timer = room.timers.reconnect.get(userId);
    if (timer) clearTimeout(timer);
    room.timers.reconnect.delete(userId);

    const game = room.game;
    if (game?.paused?.userId === userId) {
      const remaining = game.pausedTurnRemaining;
      game.paused = null;
      game.pausedTurnRemaining = null;
      // Another player may still be away; their pause takes over.
      const stillAway = room.seats.find((other) => other.awayUntil !== null);
      if (stillAway?.awayUntil) {
        game.paused = { userId: stillAway.user.id, forfeitAt: stillAway.awayUntil };
        game.pausedTurnRemaining = remaining;
      } else {
        this.#startTurnTimer(room, remaining ?? undefined);
      }
    }
  }

  #startTurnTimer(room: Room, durationMs?: number): void {
    this.#clearTurnTimer(room);
    const game = room.game;
    const seconds = room.options.turnSeconds;
    if (!game) return;
    if (seconds === null) {
      game.turnDeadline = null;
      return;
    }
    const duration = durationMs ?? seconds * 1000;
    game.turnDeadline = this.#deps.now() + duration;
    room.timers.turn = setTimeout(() => {
      this.#onTurnTimeout(room);
    }, duration);
  }

  #clearTurnTimer(room: Room): void {
    this.#clearTimer(room, 'turn');
  }

  #clearTimer(room: Room, which: 'turn' | 'rematch'): void {
    const timer = room.timers[which];
    if (timer) clearTimeout(timer);
    room.timers[which] = null;
  }

  #clearAllTimers(room: Room): void {
    this.#clearTimer(room, 'turn');
    this.#clearTimer(room, 'rematch');
    for (const timer of room.timers.reconnect.values()) clearTimeout(timer);
    room.timers.reconnect.clear();
  }

  #closeRoom(room: Room): void {
    this.#clearAllTimers(room);
    for (const seat of room.seats) this.#playerRoom.delete(seat.user.id);
    this.#rooms.delete(room.id);
    this.#deps.events.roomClosed(room.id);
    this.#deps.events.lobbyChanged();
  }

  #changed(room: Room, { lobby = false } = {}): void {
    this.#deps.events.roomChanged(room.id);
    if (lobby) this.#deps.events.lobbyChanged();
  }
}

/** The position where a card was just placed. */
function placedPosition(before: Board, after: Board): Position {
  const position = POSITIONS.find((p) => before[p]?.placed === null && after[p]?.placed !== null);
  if (position === undefined) throw new Error('No newly placed card found');
  return position;
}

// Room passwords live only in memory for the room's lifetime; a fast hash compared in constant
// time is enough to avoid keeping them in plain text.
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function passwordMatches(hash: string, password: string): boolean {
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashPassword(password), 'hex'));
}
