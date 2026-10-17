'use client';

import { ELEMENTAL_MODES, type ElementalMode } from '@triple-triad/engine';
import { useRouter } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
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

const DEFAULT_OPTIONS: RoomOptions = {
  rules: { open: false, same: true, plus: true, combo: true, sameWall: false, elemental: 'off' },
  turnSeconds: 30,
  allowSpectators: true,
};

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

export function CreateRoomForm({ defaultName }: { readonly defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [password, setPassword] = useState('');
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
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
        void createRoom({ name, password, options }).then((result) => {
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

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Turn timer"
          value={String(options.turnSeconds)}
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
            hint={hint}
            checked={options.rules[key]}
            onChange={(checked) => {
              setRule(key, checked);
            }}
          />
        ))}
        <Toggle
          label="Allow spectators"
          checked={options.allowSpectators}
          onChange={(checked) => {
            setOptions((current) => ({ ...current, allowSpectators: checked }));
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

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-100">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="mt-1 w-full rounded-md border border-frame/50 bg-black/30 px-3 py-2 text-sm text-slate-100 [color-scheme:dark] focus:ring-2 focus:ring-cream focus:outline-none"
      >
        {children}
      </select>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span>
        <span className="block text-sm text-slate-100">{label}</span>
        {hint && <span className="block text-xs text-slate-300/70">{hint}</span>}
      </span>
      <span className="relative inline-block h-5 w-9 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        <span className="absolute inset-0 rounded-full bg-black/40 ring-1 ring-frame/50 transition peer-checked:bg-action peer-focus-visible:ring-2 peer-focus-visible:ring-cream" />
        <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-cream transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
