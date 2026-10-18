'use client';

import { PLAYER_COLORS, type PlayerColor } from '@triple-triad/engine';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import {
  isRoomFiltered,
  NO_ROOM_FILTERS,
  PASSWORD_FILTERS,
  ROOM_SORTS,
  RULE_FILTERS,
  SEAT_FILTERS,
  TIMER_FILTERS,
  type PasswordFilter,
  type RoomFilters,
  type RoomSort,
  type RuleFilter,
  type SeatFilter,
  type TimerFilter,
} from '@/lib/room-filters';

const SEAT_LABELS: Record<SeatFilter, string> = { open: 'Free seat', full: 'In game (watch)' };
const COLOR_LABELS: Record<PlayerColor, string> = { red: 'Red', blue: 'Blue' };
const TIMER_LABELS: Record<TimerFilter, string> = {
  '30': '30 seconds',
  '60': '60 seconds',
  none: 'No timer',
};
const PASSWORD_LABELS: Record<PasswordFilter, string> = {
  none: 'No password',
  required: 'Password',
};
const RULE_LABELS: Record<RuleFilter, string> = {
  open: 'Open hands',
  same: 'Same',
  sameWall: 'Same Wall',
  plus: 'Plus',
  combo: 'Combo',
  elemental: 'Elemental',
};
const SORT_LABELS: Record<RoomSort, string> = {
  'open-first': 'Free seats first',
  newest: 'Newest',
  oldest: 'Oldest',
  name: 'Name',
};

/** Select value for "no filter". */
const ANY = '';

const pick = <T extends string>(options: readonly T[], value: string): T | null =>
  options.find((option) => option === value) ?? null;

interface RoomFilterBarProps {
  readonly filters: RoomFilters;
  readonly onChange: (filters: RoomFilters) => void;
  readonly shown: number;
  readonly total: number;
}

/** Search, filter and sort controls for the lobby. Controlled: the caller owns the state. */
export function RoomFilterBar({ filters, onChange, shown, total }: RoomFilterBarProps) {
  const update = (changes: Partial<RoomFilters>) => {
    onChange({ ...filters, ...changes });
  };
  const toggleRule = (rule: RuleFilter) => {
    update({
      rules: filters.rules.includes(rule)
        ? filters.rules.filter((r) => r !== rule)
        : RULE_FILTERS.filter((r) => r === rule || filters.rules.includes(r)),
    });
  };
  const filtered = isRoomFiltered(filters);

  return (
    <div role="search" aria-label="Filter rooms" className="space-y-3">
      <TextField
        label="Search"
        type="search"
        placeholder="Room or player name"
        value={filters.query}
        onChange={(event) => {
          update({ query: event.target.value });
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.35fr)]">
        <SelectField
          label="Seats"
          value={filters.seat ?? ANY}
          onChange={(value) => {
            update({ seat: pick(SEAT_FILTERS, value) });
          }}
        >
          <option value={ANY}>All rooms</option>
          {SEAT_FILTERS.map((seat) => (
            <option key={seat} value={seat}>
              {SEAT_LABELS[seat]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Your colour"
          value={filters.color ?? ANY}
          onChange={(value) => {
            update({ color: pick(PLAYER_COLORS, value) });
          }}
        >
          <option value={ANY}>Any</option>
          {PLAYER_COLORS.map((color) => (
            <option key={color} value={color}>
              {COLOR_LABELS[color]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Timer"
          value={filters.timer ?? ANY}
          onChange={(value) => {
            update({ timer: pick(TIMER_FILTERS, value) });
          }}
        >
          <option value={ANY}>Any</option>
          {TIMER_FILTERS.map((timer) => (
            <option key={timer} value={timer}>
              {TIMER_LABELS[timer]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Password"
          value={filters.password ?? ANY}
          onChange={(value) => {
            update({ password: pick(PASSWORD_FILTERS, value) });
          }}
        >
          <option value={ANY}>Any</option>
          {PASSWORD_FILTERS.map((password) => (
            <option key={password} value={password}>
              {PASSWORD_LABELS[password]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Sort"
          value={filters.sort}
          onChange={(value) => {
            update({ sort: pick(ROOM_SORTS, value) ?? NO_ROOM_FILTERS.sort });
          }}
        >
          {ROOM_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </option>
          ))}
        </SelectField>
      </div>
      <div role="group" aria-labelledby="room-rule-filters" className="flex flex-wrap gap-1.5">
        <span id="room-rule-filters" className="mr-1 self-center text-sm text-slate-100">
          Must have
        </span>
        {RULE_FILTERS.map((rule) => {
          const on = filters.rules.includes(rule);
          return (
            <button
              key={rule}
              type="button"
              aria-pressed={on}
              onClick={() => {
                toggleRule(rule);
              }}
              className={`rounded-sm border px-2 py-0.5 text-[11px] tracking-wider uppercase transition focus-visible:outline-2 focus-visible:outline-cream ${on ? 'border-cream bg-action text-white' : 'border-frame/50 bg-black/20 text-slate-200 hover:bg-white/10'}`}
            >
              {RULE_LABELS[rule]}
            </button>
          );
        })}
      </div>
      <div className="flex min-h-8 items-center gap-3 text-sm text-slate-300/80">
        <p aria-live="polite">
          {filtered
            ? `Showing ${String(shown)} of ${String(total)} rooms`
            : `${String(total)} ${total === 1 ? 'room' : 'rooms'}`}
        </p>
        {filtered && (
          <Button
            variant="quiet"
            className="!px-2 !py-1 text-xs"
            onClick={() => {
              onChange({ ...NO_ROOM_FILTERS, sort: filters.sort });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
