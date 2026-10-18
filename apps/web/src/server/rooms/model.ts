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

export interface RoundOutcome {
  readonly winner: PlayerColor | null;
  readonly score: { readonly red: number; readonly blue: number };
}

/** A match: best of 3 rounds (see RoomOptions.format). */
export interface Match {
  /** The round being played, or the one just finished. Starts at 1. */
  round: number;
  /** Who started the first round; starts the next match again if this one is drawn. */
  readonly firstPlayerId: string;
  /** Each player's deck for the rest of the match, by user id: placed cards are used up. */
  readonly decks: Map<string, readonly CardDefinition[]>;
  /** Results of completed rounds. */
  readonly roundResults: RoundOutcome[];
  /** Between rounds: when the next round starts. */
  nextRoundAt: number | null;
  /** Unplaced hand cards from the previous round, by user id (for carryHand mode). */
  readonly carriedHands: Map<string, readonly CardDefinition[]>;
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
  /** The current or most recent round. */
  game: ActiveGame | null;
  /** The current or most recent match; `status` stays `playing` between its rounds. */
  match: Match | null;
  rematch: RematchVote | null;
  readonly timers: {
    turn: NodeJS.Timeout | null;
    rematch: NodeJS.Timeout | null;
    /** The break before the next round of a match. */
    round: NodeJS.Timeout | null;
    readonly reconnect: Map<string, NodeJS.Timeout>;
  };
}

/** Handed to the match recorder when a game ends. */
export interface FinishedGame {
  readonly roomId: string;
  readonly players: Readonly<Record<PlayerColor, RoomUser>>;
  readonly result: GameResult;
  readonly forfeit: boolean;
  /** Rounds played in the match (1 unless rounds were drawn). */
  readonly rounds: number;
}
