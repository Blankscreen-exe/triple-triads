/**
 * Game lifecycle: setup, turns, moves and the end-of-game result.
 *
 * Turn structure (design/SPEC.md, section 9): each player draws an initial hand, then on every
 * turn the active player draws one card and places one card. Red always moves first.
 */
import { POSITIONS, type Position } from './board';
import { resolveCaptures } from './capture';
import { Rng } from './rng';
import {
  CARDS_DRAWN_PER_TURN,
  INITIAL_HAND_SIZE,
  MAX_NORMAL_ELEMENTAL_CELLS,
  MIN_CARDS_PER_GAME,
  STARTING_SCORE,
  type RuleSet,
} from './rules';
import type {
  Board,
  CaptureEvent,
  CardInstance,
  Cell,
  GameResult,
  GameState,
  Move,
  PlayerState,
  Score,
} from './state';
import {
  ELEMENTS,
  PLAYER_COLORS,
  opponentOf,
  type CardDefinition,
  type Element,
  type PlayerColor,
} from './types';

export interface NewGameOptions {
  readonly rules: RuleSet;
  /** Each player's deck, in any order; it is shuffled during setup. */
  readonly decks: Readonly<Record<PlayerColor, readonly CardDefinition[]>>;
  /** Seed for every random decision in this game (shuffles, elemental squares, timeouts). */
  readonly seed: number;
}

export function createGame({ rules, decks, seed }: NewGameOptions): GameState {
  for (const color of PLAYER_COLORS) {
    if (decks[color].length < MIN_CARDS_PER_GAME) {
      throw new RangeError(
        `The ${color} deck has ${String(decks[color].length)} cards; at least ${String(MIN_CARDS_PER_GAME)} are needed`,
      );
    }
  }

  const rng = new Rng(seed);
  const board = createBoard(rules, rng);
  const players = {
    red: dealPlayer('red', decks.red, rng),
    blue: dealPlayer('blue', decks.blue, rng),
  };

  return beginTurn({
    rules,
    board,
    players,
    activePlayer: 'red',
    turn: 1,
    rngState: rng.state,
    result: null,
  });
}

export type MoveError =
  'GAME_OVER' | 'NOT_YOUR_TURN' | 'CARD_NOT_IN_HAND' | 'INVALID_POSITION' | 'CELL_OCCUPIED';

export type MoveResult =
  | { readonly ok: true; readonly state: GameState; readonly captures: readonly CaptureEvent[] }
  | { readonly ok: false; readonly error: MoveError };

export function applyMove(state: GameState, move: Move): MoveResult {
  const error = validateMove(state, move);
  if (error !== null) return { ok: false, error };

  const player = state.players[move.player];
  const instance = player.hand.find((card) => card.instanceId === move.instanceId);
  const target = state.board[move.position];
  if (instance === undefined || target === undefined) {
    // Unreachable: validateMove already checked both.
    throw new Error('Move passed validation but references missing data');
  }

  const board = state.board.map((cell, index): Cell =>
    index === move.position
      ? { ...cell, placed: { ...instance, owner: move.player, controller: move.player } }
      : cell,
  );
  const { board: resolvedBoard, captures } = resolveCaptures(board, move.position, state.rules);

  const placed: GameState = {
    ...state,
    board: resolvedBoard,
    players: {
      ...state.players,
      [move.player]: {
        ...player,
        hand: player.hand.filter((card) => card.instanceId !== move.instanceId),
        placedCount: player.placedCount + 1,
      },
    },
  };

  if (isBoardFull(placed.board)) {
    return { ok: true, state: { ...placed, result: computeResult(placed) }, captures };
  }

  const next = beginTurn({
    ...placed,
    activePlayer: opponentOf(move.player),
    turn: state.turn + 1,
  });
  return { ok: true, state: next, captures };
}

export function validateMove(state: GameState, move: Move): MoveError | null {
  if (state.result !== null) return 'GAME_OVER';
  if (move.player !== state.activePlayer) return 'NOT_YOUR_TURN';
  if (!state.players[move.player].hand.some((card) => card.instanceId === move.instanceId)) {
    return 'CARD_NOT_IN_HAND';
  }
  const cell = state.board[move.position];
  if (cell === undefined) return 'INVALID_POSITION';
  if (cell.placed !== null) return 'CELL_OCCUPIED';
  return null;
}

/** Every legal move for the active player. Empty once the game is over. */
export function legalMoves(state: GameState): Move[] {
  if (state.result !== null) return [];
  const player = state.activePlayer;
  const empty = emptyPositions(state.board);
  return state.players[player].hand.flatMap((card) =>
    empty.map((position) => ({ player, instanceId: card.instanceId, position })),
  );
}

/**
 * Plays a random card from the active player's hand on a random empty square.
 * Used when a player's turn timer runs out. Deterministic for a given state.
 */
export function playRandomMove(state: GameState): MoveResult {
  if (state.result !== null) return { ok: false, error: 'GAME_OVER' };

  const rng = new Rng(state.rngState);
  const card = rng.pick(state.players[state.activePlayer].hand);
  const position = rng.pick(emptyPositions(state.board));
  return applyMove(
    { ...state, rngState: rng.state },
    { player: state.activePlayer, instanceId: card.instanceId, position },
  );
}

/**
 * Live score. Each player starts with {@link STARTING_SCORE} points and every capture moves one
 * point. Equivalently: cards controlled on the board plus cards not yet placed. When the board is
 * full this gives the second player +1, standing in for FF8's unplayed tenth card.
 */
export function computeScore(state: Pick<GameState, 'board' | 'players'>): Score {
  const scoreOf = (color: PlayerColor): number => {
    const controlled = state.board.filter((cell) => cell.placed?.controller === color).length;
    return controlled + STARTING_SCORE - state.players[color].placedCount;
  };
  return { red: scoreOf('red'), blue: scoreOf('blue') };
}

function computeResult(state: GameState): GameResult {
  const score = computeScore(state);
  const winner = score.red === score.blue ? null : score.red > score.blue ? 'red' : 'blue';
  return { winner, score };
}

/** Starts the active player's turn by drawing their card(s) for the turn. */
function beginTurn(state: GameState): GameState {
  const color = state.activePlayer;
  return {
    ...state,
    players: { ...state.players, [color]: draw(state.players[color], CARDS_DRAWN_PER_TURN) },
  };
}

function dealPlayer(color: PlayerColor, deck: readonly CardDefinition[], rng: Rng): PlayerState {
  const instances = deck.map((card, index): CardInstance => ({
    instanceId: `${color}-${String(index)}`,
    card,
  }));
  return draw({ drawPile: rng.shuffle(instances), hand: [], placedCount: 0 }, INITIAL_HAND_SIZE);
}

function draw(player: PlayerState, count: number): PlayerState {
  return {
    ...player,
    hand: [...player.hand, ...player.drawPile.slice(0, count)],
    drawPile: player.drawPile.slice(count),
  };
}

function createBoard(rules: RuleSet, rng: Rng): Board {
  const elements = new Map<Position, Element>();
  const elementalPositions =
    rules.elemental === 'all'
      ? POSITIONS
      : rules.elemental === 'normal'
        ? rng.shuffle(POSITIONS).slice(0, rng.int(0, MAX_NORMAL_ELEMENTAL_CELLS))
        : [];
  for (const position of elementalPositions) {
    elements.set(position, rng.pick(ELEMENTS));
  }
  return POSITIONS.map((position) => ({ element: elements.get(position) ?? null, placed: null }));
}

function emptyPositions(board: Board): Position[] {
  return POSITIONS.filter((position) => board[position]?.placed === null);
}

function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell.placed !== null);
}
