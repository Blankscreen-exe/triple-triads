/**
 * The card face layout: where every element sits on a 1024 × 1434 card, and how asset-pack sprite
 * sheets are divided into cells.
 *
 * `card-layout.json` is the single source of truth. The web renderer reads it through this module
 * (validated at load), and `design/tools/make_card_template.py` reads the same file to draw the
 * artist templates.
 */
import { ELEMENTS, SIDES, type Element, type Side, type StatValue } from '@triple-triad/engine';
import { z } from 'zod';
import rawLayout from './card-layout.json';

/** A rectangle in card pixels: [left, top, right, bottom]. */
export type Box = readonly [x0: number, y0: number, x1: number, y1: number];

export interface SpriteSheet<Key extends string> {
  /** Size of one cell in pixels. Cells are laid out in a single row. */
  readonly cell: readonly [width: number, height: number];
  /** What each cell contains, left to right. */
  readonly order: readonly Key[];
}

export const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A'] as const;
export type DigitKey = (typeof DIGIT_KEYS)[number];

export const STAR_KEYS = ['filled', 'empty'] as const;
export type StarKey = (typeof STAR_KEYS)[number];

export interface CardLayout {
  readonly width: number;
  readonly height: number;
  readonly frameBorder: number;
  readonly background: Box;
  readonly safeArea: Box;
  readonly statsArea: Box;
  readonly stats: Readonly<Record<Side, Box>>;
  readonly element: Box;
  readonly namePlate: Box;
  readonly name: Box;
  readonly stars: readonly Box[];
  readonly sheets: {
    readonly digits: SpriteSheet<DigitKey>;
    readonly elements: SpriteSheet<Element>;
    readonly stars: SpriteSheet<StarKey>;
  };
}

const box = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine(([x0, y0, x1, y1]) => x1 > x0 && y1 > y0, 'A box must have positive width and height');
const sheet = <Key extends string>(keys: readonly [Key, ...Key[]]) =>
  z.object({
    cell: z.tuple([z.number().positive(), z.number().positive()]),
    order: z
      .array(z.enum(keys))
      .refine((order) => new Set(order).size === keys.length && order.length === keys.length, {
        message: `Sheet must list each of ${keys.join(', ')} exactly once`,
      }),
  });

const layoutSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  frameBorder: z.number().nonnegative(),
  background: box,
  safeArea: box,
  statsArea: box,
  stats: z.object({ top: box, right: box, bottom: box, left: box }),
  element: box,
  namePlate: box,
  name: box,
  stars: z.array(box).min(1),
  sheets: z.object({
    digits: sheet(DIGIT_KEYS),
    elements: sheet(ELEMENTS),
    stars: sheet(STAR_KEYS),
  }),
});

/** Validates raw layout data. Throws with a readable message if the file is malformed. */
export function parseCardLayout(data: unknown): CardLayout {
  const layout: CardLayout = layoutSchema.parse(data);
  const outside = allBoxes(layout).filter(
    ([, [x0, y0, x1, y1]]) => x0 < 0 || y0 < 0 || x1 > layout.width || y1 > layout.height,
  );
  if (outside.length > 0) {
    throw new RangeError(`Boxes outside the card: ${outside.map(([name]) => name).join(', ')}`);
  }
  return layout;
}

export const CARD_LAYOUT: CardLayout = parseCardLayout(rawLayout);

/** Every named box in the layout, for checks and tooling. */
export function allBoxes(layout: CardLayout): [name: string, box: Box][] {
  return [
    ['background', layout.background],
    ['safeArea', layout.safeArea],
    ['statsArea', layout.statsArea],
    ...SIDES.map((side): [string, Box] => [`stats.${side}`, layout.stats[side]]),
    ['element', layout.element],
    ['namePlate', layout.namePlate],
    ['name', layout.name],
    ...layout.stars.map((star, index): [string, Box] => [`stars[${String(index)}]`, star]),
  ];
}

/** The sprite cell that shows a stat value (10 is drawn as "A"). */
export function digitKey(value: StatValue): DigitKey {
  return value === 10 ? 'A' : (String(value) as DigitKey);
}

export interface PercentRect {
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly height: string;
}

/** Position of a box as percentages of the card, so the face scales to any rendered size. */
export function boxToPercent(target: Box, layout: CardLayout = CARD_LAYOUT): PercentRect {
  const [x0, y0, x1, y1] = target;
  return {
    left: percent(x0 / layout.width),
    top: percent(y0 / layout.height),
    width: percent((x1 - x0) / layout.width),
    height: percent((y1 - y0) / layout.height),
  };
}

export interface SpritePosition {
  readonly backgroundSize: string;
  readonly backgroundPosition: string;
}

/**
 * CSS background size and position that show one cell of a single-row sprite sheet, filling the
 * element the background is applied to.
 */
export function spritePosition<Key extends string>(
  target: SpriteSheet<Key>,
  key: Key,
): SpritePosition {
  const index = target.order.indexOf(key);
  if (index === -1) throw new RangeError(`"${key}" is not in this sprite sheet`);
  const cells = target.order.length;
  return {
    backgroundSize: `${String(cells * 100)}% 100%`,
    // With background-size N×100%, 0% shows the first cell and 100% the last.
    backgroundPosition: `${cells === 1 ? '0%' : percent(index / (cells - 1))} 0%`,
  };
}

function percent(fraction: number): string {
  return `${String(Math.round(fraction * 100_000) / 1000)}%`;
}
