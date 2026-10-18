import { BASIC_RULES } from '@triple-triad/engine';
import { describe, expect, it } from 'vitest';
import { TURN_TIMER_OPTIONS, type RoomSummary } from './realtime/protocol';
import {
  applyRoomFilters,
  isRoomFiltered,
  NO_ROOM_FILTERS,
  roomFiltersFromSearchParams,
  roomFiltersToSearchParams,
  TIMER_FILTERS,
  timerFilterOf,
  type RoomFilters,
} from './room-filters';

const room = (
  name: string,
  overrides: Omit<Partial<RoomSummary>, 'options'> & {
    rules?: Partial<RoomSummary['options']['rules']>;
    turnSeconds?: RoomSummary['options']['turnSeconds'];
  } = {},
): RoomSummary => {
  const { rules, turnSeconds = 30, ...rest } = overrides;
  return {
    id: name,
    name,
    host: 'Squall',
    hostColor: 'red',
    hasPassword: false,
    options: { rules: { ...BASIC_RULES, ...rules }, turnSeconds, allowSpectators: true },
    status: 'waiting',
    players: ['Squall'],
    spectators: 0,
    createdAt: 0,
    ...rest,
  };
};

const ROOMS = [
  room('Balamb Duel', { createdAt: 1, rules: { same: true, plus: true } }),
  room('Garden Finals', {
    createdAt: 2,
    host: 'Quistis',
    players: ['Quistis', 'Zell'],
    status: 'playing',
    rules: { same: true },
  }),
  room('Secret Club', {
    createdAt: 3,
    host: 'Rinoa',
    players: ['Rinoa'],
    hostColor: 'blue',
    hasPassword: true,
    turnSeconds: null,
    rules: { elemental: 'normal' },
  }),
  room('Quick Match', { createdAt: 4, host: 'Selphie', players: ['Selphie'], turnSeconds: 60 }),
];

const names = (overrides: Partial<RoomFilters>) =>
  applyRoomFilters(ROOMS, { ...NO_ROOM_FILTERS, ...overrides }).map((r) => r.name);

describe('applyRoomFilters', () => {
  it('lists rooms with a free seat first, newest first', () => {
    expect(names({})).toEqual(['Quick Match', 'Secret Club', 'Balamb Duel', 'Garden Finals']);
  });

  it('sorts by age or name', () => {
    expect(names({ sort: 'oldest' })).toEqual([
      'Balamb Duel',
      'Garden Finals',
      'Secret Club',
      'Quick Match',
    ]);
    expect(names({ sort: 'name' })).toEqual([
      'Balamb Duel',
      'Garden Finals',
      'Quick Match',
      'Secret Club',
    ]);
  });

  it('searches room names and player names', () => {
    expect(names({ query: 'club' })).toEqual(['Secret Club']);
    expect(names({ query: 'ZELL' })).toEqual(['Garden Finals']);
  });

  it('filters by free seat, password and timer', () => {
    expect(names({ seat: 'full' })).toEqual(['Garden Finals']);
    expect(names({ password: 'required' })).toEqual(['Secret Club']);
    expect(names({ timer: 'none' })).toEqual(['Secret Club']);
    expect(names({ timer: '60', seat: 'open' })).toEqual(['Quick Match']);
  });

  it('filters by the colour you would play, which needs a free seat', () => {
    // Hosts are red except in Secret Club, so joiners play blue, except there.
    expect(names({ color: 'red' })).toEqual(['Secret Club']);
    expect(names({ color: 'blue' })).toEqual(['Quick Match', 'Balamb Duel']);
  });

  it('keeps only rooms with every required rule', () => {
    expect(names({ rules: ['same'] })).toEqual(['Balamb Duel', 'Garden Finals']);
    expect(names({ rules: ['same', 'plus'] })).toEqual(['Balamb Duel']);
    expect(names({ rules: ['elemental'] })).toEqual(['Secret Club']);
  });
});

describe('room filter URLs', () => {
  it('round-trip every filter, keeping rules in a fixed order', () => {
    const filters: RoomFilters = {
      query: 'duel',
      seat: 'open',
      color: 'blue',
      timer: 'none',
      password: 'none',
      rules: ['same', 'combo'],
      sort: 'name',
    };

    expect(roomFiltersFromSearchParams(roomFiltersToSearchParams(filters))).toEqual(filters);
    expect(
      roomFiltersFromSearchParams(new URLSearchParams('rules=combo,lava,same,combo')).rules,
    ).toEqual(['same', 'combo']);
  });

  it('omit defaults and ignore invalid values', () => {
    expect(roomFiltersToSearchParams(NO_ROOM_FILTERS).toString()).toBe('');
    expect(
      roomFiltersFromSearchParams(
        new URLSearchParams('seat=maybe&color=green&timer=90&password=x&sort=random'),
      ),
    ).toEqual(NO_ROOM_FILTERS);
  });

  it('count only real filters as filtering', () => {
    expect(isRoomFiltered({ ...NO_ROOM_FILTERS, sort: 'name' })).toBe(false);
    expect(isRoomFiltered({ ...NO_ROOM_FILTERS, rules: ['plus'] })).toBe(true);
  });
});

it('has a timer filter for every turn timer a room can have', () => {
  expect(TURN_TIMER_OPTIONS.map(timerFilterOf).toSorted()).toEqual([...TIMER_FILTERS].toSorted());
});
