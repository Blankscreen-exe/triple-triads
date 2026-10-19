'use client';

import type { ReactNode } from 'react';

export interface Tab<Id extends string> {
  readonly id: Id;
  readonly label: ReactNode;
}

interface TabListProps<Id extends string> {
  /** Accessible name of the tab list. */
  readonly label: string;
  readonly tabs: readonly Tab<Id>[];
  readonly value: Id;
  readonly onChange: (id: Id) => void;
  /** Tab i controls the element with id `${panelIdPrefix}-${id}`. */
  readonly panelIdPrefix: string;
  readonly className?: string;
}

/**
 * A row of tabs (e.g. to show one panel at a time on narrow screens). The panels are the
 * caller's: give each the id `${panelIdPrefix}-${tab id}` and hide the ones not selected.
 */
export function TabList<Id extends string>({
  label,
  tabs,
  value,
  onChange,
  panelIdPrefix,
  className = '',
}: TabListProps<Id>) {
  const tabId = (id: Id) => `${panelIdPrefix}-tab-${id}`;
  const select = (offset: number) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    if (!next) return;
    onChange(next.id);
    document.getElementById(tabId(next.id))?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`grid auto-cols-fr grid-flow-col gap-1 rounded-lg border border-frame/50 bg-black/25 p-1 ${className}`}
      onKeyDown={(event) => {
        // Arrow keys move between tabs, as in any tab list.
        if (event.key === 'ArrowRight') select(1);
        else if (event.key === 'ArrowLeft') select(-1);
      }}
    >
      {tabs.map(({ id, label: tabLabel }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            id={tabId(id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${panelIdPrefix}-${id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(id);
            }}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-cream ${selected ? 'bg-linear-to-b from-gold-light to-gold text-ink' : 'text-slate-200 hover:bg-white/10'}`}
          >
            {tabLabel}
          </button>
        );
      })}
    </div>
  );
}
