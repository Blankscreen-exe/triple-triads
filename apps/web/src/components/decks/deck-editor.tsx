'use client';

import { validateDeck, type DeckRules, type DeckViolation } from '@triple-triad/engine';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { CardFilterBar } from '@/components/cards/card-filter-bar';
import { CardView, type CardFace } from '@/components/cards/card-view';
import { Button, buttonClasses } from '@/components/ui/button';
import { Window } from '@/components/ui/window';
import type { AssetPack } from '@/lib/asset-packs';
import { applyFilters, hasMixedSources, NO_FILTERS, type FilterableCard } from '@/lib/card-filters';
import { DECK_NAME_MAX_LENGTH, type DeckContents } from '@/lib/validation/deck';
import { describeViolation, violationKey } from '@/lib/deck-violations';

/** A card the player owns, as the editor needs it. */
export interface EditorCard extends CardFace, FilterableCard {
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
  /** The pack cards are drawn with. */
  readonly pack: AssetPack;
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
  pack,
  save: saveDeck,
  backHref,
}: DeckEditorProps) {
  const DECK_SIZE = rules.size;
  const [name, setName] = useState(initialName);
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>(initialCounts);
  const [filters, setFilters] = useState(NO_FILTERS);
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

  const visible = applyFilters(trunk, filters);

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

  // The deck's cards, strongest first, like everywhere else cards are listed.
  const deckInOrder = applyFilters(deckCards, NO_FILTERS);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Window className="flex flex-col gap-4 p-5" aria-label="Deck">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 text-sm">
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
          <div className="flex gap-3">
            <Button onClick={save} disabled={isSaving || name.trim() === ''}>
              {isSaving ? 'Saving…' : 'Save deck'}
            </Button>
            <Link href={backHref} className={buttonClasses('secondary')}>
              Back
            </Link>
          </div>
        </div>

        <p className="text-sm" aria-live="polite">
          <span className={size === DECK_SIZE ? 'text-cream' : 'text-slate-100'}>
            {size} / {DECK_SIZE} cards
          </span>
          {size >= DECK_SIZE && (
            <span className="ml-2 text-xs text-slate-300/80">
              The deck is full. Remove a card to add another.
            </span>
          )}
        </p>

        <ViolationList violations={violations} />

        {status && (
          <p
            role={status.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-md px-3 py-2 text-sm ${status.kind === 'error' ? 'bg-status-live/30' : 'bg-status-open/40'}`}
          >
            {status.message}
          </p>
        )}

        {deckInOrder.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-300/80">
            This deck is empty. Click cards in your trunk to add them.
          </p>
        ) : (
          <ul
            aria-label="Deck contents"
            className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
          >
            {deckInOrder.map((card) => {
              const count = counts[card.id] ?? 0;
              return (
                <li key={card.id} className="space-y-2">
                  <div className="relative">
                    <CardView card={card} side="blue" pack={pack} />
                    <span
                      className="absolute -right-2 -bottom-2 grid h-7 min-w-7 place-items-center rounded-full bg-cream px-1.5 text-xs font-bold text-ink ring-2 ring-window-bottom"
                      aria-label={`${String(count)} in the deck`}
                    >
                      ×{count}
                    </span>
                  </div>
                  <div className="flex justify-center gap-2">
                    <IconButton
                      label={`Remove one ${card.name}`}
                      onClick={() => {
                        change(card.id, -1);
                      }}
                    >
                      −
                    </IconButton>
                    <IconButton
                      label={`Add another ${card.name}`}
                      disabled={remaining(card) <= 0 || size >= DECK_SIZE}
                      onClick={() => {
                        change(card.id, 1);
                      }}
                    >
                      +
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Window>

      <Window
        className="flex flex-col gap-3 p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start"
        aria-label="Your trunk"
      >
        <h2 className="font-display text-lg font-bold tracking-wider text-cream">Your trunk</h2>
        <CardFilterBar
          layout="sidebar"
          filters={filters}
          onChange={setFilters}
          showSource={hasMixedSources(trunk)}
          shown={visible.length}
          total={trunk.length}
        />
        {visible.length === 0 ? (
          <p className="text-sm text-slate-300/80">
            {trunk.length === 0 ? 'Your trunk is empty.' : 'No cards match.'}
          </p>
        ) : (
          <ul
            aria-label="Trunk cards"
            className="grid min-h-0 grid-cols-3 gap-x-3 gap-y-4 overflow-y-auto overscroll-contain px-1 pt-1 pb-3"
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
                    title={card.name}
                    className="block w-full rounded-[3%/2.2%] transition enabled:cursor-pointer enabled:hover:-translate-y-0.5 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-cream"
                  >
                    <CardView card={card} side="blue" pack={pack} />
                  </button>
                  <span
                    className="absolute -right-1.5 -bottom-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-cream px-1 text-[10px] font-bold text-ink ring-2 ring-window-bottom"
                    aria-label={
                      card.owned === null
                        ? 'Unlimited copies'
                        : `${String(Math.max(left, 0))} of ${String(card.owned)} copies left`
                    }
                  >
                    {card.owned === null
                      ? '∞'
                      : `${String(Math.max(left, 0))}/${String(card.owned)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
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
