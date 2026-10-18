'use client';

import {
  ELEMENTAL_MODES,
  PLAYER_COLORS,
  type ElementalMode,
  type PlayerColor,
} from '@triple-triad/engine';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { Toggle } from '@/components/ui/toggle';
import { TextField } from '@/components/ui/text-field';
import { createRoom } from '@/lib/realtime/hooks';
import {
  ROOM_ERRORS,
  ROOM_NAME_MAX_LENGTH,
  ROOM_PASSWORD_MAX_LENGTH,
  TURN_TIMER_OPTIONS,
  type RoomError,
  type RoomOptions,
  type TurnSeconds,
} from '@/lib/realtime/protocol';
import type { LockableOption, RoomPolicy } from '@/lib/validation/settings';

const ELEMENTAL_LABELS: Record<ElementalMode, string> = {
  off: 'Off',
  normal: 'Normal (0–3 squares)',
  all: 'All squares',
};

type RuleToggle = 'open' | 'same' | 'plus' | 'combo' | 'sameWall';
const RULE_TOGGLES: readonly { key: RuleToggle; label: string; hint: string }[] = [
  { key: 'open', label: 'Open hands', hint: 'Both hands are visible' },
  { key: 'same', label: 'Same', hint: 'Equal numbers on 2+ sides capture' },
  { key: 'sameWall', label: 'Same Wall', hint: 'Board edges count as A for Same' },
  { key: 'plus', label: 'Plus', hint: 'Equal sums on 2+ sides capture' },
  { key: 'combo', label: 'Combo', hint: 'Same/Plus captures chain on' },
];

interface CreateRoomFormProps {
  readonly defaultName: string;
  /** The admin's room policy: starting values, and options hosts may not change. */
  readonly policy: RoomPolicy;
}

const LOCKED_HINT = 'Set by the admin';

const COLOR_CHOICES: Readonly<Record<PlayerColor, { label: string; checked: string }>> = {
  red: { label: 'Red', checked: 'peer-checked:bg-score-red/25 peer-checked:ring-score-red' },
  blue: { label: 'Blue', checked: 'peer-checked:bg-score-blue/25 peer-checked:ring-score-blue' },
};

export function CreateRoomForm({ defaultName, policy }: CreateRoomFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [password, setPassword] = useState('');
  const [hostColor, setHostColor] = useState<PlayerColor>('red');
  const [options, setOptions] = useState(policy.defaults);
  const locked = new Set<LockableOption>(policy.locked);
  const [error, setError] = useState<RoomError | null>(null);
  const [pending, setPending] = useState(false);

  const setRule = <K extends keyof RoomOptions['rules']>(
    key: K,
    value: RoomOptions['rules'][K],
  ) => {
    setOptions((current) => ({ ...current, rules: { ...current.rules, [key]: value } }));
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void createRoom({ name, password, options, hostColor }).then((result) => {
          if (result.ok) {
            router.push(`/play/${result.data.roomId}`);
          } else {
            setError(result.error);
            setPending(false);
          }
        });
      }}
    >
      <TextField
        label="Room name"
        value={name}
        required
        maxLength={ROOM_NAME_MAX_LENGTH}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="off"
        value={password}
        maxLength={ROOM_PASSWORD_MAX_LENGTH}
        hint="Optional. Leave empty for an open room."
        onChange={(event) => {
          setPassword(event.target.value);
        }}
      />

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-100">Your colour</legend>
        <div className="grid grid-cols-2 gap-2">
          {PLAYER_COLORS.map((color) => (
            <label key={color} className="cursor-pointer">
              <input
                type="radio"
                name="hostColor"
                value={color}
                checked={hostColor === color}
                onChange={() => {
                  setHostColor(color);
                }}
                className="peer sr-only"
              />
              <span
                className={`flex items-center justify-center gap-2 rounded-md bg-black/25 px-3 py-2 text-sm ring-1 ring-frame/50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cream ${COLOR_CHOICES[color].checked}`}
              >
                <span
                  aria-hidden
                  className={`size-3 rounded-full ${color === 'red' ? 'bg-score-red' : 'bg-score-blue'}`}
                />
                {COLOR_CHOICES[color].label}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-300/80">
          Whoever joins plays the other colour. A coin flip decides who goes first.
        </p>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Turn timer"
          value={String(options.turnSeconds)}
          disabled={locked.has('turnSeconds')}
          {...(locked.has('turnSeconds') && { hint: LOCKED_HINT })}
          onChange={(value) => {
            setOptions((current) => ({ ...current, turnSeconds: parseTurnSeconds(value) }));
          }}
        >
          {TURN_TIMER_OPTIONS.map((seconds) => (
            <option key={String(seconds)} value={String(seconds)}>
              {seconds === null ? 'No timer' : `${String(seconds)} seconds`}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Elemental"
          value={options.rules.elemental}
          disabled={locked.has('elemental')}
          {...(locked.has('elemental') && { hint: LOCKED_HINT })}
          onChange={(value) => {
            setRule('elemental', ELEMENTAL_MODES.find((mode) => mode === value) ?? 'off');
          }}
        >
          {ELEMENTAL_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {ELEMENTAL_LABELS[mode]}
            </option>
          ))}
        </SelectField>
      </div>

      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm font-medium text-slate-100">Rules</legend>
        {RULE_TOGGLES.map(({ key, label, hint }) => (
          <Toggle
            key={key}
            label={label}
            hint={locked.has(key) ? `${hint} · ${LOCKED_HINT}` : hint}
            checked={options.rules[key]}
            disabled={locked.has(key)}
            onChange={(checked) => {
              setRule(key, checked);
            }}
          />
        ))}
        <Toggle
          label="Allow spectators"
          checked={options.allowSpectators}
          disabled={locked.has('allowSpectators')}
          {...(locked.has('allowSpectators') && { hint: LOCKED_HINT })}
          onChange={(checked) => {
            setOptions((current) => ({ ...current, allowSpectators: checked }));
          }}
        />
        <Toggle
          label="Carry hand"
          hint={
            locked.has('carryHand')
              ? `Unplaced cards stay in hand next round · ${LOCKED_HINT}`
              : 'Unplaced cards stay in hand next round'
          }
          checked={options.carryHand}
          disabled={locked.has('carryHand')}
          onChange={(checked) => {
            setOptions((current) => ({ ...current, carryHand: checked }));
          }}
        />
      </fieldset>

      {error && (
        <p role="alert" className="rounded-md bg-status-live/30 px-3 py-2 text-sm">
          {ROOM_ERRORS[error]}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Create room'}
      </Button>
    </form>
  );
}

function parseTurnSeconds(value: string): TurnSeconds {
  return TURN_TIMER_OPTIONS.find((option) => String(option) === value) ?? null;
}
