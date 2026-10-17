import { describe, expect, it } from 'vitest';
import type { Position } from './board';
import { effectiveValue, resolveCaptures } from './capture';
import { BASIC_RULES, type RuleSet } from './rules';
import type { Board } from './state';
import { card, controllerAt, emptyBoard, withCard } from './test-utils';

// Board positions:  0 1 2 / 3 4 5 / 6 7 8.  Card stats are [top, right, bottom, left].

const rules = (overrides: Partial<RuleSet> = {}): RuleSet => ({ ...BASIC_RULES, ...overrides });

function place(board: Board, position: Position, ruleSet: RuleSet) {
  return resolveCaptures(board, position, ruleSet);
}

describe('basic capture', () => {
  it('captures an opponent card when the touching number is higher', () => {
    let board = withCard(emptyBoard(), 1, card([1, 1, 4, 1]), 'blue');
    board = withCard(board, 4, card([5, 5, 5, 5]), 'red');

    const { board: result, captures } = place(board, 4, rules());

    expect(controllerAt(result, 1)).toBe('red');
    expect(captures).toEqual([{ position: 1, cause: 'basic', from: 'blue', to: 'red', wave: 0 }]);
  });

  it('does not capture on equal or lower numbers', () => {
    let board = withCard(emptyBoard(), 3, card([1, 5, 1, 1]), 'blue'); // equal: right 5 vs left 5
    board = withCard(board, 5, card([1, 1, 1, 6]), 'blue'); // lower: right 5 vs left 6
    board = withCard(board, 4, card([5, 5, 5, 5]), 'red');

    const { board: result, captures } = place(board, 4, rules());

    expect(captures).toEqual([]);
    expect(controllerAt(result, 3)).toBe('blue');
    expect(controllerAt(result, 5)).toBe('blue');
  });

  it('never captures the placing player’s own cards', () => {
    let board = withCard(emptyBoard(), 7, card([1, 1, 1, 1]), 'red');
    board = withCard(board, 4, card([9, 9, 9, 9]), 'red');

    expect(place(board, 4, rules()).captures).toEqual([]);
  });

  it('captures several neighbours at once', () => {
    let board = emptyBoard();
    for (const position of [1, 3, 5, 7] as const) {
      board = withCard(board, position, card([1, 1, 1, 1]), 'blue');
    }
    board = withCard(board, 4, card([2, 2, 2, 2]), 'red');

    const { captures } = place(board, 4, rules());

    expect(captures.map((capture) => capture.position).sort()).toEqual([1, 3, 5, 7]);
  });

  it('does not modify the input board', () => {
    let board = withCard(emptyBoard(), 1, card([1, 1, 1, 1]), 'blue');
    board = withCard(board, 4, card([9, 9, 9, 9]), 'red');

    place(board, 4, rules());

    expect(controllerAt(board, 1)).toBe('blue');
  });
});

describe('elemental squares', () => {
  it('gives +1 to a card on a matching square', () => {
    let board = withCard(emptyBoard({ 4: 'fire' }), 1, card([1, 1, 5, 1]), 'blue');
    board = withCard(board, 4, card([5, 5, 5, 5], 'fire'), 'red');

    expect(controllerAt(place(board, 4, rules()).board, 1)).toBe('red');
  });

  it('gives -1 to a card with a different element', () => {
    let board = withCard(emptyBoard({ 4: 'fire' }), 1, card([1, 1, 5, 1]), 'blue');
    board = withCard(board, 4, card([6, 6, 6, 6], 'ice'), 'red');

    expect(place(board, 4, rules()).captures).toEqual([]);
  });

  it('gives -1 to a card without an element', () => {
    let board = withCard(emptyBoard({ 4: 'water' }), 1, card([1, 1, 5, 1]), 'blue');
    board = withCard(board, 4, card([6, 6, 6, 6]), 'red');

    expect(place(board, 4, rules()).captures).toEqual([]);
  });

  it('applies the defending card’s own modifier', () => {
    let board = withCard(emptyBoard({ 1: 'holy' }), 1, card([1, 1, 5, 1], 'holy'), 'blue'); // plays as 6
    board = withCard(board, 4, card([6, 6, 6, 6]), 'red');

    expect(place(board, 4, rules()).captures).toEqual([]);
  });

  it('lets a boosted A beat an A', () => {
    let board = withCard(emptyBoard({ 4: 'wind' }), 1, card([1, 1, 10, 1]), 'blue');
    board = withCard(board, 4, card([10, 1, 1, 1], 'wind'), 'red');

    expect(controllerAt(place(board, 4, rules()).board, 1)).toBe('red');
  });
});

describe('Same', () => {
  // Red at the centre touches blue's bottom 3 (top side) and blue's left 7 (right side).
  const sameSetup = (): Board => {
    let board = withCard(emptyBoard(), 1, card([1, 1, 3, 1]), 'blue');
    board = withCard(board, 5, card([1, 1, 1, 7]), 'blue');
    return withCard(board, 4, card([3, 7, 1, 1]), 'red');
  };

  it('captures when two touching numbers are equal', () => {
    const { captures } = place(sameSetup(), 4, rules({ same: true }));

    expect(captures).toEqual([
      { position: 1, cause: 'same', from: 'blue', to: 'red', wave: 0 },
      { position: 5, cause: 'same', from: 'blue', to: 'red', wave: 0 },
    ]);
  });

  it('does nothing when the rule is off', () => {
    expect(place(sameSetup(), 4, rules()).captures).toEqual([]);
  });

  it('needs at least two matches', () => {
    let board = withCard(emptyBoard(), 1, card([1, 1, 3, 1]), 'blue');
    board = withCard(board, 4, card([3, 7, 1, 1]), 'red');

    expect(place(board, 4, rules({ same: true })).captures).toEqual([]);
  });

  it('counts the placer’s own cards as matches without capturing them', () => {
    let board = withCard(emptyBoard(), 1, card([1, 1, 3, 1]), 'red');
    board = withCard(board, 5, card([1, 1, 1, 7]), 'blue');
    board = withCard(board, 4, card([3, 7, 1, 1]), 'red');

    const { captures } = place(board, 4, rules({ same: true }));

    expect(captures.map((capture) => capture.position)).toEqual([5]);
  });

  it('compares printed numbers, ignoring elemental modifiers', () => {
    let board = withCard(emptyBoard({ 4: 'fire' }), 1, card([1, 1, 3, 1]), 'blue');
    board = withCard(board, 5, card([1, 1, 1, 7]), 'blue');
    board = withCard(board, 4, card([3, 7, 1, 1]), 'red'); // -1 on a fire square

    expect(place(board, 4, rules({ same: true })).captures).toHaveLength(2);
  });
});

describe('Same Wall', () => {
  // Red on the top edge: its top A faces the wall, its right 2 matches blue's left 2.
  const wallSetup = (): Board => {
    const board = withCard(emptyBoard(), 2, card([1, 1, 1, 2]), 'blue');
    return withCard(board, 1, card([10, 2, 1, 1]), 'red');
  };

  it('counts an A facing the edge as a match', () => {
    const { captures } = place(wallSetup(), 1, rules({ same: true, sameWall: true }));

    expect(captures).toEqual([{ position: 2, cause: 'same', from: 'blue', to: 'red', wave: 0 }]);
  });

  it('does not count walls without the Same Wall rule', () => {
    expect(place(wallSetup(), 1, rules({ same: true })).captures).toEqual([]);
  });

  it('has no effect unless Same is on', () => {
    expect(place(wallSetup(), 1, rules({ sameWall: true })).captures).toEqual([]);
  });

  it('only counts A values facing the wall', () => {
    let board = withCard(emptyBoard(), 2, card([1, 1, 1, 2]), 'blue');
    board = withCard(board, 1, card([9, 2, 1, 1]), 'red');

    expect(place(board, 1, rules({ same: true, sameWall: true })).captures).toEqual([]);
  });
});

describe('Plus', () => {
  // Red's top 3 + blue's bottom 4 = 7, and red's right 2 + blue's left 5 = 7.
  const plusSetup = (elements: Parameters<typeof emptyBoard>[0] = {}): Board => {
    let board = withCard(emptyBoard(elements), 1, card([1, 1, 4, 1]), 'blue');
    board = withCard(board, 5, card([1, 1, 1, 5]), 'blue');
    return withCard(board, 4, card([3, 2, 1, 1]), 'red');
  };

  it('captures when two touching pairs have the same sum', () => {
    const { captures } = place(plusSetup(), 4, rules({ plus: true }));

    expect(captures).toEqual([
      { position: 1, cause: 'plus', from: 'blue', to: 'red', wave: 0 },
      { position: 5, cause: 'plus', from: 'blue', to: 'red', wave: 0 },
    ]);
  });

  it('does nothing when the rule is off', () => {
    expect(place(plusSetup(), 4, rules()).captures).toEqual([]);
  });

  it('does nothing when the sums differ', () => {
    let board = withCard(emptyBoard(), 1, card([1, 1, 4, 1]), 'blue');
    board = withCard(board, 5, card([1, 1, 1, 6]), 'blue');
    board = withCard(board, 4, card([3, 2, 1, 1]), 'red');

    expect(place(board, 4, rules({ plus: true })).captures).toEqual([]);
  });

  it('compares printed numbers, ignoring elemental modifiers', () => {
    expect(place(plusSetup({ 4: 'poison' }), 4, rules({ plus: true })).captures).toHaveLength(2);
  });

  it('reports Same before Plus when both apply to a card', () => {
    // Top: 3 = 3 (Same, sum 6). Right: 3 = 3 (Same, sum 6). Both rules match both cards.
    let board = withCard(emptyBoard(), 1, card([1, 1, 3, 1]), 'blue');
    board = withCard(board, 5, card([1, 1, 1, 3]), 'blue');
    board = withCard(board, 4, card([3, 3, 1, 1]), 'red');

    const { captures } = place(board, 4, rules({ same: true, plus: true }));

    expect(captures.map((capture) => capture.cause)).toEqual(['same', 'same']);
  });
});

describe('Combo', () => {
  /*
   * Red plays [3, 7, 1, 1] at the centre: Same captures blue at 1 and 5.
   * Wave 1: the card at 1 (left 9) captures blue at 0 (right 1).
   * Wave 2: the card at 0 (bottom 9) captures blue at 3 (top 1).
   */
  const comboSetup = (): Board => {
    let board = withCard(emptyBoard(), 1, card([1, 1, 3, 9]), 'blue');
    board = withCard(board, 5, card([1, 1, 1, 7]), 'blue');
    board = withCard(board, 0, card([1, 1, 9, 1]), 'blue');
    board = withCard(board, 3, card([1, 5, 1, 1]), 'blue');
    return withCard(board, 4, card([3, 7, 1, 1]), 'red');
  };

  it('chains basic captures from cards taken by Same, in waves', () => {
    const { board, captures } = place(comboSetup(), 4, rules({ same: true, combo: true }));

    expect(captures).toEqual([
      { position: 1, cause: 'same', from: 'blue', to: 'red', wave: 0 },
      { position: 5, cause: 'same', from: 'blue', to: 'red', wave: 0 },
      { position: 0, cause: 'combo', from: 'blue', to: 'red', wave: 1 },
      { position: 3, cause: 'combo', from: 'blue', to: 'red', wave: 2 },
    ]);
    expect([0, 1, 3, 4, 5].map((position) => controllerAt(board, position as Position))).toEqual([
      'red',
      'red',
      'red',
      'red',
      'red',
    ]);
  });

  it('does not chain when the Combo rule is off', () => {
    const { captures } = place(comboSetup(), 4, rules({ same: true }));

    expect(captures.map((capture) => capture.position)).toEqual([1, 5]);
  });

  it('is not started by basic captures', () => {
    let board = withCard(emptyBoard(), 1, card([1, 1, 1, 9]), 'blue');
    board = withCard(board, 0, card([1, 1, 1, 1]), 'blue');
    board = withCard(board, 4, card([9, 1, 1, 1]), 'red');

    const { captures } = place(board, 4, rules({ same: true, plus: true, combo: true }));

    expect(captures).toEqual([{ position: 1, cause: 'basic', from: 'blue', to: 'red', wave: 0 }]);
  });
});

describe('effectiveValue', () => {
  it('rejects an empty cell', () => {
    expect(() => effectiveValue({ element: null, placed: null }, 'top')).toThrow();
  });
});
