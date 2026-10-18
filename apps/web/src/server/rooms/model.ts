/**
 * In-memory room model. Rooms exist only while someone is in them; finished games are handed to
 * the match recorder (see `RoomManagerDeps.onGameFinished`).
 */
import type { CardDefinition, GameResult, GameState, PlayerColor } from '@triple-triad/engine';
import type { AssetPack } from '@/lib/asset-packs';
import type {
  CardInfo,
  FirstPlayerReason,
  GameSnapshot,
  MatchOutcome,
  RoomOptions,
  RoomStatus,
  VoteChoice,
} from '@/lib/realtime/protocol';

export interface RoomUser {
  readonly id: string;
  readonly username: string;
}

/** A player's deck, ready for a game: one definition per copy, plus display data per card id. */
export interface GameDeck {
  readonly cards: readonly CardDefinition[];
  readonly faces: ReadonlyMap<string, CardInfo>;
}

export interface Seat {
  readonly user: RoomUser;
  readonly deck: GameDeck;
  readonly pack: AssetPack;
  connected: boolean;
  /** While disconnected: when the player forfeits their seat if they have not come back. */
  awayUntil: number | null;
}

export interface GamePlayer {
  readonly user: RoomUser;
  readonly pack: AssetPack;
}

export interface ActiveGame {
  state: GameState;
  readonly players: Readonly<Record<PlayerColor, GamePlayer>>;
  readonly firstPlayer: PlayerColor;
  readonly firstPlayerReason: FirstPlayerReason;
  /** Display data for every card in either deck, by card id. */
  readonly faces: ReadonlyMap<string, CardInfo>;
  lastMove: GameSnapshot['lastMove'];
  turnDeadline: number | null;
  /** Time left on the turn timer when the game was paused. */
  pausedTurnRemaining: number | null;
  paused: { readonly userId: string; readonly forfeitAt: number } | null;
  /** Final result; differs from `state.result` when the game ended by forfeit. */
  result: GameResult | null;
  forfeit: boolean;
  outcome: MatchOutcome | null;
}

export interface RematchVote {
  readonly deadline: number;
  readonly votes: Map<string, VoteChoice | null>;
  /** Who goes first if the rematch happens, and why. Colours do not change. */
  readonly nextFirstPlayerId: string;
  readonly nextFirstPlayerReason: FirstPlayerReason;
}

export interface Room {
  readonly id: string;
  readonly name: string;
  readonly passwordHash: string | null;
  readonly options: RoomOptions;
  readonly createdAt: number;
  hostId: string;
  /** Chosen by whoever creates the room; if the host leaves, the next host keeps it. */
  readonly hostColor: PlayerColor;
  /** Up to two players, in the order they joined. */
  seats: Seat[];
  readonly spectators: Map<string, RoomUser>;
  status: RoomStatus;
  /** The current or most recent game. */
  game: ActiveGame | null;
  rematch: RematchVote | null;
  readonly timers: {
    turn: NodeJS.Timeout | null;
    rematch: NodeJS.Timeout | null;
    readonly reconnect: Map<string, NodeJS.Timeout>;
  };
}

/** Handed to the match recorder when a game ends. */
export interface FinishedGame {
  readonly roomId: string;
  readonly players: Readonly<Record<PlayerColor, RoomUser>>;
  readonly result: GameResult;
  readonly forfeit: boolean;
}
