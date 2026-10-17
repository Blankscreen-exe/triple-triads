'use client';

import { ELEMENTAL_MODES, rankCard, type ElementalMode, type Stats } from '@triple-triad/engine';
import { useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { Toggle } from '@/components/ui/toggle';
import { Window } from '@/components/ui/window';
import { formatStat } from '@/lib/elements';
import { TURN_TIMER_OPTIONS, type RoomOptions } from '@/lib/realtime/protocol';
import {
  LOCKABLE_OPTIONS,
  toScoringConfig,
  type DeckRuleSettings,
  type LockableOption,
  type RoomPolicy,
  type ScoringSettings,
} from '@/lib/validation/settings';
import { updateSettingAction } from '../actions';

type SettingKey = 'scoring' | 'deckRules' | 'roomPolicy';

/** Shared save button and status line for the three forms. */
function useSave(key: SettingKey) {
  const [isSaving, startSaving] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const save = (value: unknown) => {
    startSaving(async () => {
      const result = await updateSettingAction(key, value);
      setStatus(result.ok ? { ok: true, message: 'Saved.' } : { ok: false, message: result.error });
    });
  };
  const footer = (onSave: () => void) => (
    <div className="mt-4 flex items-center gap-3">
      <Button onClick={onSave} disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save'}
      </Button>
      {status && (
        <span
          role={status.ok ? 'status' : 'alert'}
          className={status.ok ? 'text-status-open' : 'text-status-live'}
        >
          {status.message}
        </span>
      )}
    </div>
  );
  return {
    save,
    footer,
    clearStatus: () => {
      setStatus(null);
    },
  };
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Window className="p-5" aria-label={title}>
      <h2 className="font-display text-lg font-bold tracking-wider text-cream">{title}</h2>
      <p className="mt-1 mb-4 text-sm text-slate-300/80">{description}</p>
      {children}
    </Window>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  max,
  onChange,
}: {
  label: string;
  value: number | '';
  min?: number;
  max: number;
  onChange: (value: number | '') => void;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-slate-300/80">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          onChange(event.target.value === '' ? '' : Number(event.target.value));
        }}
        className="mt-1 w-full rounded-md border border-frame/50 bg-black/30 px-2 py-1.5 text-right tabular-nums"
      />
    </label>
  );
}

// ---- Scoring ---------------------------------------------------------------------------------

const STAT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
const SAMPLE_CARDS: readonly { name: string; stats: Stats }[] = [
  { name: '1-4-1-5', stats: { top: 1, right: 4, bottom: 1, left: 5 } },
  { name: '7-7-4-2', stats: { top: 7, right: 7, bottom: 4, left: 2 } },
  { name: '9-6-2-8', stats: { top: 9, right: 6, bottom: 2, left: 8 } },
  { name: 'A-4-6-9', stats: { top: 10, right: 4, bottom: 6, left: 9 } },
];

export function ScoringForm({ initial }: { readonly initial: ScoringSettings }) {
  const [value, setValue] = useState(initial);
  const { save, footer, clearStatus } = useSave('scoring');
  const scoring = toScoringConfig(value);

  return (
    <Section
      title="Card ranking"
      description="Each stat value has a score; a card's stars are its total score ÷ 100, rounded. Changes apply to every card at once."
    >
      <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
        {STAT_KEYS.map((key) => (
          <NumberField
            key={key}
            label={formatStat(Number(key))}
            max={1000}
            value={value.statScores[key]}
            onChange={(score) => {
              clearStatus();
              setValue((current) => ({
                ...current,
                statScores: { ...current.statScores, [key]: score === '' ? 0 : score },
              }));
            }}
          />
        ))}
      </div>
      <div className="mt-3 max-w-40">
        <NumberField
          label="Element bonus"
          max={500}
          value={value.elementBonus}
          onChange={(bonus) => {
            clearStatus();
            setValue((current) => ({ ...current, elementBonus: bonus === '' ? 0 : bonus }));
          }}
        />
      </div>
      <p className="mt-4 text-sm text-slate-300/80">Preview (no element):</p>
      <ul className="mt-1 flex flex-wrap gap-3 text-sm">
        {SAMPLE_CARDS.map(({ name, stats }) => {
          const rank = rankCard(stats, null, scoring);
          return (
            <li key={name} className="rounded-md border border-frame/30 bg-black/20 px-2 py-1">
              {name}: {rank.score} → {rank.allowed ? `${String(rank.stars)}★` : 'too strong'}
            </li>
          );
        })}
      </ul>
      {footer(() => {
        save(value);
      })}
    </Section>
  );
}

// ---- Deck rules ------------------------------------------------------------------------------

const STAR_KEYS = ['5', '4', '3', '2', '1'] as const;

export function DeckRulesForm({ initial }: { readonly initial: DeckRuleSettings }) {
  const [value, setValue] = useState(initial);
  const { save, footer, clearStatus } = useSave('deckRules');
  return (
    <Section
      title="Deck limits"
      description="How many cards of each star rank a 20-card deck may hold. Leave empty for no limit."
    >
      <div className="grid max-w-xl grid-cols-5 gap-3">
        {STAR_KEYS.map((key) => (
          <NumberField
            key={key}
            label={`${key}★`}
            max={20}
            value={value.starCaps[key] ?? ''}
            onChange={(cap) => {
              clearStatus();
              setValue((current) => ({
                starCaps: { ...current.starCaps, [key]: cap === '' ? null : cap },
              }));
            }}
          />
        ))}
      </div>
      {footer(() => {
        save(value);
      })}
    </Section>
  );
}

// ---- Room policy -----------------------------------------------------------------------------

type RuleToggle = 'open' | 'same' | 'plus' | 'combo' | 'sameWall';
const RULE_LABELS: Record<RuleToggle, string> = {
  open: 'Open hands',
  same: 'Same',
  plus: 'Plus',
  combo: 'Combo',
  sameWall: 'Same Wall',
};
const ELEMENTAL_LABELS: Record<ElementalMode, string> = {
  off: 'Off',
  normal: 'Normal',
  all: 'All squares',
};

export function RoomPolicyForm({ initial }: { readonly initial: RoomPolicy }) {
  const [policy, setPolicy] = useState(initial);
  const { save, footer, clearStatus } = useSave('roomPolicy');
  const locked = new Set(policy.locked);

  const setDefaults = (update: (defaults: RoomOptions) => RoomOptions) => {
    clearStatus();
    setPolicy((current) => ({ ...current, defaults: update(current.defaults) }));
  };
  const setLocked = (key: LockableOption, isLocked: boolean) => {
    clearStatus();
    setPolicy((current) => ({
      ...current,
      locked: isLocked
        ? LOCKABLE_OPTIONS.filter((option) => option === key || current.locked.includes(option))
        : current.locked.filter((option) => option !== key),
    }));
  };
  const lockBox = (key: LockableOption, label: string) => (
    <label className="flex items-center gap-2 text-xs text-slate-300/80">
      <input
        type="checkbox"
        checked={locked.has(key)}
        aria-label={`Lock ${label}`}
        onChange={(event) => {
          setLocked(key, event.target.checked);
        }}
      />
      Locked
    </label>
  );

  return (
    <Section
      title="Room options"
      description="The options new rooms start with. Locked options cannot be changed by room hosts."
    >
      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {(Object.keys(RULE_LABELS) as RuleToggle[]).map((key) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <Toggle
                label={RULE_LABELS[key]}
                checked={policy.defaults.rules[key]}
                onChange={(checked) => {
                  setDefaults((d) => ({ ...d, rules: { ...d.rules, [key]: checked } }));
                }}
              />
            </div>
            {lockBox(key, RULE_LABELS[key])}
          </div>
        ))}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <Toggle
              label="Allow spectators"
              checked={policy.defaults.allowSpectators}
              onChange={(checked) => {
                setDefaults((d) => ({ ...d, allowSpectators: checked }));
              }}
            />
          </div>
          {lockBox('allowSpectators', 'Allow spectators')}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1">
            <SelectField
              label="Elemental"
              value={policy.defaults.rules.elemental}
              onChange={(mode) => {
                setDefaults((d) => ({
                  ...d,
                  rules: {
                    ...d.rules,
                    elemental: ELEMENTAL_MODES.find((m) => m === mode) ?? 'off',
                  },
                }));
              }}
            >
              {ELEMENTAL_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {ELEMENTAL_LABELS[mode]}
                </option>
              ))}
            </SelectField>
          </div>
          {lockBox('elemental', 'Elemental')}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1">
            <SelectField
              label="Turn timer"
              value={String(policy.defaults.turnSeconds)}
              onChange={(seconds) => {
                setDefaults((d) => ({
                  ...d,
                  turnSeconds:
                    TURN_TIMER_OPTIONS.find((option) => String(option) === seconds) ?? null,
                }));
              }}
            >
              {TURN_TIMER_OPTIONS.map((seconds) => (
                <option key={String(seconds)} value={String(seconds)}>
                  {seconds === null ? 'No timer' : `${String(seconds)} seconds`}
                </option>
              ))}
            </SelectField>
          </div>
          {lockBox('turnSeconds', 'Turn timer')}
        </div>
      </div>
      {footer(() => {
        save(policy);
      })}
    </Section>
  );
}
