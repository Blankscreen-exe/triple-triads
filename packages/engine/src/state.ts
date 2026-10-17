/**
 * Game state shapes. All state is plain, immutable, JSON-serializable data so it can be stored,
 * sent over the network and replayed.
 */
import type { Position } from './board';
import type { RuleSet } from './rules';
import type { CardDefinition, Element, PlayerColor } from './types';

/** One physical copy of a card in a game. Decks may contain several copies of one definition. */
export interface CardInstance {
  readonly instanceId: string;
  readonly card: CardDefinition;
}

export interface PlacedCard extends CardInstance {
  /** Whose deck the card came from. Never changes; decides which asset pack draws it. */
  readonly owner: PlayerColor;
  /** Who controls the card right now. Changes on capture; decides the blue/red background. */
  readonly controller: PlayerColor;
}

export interface Cell {
  readonly element: Element | null;
  readonly placed: PlacedCard | null;
}

export type Board = readonly Cell[];

export interface PlayerState {
  /** Remaining cards, top of the pile first. Hidden from both players. */
  readonly drawPile: readonly CardInstance[];
  readonly hand: readonly CardInstance[];
  readonly placedCount: number;
}

export interface Score {
  readonly red: number;
  readonly blue: number;
}

export interface GameResult {
  /** `null` means a draw. */
  readonly winner: PlayerColor | null;
  readonly score: Score;
}

export interface GameState {
  readonly rules: RuleSet;
  readonly board: Board;
  readonly players: Readonly<Record<PlayerColor, PlayerState>>;
  readonly activePlayer: PlayerColor;
  /** 1-based number of the current turn (one placement per turn, nine turns per game). */
  readonly turn: number;
  /** State of the seeded RNG; see `rng.ts`. */
  readonly rngState: number;
  /** Set once all nine squares are filled. */
  readonly result: GameResult | null;
}

export interface Move {
  readonly player: PlayerColor;
  readonly instanceId: string;
  readonly position: Position;
}

/** How a card was captured. Used by the UI to animate and announce captures. */
export type CaptureCause = 'basic' | 'same' | 'plus' | 'combo';

export interface CaptureEvent {
  readonly position: Position;
  readonly cause: CaptureCause;
  readonly from: PlayerColor;
  readonly to: PlayerColor;
  /** 0 for captures made by the placed card itself; 1, 2, … for successive combo waves. */
  readonly wave: number;
}
