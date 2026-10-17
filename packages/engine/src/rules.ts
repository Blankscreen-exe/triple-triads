/**
 * Room rule options and fixed game constants.
 */

export const ELEMENTAL_MODES = ['off', 'normal', 'all'] as const;
/**
 * - `off`: no elemental squares.
 * - `normal`: 0 to {@link MAX_NORMAL_ELEMENTAL_CELLS} random squares.
 * - `all`: every square gets an element.
 */
export type ElementalMode = (typeof ELEMENTAL_MODES)[number];

/** Rule options chosen by the room host before the game starts. */
export interface RuleSet {
  /** Both players can see each other's hands. Affects visibility only, not game logic. */
  readonly open: boolean;
  /** Capture when 2+ touching numbers are equal. */
  readonly same: boolean;
  /** Capture when 2+ touching pairs add up to the same sum. */
  readonly plus: boolean;
  /** Cards captured by Same/Plus go on to capture their neighbours with the basic rule, in a chain. */
  readonly combo: boolean;
  /** For the Same rule, board edges count as A (10). Has no effect unless `same` is on. */
  readonly sameWall: boolean;
  readonly elemental: ElementalMode;
}

/** Basic rules only: higher number captures. */
export const BASIC_RULES: RuleSet = {
  open: false,
  same: false,
  plus: false,
  combo: false,
  sameWall: false,
  elemental: 'off',
};

/** Upper bound of elemental squares in `normal` mode. */
export const MAX_NORMAL_ELEMENTAL_CELLS = 3;

/** Cards each player draws before the first turn. */
export const INITIAL_HAND_SIZE = 3;

/** Every turn a player draws this many cards, then places one. */
export const CARDS_DRAWN_PER_TURN = 1;

/** Each player starts with this many points; captures move points between players. */
export const STARTING_SCORE = 5;

/**
 * Minimum number of cards a deck needs for one game: the initial hand plus one draw for each of
 * the first player's five turns. Deck-building rules (see `deck.ts`) are stricter than this.
 */
export const MIN_CARDS_PER_GAME = INITIAL_HAND_SIZE + 5 * CARDS_DRAWN_PER_TURN;
