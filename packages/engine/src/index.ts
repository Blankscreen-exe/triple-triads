/**
 * Public API of the Triple Triad rules engine.
 *
 * The engine is pure and deterministic: no I/O, no clocks, no Math.random(). All state is plain
 * data, every function returns new state, and all randomness comes from the seed in the state.
 */
export * from './types';
export { BOARD_WIDTH, CELL_COUNT, POSITIONS, isPosition, neighborOf, type Position } from './board';
export * from './rules';
export type * from './state';
export { effectiveValue, elementalModifier } from './capture';
export {
  applyMove,
  computeScore,
  createGame,
  legalMoves,
  playRandomMove,
  validateMove,
  type MoveError,
  type MoveResult,
  type NewGameOptions,
} from './game';
export { viewFor, type GameView, type HandView, type PlayerSideView, type Viewer } from './view';
export { DEFAULT_SCORING, rankCard, type CardRank, type ScoringConfig } from './stars';
export {
  DEFAULT_DECK_RULES,
  statKey,
  validateDeck,
  type DeckCard,
  type DeckRules,
  type DeckViolation,
} from './deck';
export { Rng } from './rng';
