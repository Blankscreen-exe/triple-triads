/**
 * Filtering and sorting the lobby's room list, and storing the choice in the URL (like
 * card-filters.ts and deck-filters.ts).
 */
import { opponentOf, PLAYER_COLORS, type PlayerColor } from '@triple-triad/engine';
import type { RoomSummary } from './realtime/protocol';

/** `open`: a seat is free, so you can join. `full`: two players, so you can only watch. */
export const SEAT_FILTERS = ['open', 'full'] as const;
export type SeatFilter = (typeof SEAT_FILTERS)[number];

export const PASSWORD_FILTERS = ['none', 'required'] as const;
export type PasswordFilter = (typeof PASSWORD_FILTERS)[number];

/** Turn timer: seconds, or `none` for rooms without a timer. */
export const TIMER_FILTERS = ['30', '60', 'none'] as const;
export type TimerFilter = (typeof TIMER_FILTERS)[number];

/** Rules a room can be required to have. `elemental` means any elemental mode but off. */
export const RULE_FILTERS = ['open', 'same', 'sameWall', 'plus', 'combo', 'elemental'] as const;
export type RuleFilter = (typeof RULE_FILTERS)[number];

export const ROOM_SORTS = ['open-first', 'newest', 'oldest', 'name'] as const;
export type RoomSort = (typeof ROOM_SORTS)[number];

export interface RoomFilters {
  /** Part of the room name or of a player's name, case-insensitive. */
  readonly query: string;
  readonly seat: SeatFilter | null;
  /** The colour you would play by joining; only rooms you can join match. */
  readonly color: PlayerColor | null;
  readonly timer: TimerFilter | null;
  readonly password: PasswordFilter | null;
  /** Rules every listed room must have on. */
  readonly rules: readonly RuleFilter[];
  readonly sort: RoomSort;
}

export const NO_ROOM_FILTERS: RoomFilters = {
  query: '',
  seat: null,
  color: null,
  timer: null,
  password: null,
  rules: [],
  sort: 'open-first',
};

export function isRoomFiltered(filters: RoomFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.seat !== null ||
    filters.color !== null ||
    filters.timer !== null ||
    filters.password !== null ||
    filters.rules.length > 0
  );
}

/** A room with a free seat: you can join it as a player. */
export function hasOpenSeat(room: RoomSummary): boolean {
  return room.players.length < 2;
}

function hasRule(room: RoomSummary, rule: RuleFilter): boolean {
  return rule === 'elemental' ? room.options.rules.elemental !== 'off' : room.options.rules[rule];
}

/** The timer filter a room's turn timer falls under. */
export function timerFilterOf(turnSeconds: RoomSummary['options']['turnSeconds']): TimerFilter {
  return turnSeconds === null ? 'none' : turnSeconds === 30 ? '30' : '60';
}

function matches(room: RoomSummary, filters: RoomFilters): boolean {
  const query = filters.query.trim().toLocaleLowerCase();
  const searchable = [room.name, room.host, ...room.players].map((text) =>
    text.toLocaleLowerCase(),
  );
  return (
    (query === '' || searchable.some((text) => text.includes(query))) &&
    (filters.seat === null || (filters.seat === 'open') === hasOpenSeat(room)) &&
    (filters.color === null ||
      (hasOpenSeat(room) && opponentOf(room.hostColor) === filters.color)) &&
    (filters.timer === null || timerFilterOf(room.options.turnSeconds) === filters.timer) &&
    (filters.password === null || (filters.password === 'required') === room.hasPassword) &&
    filters.rules.every((rule) => hasRule(room, rule))
  );
}

const newest = (a: RoomSummary, b: RoomSummary) => b.createdAt - a.createdAt;

const COMPARATORS: Record<RoomSort, (a: RoomSummary, b: RoomSummary) => number> = {
  'open-first': (a, b) => Number(hasOpenSeat(b)) - Number(hasOpenSeat(a)) || newest(a, b),
  newest,
  oldest: (a, b) => a.createdAt - b.createdAt,
  name: (a, b) => a.name.localeCompare(b.name) || newest(a, b),
};

/** The rooms that match, in the chosen order. Does not modify the input. */
export function applyRoomFilters(
  rooms: readonly RoomSummary[],
  filters: RoomFilters,
): RoomSummary[] {
  return rooms.filter((room) => matches(room, filters)).sort(COMPARATORS[filters.sort]);
}

// ---- URL ------------------------------------------------------------------------------------

const PARAMS = {
  query: 'q',
  seat: 'seat',
  color: 'color',
  timer: 'timer',
  password: 'password',
  rules: 'rules',
  sort: 'sort',
} as const;

const findIn = <T extends string>(options: readonly T[], value: string | null): T | null =>
  options.find((option) => option === value) ?? null;

/** Reads filters from a URL query; invalid values are ignored. */
export function roomFiltersFromSearchParams(params: URLSearchParams): RoomFilters {
  const rules = (params.get(PARAMS.rules) ?? '')
    .split(',')
    .flatMap((value) => findIn(RULE_FILTERS, value) ?? []);
  return {
    query: params.get(PARAMS.query) ?? '',
    seat: findIn(SEAT_FILTERS, params.get(PARAMS.seat)),
    color: findIn(PLAYER_COLORS, params.get(PARAMS.color)),
    timer: findIn(TIMER_FILTERS, params.get(PARAMS.timer)),
    password: findIn(PASSWORD_FILTERS, params.get(PARAMS.password)),
    // Keep the canonical order and drop duplicates, so equal filters give equal URLs.
    rules: RULE_FILTERS.filter((rule) => rules.includes(rule)),
    sort: findIn(ROOM_SORTS, params.get(PARAMS.sort)) ?? NO_ROOM_FILTERS.sort,
  };
}

/** Writes filters into a copy of `current`, omitting defaults. */
export function roomFiltersToSearchParams(
  filters: RoomFilters,
  current: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(current);
  const set = (key: string, value: string | null) => {
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
  };
  set(PARAMS.query, filters.query);
  set(PARAMS.seat, filters.seat);
  set(PARAMS.color, filters.color);
  set(PARAMS.timer, filters.timer);
  set(PARAMS.password, filters.password);
  set(PARAMS.rules, RULE_FILTERS.filter((rule) => filters.rules.includes(rule)).join(','));
  set(PARAMS.sort, filters.sort === NO_ROOM_FILTERS.sort ? null : filters.sort);
  return params;
}
