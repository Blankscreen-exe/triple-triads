/**
 * The real-time protocol between browsers and the game server (Socket.IO).
 *
 * Shared by both sides: the server validates every incoming payload with these schemas, and the
 * client uses the same types, so a protocol change is a compile error on both ends.
 */
import {
  ELEMENTAL_MODES,
  type CaptureEvent,
  type GameView,
  type PlayerColor,
  type Position,
  type RuleSet,
} from '@triple-triad/engine';
import { z } from 'zod';
import type { AssetPack } from '../asset-packs';
import type { DescribableCard } from '../describe-card';

// ---- Room options ----------------------------------------------------------------------------

export const TURN_TIMER_OPTIONS = [30, 60, null] as const;
export type TurnSeconds = (typeof TURN_TIMER_OPTIONS)[number];

/** How long a disconnected player has to come back before forfeiting. */
export const RECONNECT_GRACE_MS = 2 * 60 * 1000;
/** How long the continue/leave vote after a game stays open. */
export const REMATCH_VOTE_MS = 30 * 1000;

export const ROOM_NAME_MAX_LENGTH = 40;
export const ROOM_PASSWORD_MAX_LENGTH = 64;

export const ruleSetSchema = z.object({
  open: z.boolean(),
  same: z.boolean(),
  plus: z.boolean(),
  combo: z.boolean(),
  sameWall: z.boolean(),
  elemental: z.enum(ELEMENTAL_MODES),
}) satisfies z.ZodType<RuleSet>;

export const roomOptionsSchema = z.object({
  rules: ruleSetSchema,
  turnSeconds: z.union([z.literal(30), z.literal(60), z.null()]),
  allowSpectators: z.boolean(),
});
export type RoomOptions = z.infer<typeof roomOptionsSchema>;

// ---- Client → server payloads -----------------------------------------------------------------

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, 'Give the room a name.').max(ROOM_NAME_MAX_LENGTH),
  /** Empty means no password. */
  password: z.string().max(ROOM_PASSWORD_MAX_LENGTH),
  options: roomOptionsSchema,
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(64),
  password: z.string().max(ROOM_PASSWORD_MAX_LENGTH),
  as: z.enum(['player', 'spectator']),
});
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export const roomIdSchema = z.object({ roomId: z.string().min(1).max(64) });

export const moveSchema = z.object({
  roomId: z.string().min(1).max(64),
  instanceId: z.string().min(1).max(64),
  position: z.number().int().min(0).max(8),
});
export type MoveInput = z.infer<typeof moveSchema>;

export const VOTE_CHOICES = ['continue', 'leave'] as const;
export type VoteChoice = (typeof VOTE_CHOICES)[number];

export const voteSchema = z.object({
  roomId: z.string().min(1).max(64),
  choice: z.enum(VOTE_CHOICES),
});

// ---- Server → client data ---------------------------------------------------------------------

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface RoomSummary {
  readonly id: string;
  readonly name: string;
  readonly host: string;
  readonly hasPassword: boolean;
  readonly options: RoomOptions;
  readonly status: RoomStatus;
  readonly players: readonly string[];
  readonly spectators: number;
}

export interface SeatInfo {
  readonly userId: string;
  readonly username: string;
  readonly connected: boolean;
}

/** Display data for a card id that is visible to the viewer. */
export interface CardInfo extends DescribableCard {
  readonly artUrl: string | null;
}

export interface PlayerOutcome {
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  /** Positive for a win streak, negative for a loss streak. */
  readonly streak: number;
}

/** Rating and streak changes from a finished game. */
export type MatchOutcome = Readonly<Record<PlayerColor, PlayerOutcome>>;

export interface GameSnapshot {
  readonly view: GameView;
  readonly players: Readonly<Record<PlayerColor, SeatInfo & { readonly pack: AssetPack }>>;
  /** Names, stars and art for every card the viewer can currently see, by card id. */
  readonly cards: Readonly<Record<string, CardInfo>>;
  readonly lastMove: {
    readonly player: PlayerColor;
    readonly position: Position;
    readonly captures: readonly CaptureEvent[];
    readonly timedOut: boolean;
  } | null;
  /** When the active player's turn ends (server clock, ms), or null without a timer or while paused. */
  readonly turnDeadline: number | null;
  /** Set while the game waits for a disconnected player. */
  readonly paused: { readonly username: string; readonly forfeitAt: number } | null;
  /** True when the result came from a forfeit (leaving or not reconnecting in time). */
  readonly forfeit: boolean;
  /** Rating changes once the game is over and recorded; null before that. */
  readonly outcome: MatchOutcome | null;
}

export interface RematchSnapshot {
  readonly deadline: number;
  readonly votes: Readonly<Record<string, VoteChoice | null>>;
}

export interface RoomSnapshot {
  readonly id: string;
  readonly name: string;
  readonly hostId: string;
  readonly status: RoomStatus;
  readonly options: RoomOptions;
  readonly hasPassword: boolean;
  readonly you: {
    readonly userId: string;
    readonly role: 'player' | 'spectator';
    readonly color: PlayerColor | null;
  };
  readonly seats: readonly SeatInfo[];
  readonly spectators: number;
  readonly game: GameSnapshot | null;
  readonly rematch: RematchSnapshot | null;
  /** The server's clock when the snapshot was sent, to correct for client clock skew. */
  readonly serverTime: number;
}

// ---- Errors ---------------------------------------------------------------------------------

export const ROOM_ERRORS = {
  ROOM_NOT_FOUND: 'That room no longer exists.',
  ROOM_FULL: 'That room already has two players.',
  WRONG_PASSWORD: 'Wrong room password.',
  SPECTATORS_NOT_ALLOWED: 'This room does not allow spectators.',
  ALREADY_IN_A_ROOM: 'You are already playing in another room.',
  NO_ACTIVE_DECK: 'Choose an active deck first.',
  INVALID_DECK: 'Your active deck breaks the deck rules. Fix it on the Decks page.',
  NOT_A_PLAYER: 'Only players can do that.',
  NOT_PLAYING: 'There is no game in progress.',
  NOT_YOUR_TURN: 'It is not your turn.',
  ILLEGAL_MOVE: 'That move is not allowed.',
  NO_VOTE_OPEN: 'There is no rematch vote right now.',
  INVALID_INPUT: 'Invalid request.',
  SERVER_ERROR: 'Something went wrong. Please try again.',
  UNAUTHENTICATED: 'Your session has ended. Please log in again.',
} as const;
export type RoomError = keyof typeof ROOM_ERRORS;

/** Reply to a client request. */
export type Ack<T = null> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: RoomError };

// ---- Socket.IO event maps -------------------------------------------------------------------

export interface ClientToServerEvents {
  'lobby:subscribe': () => void;
  'lobby:unsubscribe': () => void;
  'room:create': (input: CreateRoomInput, ack: (result: Ack<{ roomId: string }>) => void) => void;
  'room:join': (input: JoinRoomInput, ack: (result: Ack) => void) => void;
  'room:leave': (input: { roomId: string }, ack: (result: Ack) => void) => void;
  'game:move': (input: MoveInput, ack: (result: Ack) => void) => void;
  'game:vote': (input: { roomId: string; choice: VoteChoice }, ack: (result: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'lobby:rooms': (rooms: readonly RoomSummary[]) => void;
  'room:state': (snapshot: RoomSnapshot) => void;
  /** You are no longer in this room: you left (perhaps in another tab) or it closed. */
  'room:closed': (event: { roomId: string }) => void;
}
