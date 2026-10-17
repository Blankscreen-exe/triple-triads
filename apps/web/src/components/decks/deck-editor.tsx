'use client';

import {
  ELEMENTS,
  validateDeck,
  type DeckRules,
  type DeckViolation,
  type Element,
} from '@triple-triad/engine';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { CardLine } from '@/components/cards/card-line';
import { CardView, type CardFace } from '@/components/cards/card-view';
import { Button, buttonClasses } from '@/components/ui/button';
import { Window } from '@/components/ui/window';
import { ELEMENT_LABELS } from '@/lib/elements';
import { DECK_NAME_MAX_LENGTH, type DeckContents } from '@/lib/validation/deck';
import { describeViolation, violationKey } from '@/lib/deck-violations';

/** A card the player owns, as the editor needs it. */
export interface EditorCard extends CardFace {
  readonly id: string;
  /** Copies owned; null for unlimited (the player's own custom cards). */
  readonly owned: number | null;
}

export type SaveDeckResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

interface DeckEditorProps {
  readonly initialName: string;
  readonly initialCounts: Readonly<Record<string, number>>;
  /** Cards that may be added: a player's trunk, or every generic card for starter decks. */
  readonly trunk: readonly EditorCard[];
  readonly rules: DeckRules;
  /** Saves the deck; a server action bound to the deck being edited. */
  readonly save: (contents: DeckContents) => Promise<SaveDeckResult>;
  readonly backHref: string;
}

/** Deck editor used for players' decks and for admins' starter decks. */
export function DeckEditor({
  initialName,
  initialCounts,
  trunk,
  rules,
  save: saveDeck,
  backHref,
}: DeckEditorProps) {
  const DECK_SIZE = rules.size;
  const [name, setName] = useState(initialName);
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>(initialCounts);
  const [query, setQuery] = useState('');
  const [stars, setStars] = useState<number | null>(null);
  const [element, setElement] = useState<Element | 'none' | null>(null);
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; message: string } | null>(null);
  const [isSaving, startSaving] = useTransition();

  const size = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const deckCards = trunk.filter((card) => (counts[card.id] ?? 0) > 0);
  const violations = validateDeck(
    deckCards.flatMap((card) =>
      Array.from({ length: counts[card.id] ?? 0 }, () => ({
        stats: card.stats,
        element: card.element,
        stars: card.stars,
      })),
    ),
    rules,
  );

  const remaining = (card: EditorCard) =>
    card.owned === null ? Infinity : card.owned - (counts[card.id] ?? 0);

  const change = (cardId: string, delta: number) => {
    setStatus(null);
    setCounts((current) => {
      const count = (current[cardId] ?? 0) + delta;
      if (count > 0) return { ...current, [cardId]: count };
      return Object.fromEntries(Object.entries(current).filter(([id]) => id !== cardId));
    });
  };

  const visible = trunk.filter(
    (card) =>
      card.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (stars === null || card.stars === stars) &&
      (element === null || (element === 'none' ? card.element === null : card.element === element)),
  );

  const save = () => {
    startSaving(async () => {
      const result = await saveDeck({
        name,
        entries: Object.entries(counts).map(([cardId, quantity]) => ({ cardId, quantity })),
      });
      setStatus(
        result.ok
          ? { kind: 'saved', message: 'Deck saved.' }
          : { kind: 'error', message: result.error },
      );
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Window className="p-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-40 flex-1 text-sm">
            <span className="block text-slate-100">Search</span>
            <input
              type="search"
              value={query}
              placeholder="Card name"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-frame/50 bg-black/30 px-3 py-2 text-sm"
            />
          </label>
          <FilterSelect
            label="Stars"
            value={stars === null ? '' : String(stars)}
            options={[1, 2, 3, 4, 5].map((n) => [String(n), '★'.repeat(n)])}
            onChange={(value) => {
              setStars(value === '' ? null : Number(value));
            }}
          />
          <FilterSelect
            label="Element"
            value={element ?? ''}
            options={[
              ['none', 'None'],
              ...ELEMENTS.map((e): [string, string] => [e, ELEMENT_LABELS[e]]),
            ]}
            onChange={(value) => {
              setElement(
                value === ''
                  ? null
                  : value === 'none'
                    ? 'none'
                    : (ELEMENTS.find((e) => e === value) ?? null),
              );
            }}
          />
        </div>

        <ul
          aria-label="Your trunk"
          className="grid grid-cols-3 gap-4 sm:grid-cols-4 xl:grid-cols-5"
        >
          {visible.map((card) => {
            const left = remaining(card);
            const canAdd = left > 0 && size < DECK_SIZE;
            return (
              <li key={card.id} className="relative">
                <button
                  type="button"
                  disabled={!canAdd}
                  onClick={() => {
                    change(card.id, 1);
                  }}
                  aria-label={`Add ${card.name}`}
                  className="block w-full rounded-[3%/2.2%] transition enabled:cursor-pointer enabled:hover:-translate-y-1 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-cream"
                >
                  <CardView card={card} side="blue" />
                </button>
                <span className="absolute -right-2 -bottom-2 grid h-7 min-w-7 place-items-center rounded-full bg-cream px-1.5 text-xs font-bold text-ink ring-2 ring-window-bottom">
                  {card.owned === null ? '∞' : `${String(Math.max(left, 0))}/${String(card.owned)}`}
                </span>
              </li>
            );
          })}
        </ul>
        {visible.length === 0 && <p className="text-sm text-slate-300/80">No cards match.</p>}
      </Window>

      <Window className="flex flex-col gap-4 p-5 lg:sticky lg:top-20 lg:self-start">
        <label className="text-sm">
          <span className="block text-slate-100">Deck name</span>
          <input
            value={name}
            maxLength={DECK_NAME_MAX_LENGTH}
            onChange={(event) => {
              setName(event.target.value);
              setStatus(null);
            }}
            className="mt-1 w-full rounded-md border border-frame/50 bg-black/30 px-3 py-2 font-display font-bold text-cream"
          />
        </label>

        <p className="text-sm" aria-live="polite">
          <span className={size === DECK_SIZE ? 'text-cream' : 'text-slate-100'}>
            {size} / {DECK_SIZE} cards
          </span>
          {size >= DECK_SIZE && (
            <span className="block text-xs text-slate-300/80">
              The deck is full. Remove a card to add another.
            </span>
          )}
        </p>

        <ViolationList violations={violations} />

        <ul aria-label="Deck contents" className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {deckCards.map((card) => (
            <li key={card.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <CardLine
                  name={card.name}
                  stats={card.stats}
                  element={card.element}
                  stars={card.stars}
                  count={`×${String(counts[card.id] ?? 0)}`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <IconButton
                  label={`Add another ${card.name}`}
                  disabled={remaining(card) <= 0 || size >= DECK_SIZE}
                  onClick={() => {
                    change(card.id, 1);
                  }}
                >
                  +
                </IconButton>
                <IconButton
                  label={`Remove one ${card.name}`}
                  onClick={() => {
                    change(card.id, -1);
                  }}
                >
                  −
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
        {deckCards.length === 0 && (
          <p className="text-sm text-slate-300/80">Click cards on the left to add them.</p>
        )}

        {status && (
          <p
            role={status.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-md px-3 py-2 text-sm ${status.kind === 'error' ? 'bg-status-live/30' : 'bg-status-open/40'}`}
          >
            {status.message}
          </p>
        )}

        <div className="flex gap-3">
          <Button onClick={save} disabled={isSaving || name.trim() === ''} className="flex-1">
            {isSaving ? 'Saving…' : 'Save deck'}
          </Button>
          <Link href={backHref} className={buttonClasses('secondary')}>
            Back
          </Link>
        </div>
        {trunk.length === 0 && <p className="text-sm text-slate-300/80">Your trunk is empty.</p>}
      </Window>
    </div>
  );
}

function ViolationList({ violations }: { readonly violations: readonly DeckViolation[] }) {
  if (violations.length === 0) {
    return <p className="text-sm text-status-open">This deck follows the deck rules.</p>;
  }
  return (
    <ul className="space-y-1 rounded-md bg-status-live/30 px-3 py-2 text-sm">
      {violations.map((violation) => (
        <li key={violationKey(violation)}>{describeViolation(violation)}</li>
      ))}
      <li className="text-xs text-slate-200/80">You can save it, but not play with it yet.</li>
    </ul>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly (readonly [string, string])[];
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="block text-slate-100">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="mt-1 rounded-md border border-frame/50 bg-black/30 px-3 py-2 text-sm [color-scheme:dark]"
      >
        <option value="">Any</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded border border-frame/60 bg-black/30 text-sm font-bold enabled:hover:bg-white/10 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
