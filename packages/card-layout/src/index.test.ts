import { describe, expect, it } from 'vitest';
import rawLayout from './card-layout.json';
import {
  CARD_LAYOUT,
  boxToPercent,
  digitKey,
  parseCardLayout,
  spritePosition,
  type SpriteSheet,
} from './index';

describe('CARD_LAYOUT', () => {
  it('is a 5:7 card', () => {
    expect(CARD_LAYOUT.width / CARD_LAYOUT.height).toBeCloseTo(5 / 7, 3);
  });

  it('has one star box per possible star', () => {
    expect(CARD_LAYOUT.stars).toHaveLength(5);
  });
});

describe('parseCardLayout', () => {
  it('rejects boxes that leave the card', () => {
    expect(() => parseCardLayout({ ...rawLayout, element: [900, 40, 1100, 140] })).toThrow(
      /element/,
    );
  });

  it('rejects boxes with no area', () => {
    expect(() => parseCardLayout({ ...rawLayout, name: [44, 1230, 44, 1300] })).toThrow();
  });

  it('rejects a sprite sheet with a missing cell', () => {
    const sheets = { ...rawLayout.sheets, stars: { cell: [60, 60], order: ['filled'] } };
    expect(() => parseCardLayout({ ...rawLayout, sheets })).toThrow(/exactly once/);
  });
});

describe('digitKey', () => {
  it('draws 10 as A', () => {
    expect(digitKey(10)).toBe('A');
    expect(digitKey(7)).toBe('7');
  });
});

describe('boxToPercent', () => {
  it('converts card pixels to percentages', () => {
    const layout = { ...CARD_LAYOUT, width: 1000, height: 2000 };

    expect(boxToPercent([100, 500, 350, 1500], layout)).toEqual({
      left: '10%',
      top: '25%',
      width: '25%',
      height: '50%',
    });
  });
});

describe('spritePosition', () => {
  const sheet: SpriteSheet<'a' | 'b' | 'c' | 'd' | 'e'> = {
    cell: [10, 10],
    order: ['a', 'b', 'c', 'd', 'e'],
  };

  it('stretches the sheet so one cell fills the element', () => {
    expect(spritePosition(sheet, 'a').backgroundSize).toBe('500% 100%');
  });

  it('positions the first, middle and last cells', () => {
    expect(spritePosition(sheet, 'a').backgroundPosition).toBe('0% 0%');
    expect(spritePosition(sheet, 'c').backgroundPosition).toBe('50% 0%');
    expect(spritePosition(sheet, 'e').backgroundPosition).toBe('100% 0%');
  });

  it('works for every real sheet cell', () => {
    for (const key of CARD_LAYOUT.sheets.digits.order) {
      expect(spritePosition(CARD_LAYOUT.sheets.digits, key).backgroundPosition).toMatch(
        /^[\d.]+% 0%$/,
      );
    }
  });
});
