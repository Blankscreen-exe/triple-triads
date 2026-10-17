/**
 * What each participant is allowed to see. The server sends views, never the full state, so a
 * modified client cannot read the opponent's hand or either draw pile.
 */
import { computeScore } from './game';
import type { RuleSet } from './rules';
import type { Board, CardInstance, GameResult, GameState, Score } from './state';
import { PLAYER_COLORS, type PlayerColor } from './types';

export type Viewer = PlayerColor | 'spectator';

export interface HandView {
  readonly size: number;
  /** `null` when the hand is hidden from this viewer. */
  readonly cards: readonly CardInstance[] | null;
}

export interface PlayerSideView {
  readonly hand: HandView;
  readonly drawPileSize: number;
}

export interface GameView {
  readonly viewer: Viewer;
  readonly rules: RuleSet;
  readonly board: Board;
  readonly players: Readonly<Record<PlayerColor, PlayerSideView>>;
  readonly activePlayer: PlayerColor;
  readonly turn: number;
  readonly score: Score;
  readonly result: GameResult | null;
}

export function viewFor(state: GameState, viewer: Viewer): GameView {
  const sideView = (color: PlayerColor): PlayerSideView => {
    const { hand, drawPile } = state.players[color];
    const visible = state.rules.open || viewer === color;
    return {
      hand: { size: hand.length, cards: visible ? hand : null },
      drawPileSize: drawPile.length,
    };
  };

  const [red, blue] = PLAYER_COLORS.map(sideView) as [PlayerSideView, PlayerSideView];
  return {
    viewer,
    rules: state.rules,
    board: state.board,
    players: { red, blue },
    activePlayer: state.activePlayer,
    turn: state.turn,
    score: computeScore(state),
    result: state.result,
  };
}
