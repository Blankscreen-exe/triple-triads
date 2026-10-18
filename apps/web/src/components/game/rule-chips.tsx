import type { RoomOptions } from '@/lib/realtime/protocol';

const ELEMENTAL_LABELS = { off: null, normal: 'Elemental', all: 'Elemental: all squares' } as const;

/** Short labels for the room's active rules and timer. */
export function ruleLabels(options: RoomOptions): string[] {
  const { rules } = options;
  return [
    rules.open && 'Open hands',
    rules.same && 'Same',
    rules.sameWall && rules.same && 'Same Wall',
    rules.plus && 'Plus',
    rules.combo && (rules.same || rules.plus) && 'Combo',
    ELEMENTAL_LABELS[rules.elemental],
    options.turnSeconds === null ? 'No timer' : `${String(options.turnSeconds)}s turns`,
    options.format === 'until-winner' ? 'Until a winner' : 'Single game',
  ].filter((label): label is string => typeof label === 'string');
}

export function RuleChips({ options }: { readonly options: RoomOptions }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Rules">
      {ruleLabels(options).map((label) => (
        <li
          key={label}
          className="rounded-sm border border-frame/50 bg-black/20 px-2 py-0.5 text-[11px] tracking-wider uppercase"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}
