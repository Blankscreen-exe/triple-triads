'use client';

import {
  ELEMENTS,
  MAX_STAT_VALUE,
  MIN_STAT_VALUE,
  SIDES,
  isStatValue,
  rankCard,
  type Element,
  type ScoringConfig,
  type Side,
  type Stats,
} from '@triple-triad/engine';
import Link from 'next/link';
import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import { CardView } from '@/components/cards/card-view';
import { ArtCropper } from '@/components/cards/art-cropper';
import { Button, buttonClasses } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Window } from '@/components/ui/window';
import type { AssetPack } from '@/lib/asset-packs';
import { ELEMENT_LABELS, formatStat } from '@/lib/elements';
import { CARD_ART_MAX_BYTES, CARD_ART_TYPES, CARD_NAME_MAX_LENGTH } from '@/lib/validation/card';

const STAT_VALUES = Array.from(
  { length: MAX_STAT_VALUE - MIN_STAT_VALUE + 1 },
  (_, index) => MIN_STAT_VALUE + index,
);
const SIDE_LABELS: Record<Side, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
};
/** What a card form's server action returns. */
export interface CardFormState {
  readonly error: string | null;
}

export type CardFormAction = (state: CardFormState, formData: FormData) => Promise<CardFormState>;

export interface CardFormValues {
  readonly name: string;
  readonly stats: Stats;
  readonly element: Element | null;
  /** URL of the card's current art, if any. */
  readonly artUrl: string | null;
}

interface CardFormProps {
  readonly scoring: ScoringConfig;
  /** The pack the preview is drawn with (the card owner's). */
  readonly pack: AssetPack;
  readonly action: CardFormAction;
  readonly cancelHref: string;
  readonly initial?: CardFormValues;
  /** Sent with the form, e.g. the id of the card being edited. */
  readonly hiddenFields?: Readonly<Record<string, string>>;
}

const INITIAL_STATE: CardFormState = { error: null };
const BLANK_CARD: CardFormValues = {
  name: '',
  stats: { top: 5, right: 5, bottom: 5, left: 5 },
  element: null,
  artUrl: null,
};

/**
 * Card editor with a live preview: used by players (custom cards) and admins (generic cards).
 * Stars are computed with the same engine function and settings the server uses.
 */
export function CardForm({
  scoring,
  pack,
  action,
  cancelHref,
  initial = BLANK_CARD,
  hiddenFields = {},
}: CardFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [name, setName] = useState(initial.name);
  const [stats, setStats] = useState<Stats>(initial.stats);
  const [element, setElement] = useState<Element | null>(initial.element);
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [artError, setArtError] = useState<string | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const croppedBlobRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (artUrl) URL.revokeObjectURL(artUrl);
    },
    [artUrl],
  );

  useEffect(
    () => () => {
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    },
    [rawImageSrc],
  );

  const rank = rankCard(stats, element, scoring);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
      <Window className="p-5">
        <form
          className="space-y-5"
          // Submitted manually rather than via `action`: React resets forms after an action,
          // which would clear the chosen art file when the server reports an error.
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (croppedBlobRef.current) {
              data.set('art', new File([croppedBlobRef.current], 'art.png', { type: 'image/png' }));
            }
            startTransition(() => {
              formAction(data);
            });
          }}
        >
          {Object.entries(hiddenFields).map(([fieldName, value]) => (
            <input key={fieldName} type="hidden" name={fieldName} value={value} />
          ))}
          <TextField
            label="Name"
            name="name"
            required
            maxLength={CARD_NAME_MAX_LENGTH}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-100">Stats</legend>
            <div className="grid grid-cols-4 gap-3">
              {SIDES.map((side) => (
                <StatSelect
                  key={side}
                  side={side}
                  value={stats[side]}
                  onChange={(value) => {
                    setStats((current) => ({ ...current, [side]: value }));
                  }}
                />
              ))}
            </div>
          </fieldset>

          <ElementSelect value={element} bonus={scoring.elementBonus} onChange={setElement} />

          <div>
            <label htmlFor="art" className="block text-sm font-medium text-slate-100">
              Art
            </label>
            <input
              ref={fileInputRef}
              id="art"
              name="art"
              type="file"
              accept={CARD_ART_TYPES.join(',')}
              aria-describedby="art-hint"
              className="mt-1 block w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border file:border-frame/60 file:bg-black/25 file:px-3 file:py-1.5 file:text-slate-100"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setArtError(null);
                if (!file) {
                  setRawImageSrc(null);
                  return;
                }
                if (file.size > CARD_ART_MAX_BYTES) {
                  setArtError('That file is too large (maximum 5 MB).');
                  event.target.value = '';
                  setRawImageSrc(null);
                  return;
                }
                setRawImageSrc(URL.createObjectURL(file));
              }}
            />
            <p id="art-hint" className="mt-1 text-xs text-slate-300/70">
              {initial.artUrl
                ? 'Optional: choose a file to replace the current art. '
                : 'Optional. '}
              PNG, WebP or JPEG up to 5 MB. You can crop and zoom after choosing.
            </p>
            {artError && (
              <p role="alert" className="mt-1 text-sm text-status-live">
                {artError}
              </p>
            )}
          </div>

          {state.error && (
            <p role="alert" className="rounded-md bg-status-live/30 px-3 py-2 text-sm">
              {state.error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={isPending || !rank.allowed || artError !== null}>
              {isPending ? 'Saving…' : 'Save card'}
            </Button>
            <Link href={cancelHref} className={buttonClasses('secondary')}>
              Cancel
            </Link>
          </div>
        </form>
      </Window>

      <div className="space-y-3">
        <CardView
          card={{
            name: name.trim() || 'New card',
            stats,
            element,
            stars: rank.stars,
            artUrl: artUrl ?? initial.artUrl,
          }}
          side="blue"
          pack={pack}
        />
        <p className="text-center text-sm text-slate-200" aria-live="polite">
          Score {rank.score} · {rank.stars} {rank.stars === 1 ? 'star' : 'stars'}
        </p>
        {!rank.allowed && (
          <p role="alert" className="rounded-md bg-status-live/30 px-3 py-2 text-center text-sm">
            Too strong: cards can be worth at most 5 stars. Lower some stats.
          </p>
        )}
      </div>

      {rawImageSrc && (
        <ArtCropper
          imageSrc={rawImageSrc}
          onConfirm={(blob, previewUrl) => {
            croppedBlobRef.current = blob;
            setArtUrl(previewUrl);
            setRawImageSrc(null);
          }}
          onCancel={() => {
            setRawImageSrc(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      )}
    </div>
  );
}

function StatSelect({
  side,
  value,
  onChange,
}: {
  readonly side: Side;
  readonly value: number;
  readonly onChange: (value: Stats[Side]) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-slate-300/80">
        {SIDE_LABELS[side]}
      </label>
      <select
        id={id}
        name={side}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (isStatValue(next)) onChange(next);
        }}
        className="mt-1 w-full rounded-md border border-frame/50 bg-black/30 px-2 py-2 text-center font-display font-bold text-slate-100 [color-scheme:dark]"
      >
        {STAT_VALUES.map((stat) => (
          <option key={stat} value={stat}>
            {formatStat(stat)}
          </option>
        ))}
      </select>
    </div>
  );
}

function ElementSelect({
  value,
  bonus,
  onChange,
}: {
  readonly value: Element | null;
  readonly bonus: number;
  readonly onChange: (value: Element | null) => void;
}) {
  return (
    <div>
      <label htmlFor="element" className="block text-sm font-medium text-slate-100">
        Element
      </label>
      <select
        id="element"
        name="element"
        value={value ?? ''}
        onChange={(event) => {
          onChange(ELEMENTS.find((element) => element === event.target.value) ?? null);
        }}
        className="mt-1 w-full rounded-md border border-frame/50 bg-black/30 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
      >
        <option value="">None</option>
        {ELEMENTS.map((element) => (
          <option key={element} value={element}>
            {ELEMENT_LABELS[element]} (+{bonus} score)
          </option>
        ))}
      </select>
    </div>
  );
}
