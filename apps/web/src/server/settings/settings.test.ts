import { DEFAULT_DECK_RULES, DEFAULT_SCORING } from '@triple-triad/engine';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROOM_POLICY,
  applyRoomPolicy,
  fromDeckRules,
  fromScoringConfig,
} from '@/lib/validation/settings';
import { settings } from '../db/schema';
import { listDecks } from '../decks/decks';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import { listTrunk } from '../trunk/trunk';
import { getEditableSettings, getGameSettings, updateSetting } from './settings';

describe('game settings', () => {
  it('fall back to the built-in defaults', () => {
    const db = createTestDatabase();

    expect(getGameSettings(db)).toEqual({
      scoring: DEFAULT_SCORING,
      deckRules: DEFAULT_DECK_RULES,
      roomPolicy: DEFAULT_ROOM_POLICY,
    });
  });

  it('store a valid update', () => {
    const db = createTestDatabase();
    const scoring = { ...fromScoringConfig(DEFAULT_SCORING), elementBonus: 25 };

    expect(updateSetting(db, 'scoring', scoring)).toEqual({ ok: true });
    expect(getGameSettings(db).scoring.elementBonus).toBe(25);
    expect(getEditableSettings(db).scoring).toEqual(scoring);
  });

  it('reject a score table that does not increase', () => {
    const db = createTestDatabase();
    const base = fromScoringConfig(DEFAULT_SCORING);

    const result = updateSetting(db, 'scoring', {
      ...base,
      statScores: { ...base.statScores, '5': 10 },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Each stat value must score more than the one below it.',
    });
  });

  it('load a room policy saved before the match format existed, keeping its locks', () => {
    const db = createTestDatabase();
    const { rules, allowSpectators } = DEFAULT_ROOM_POLICY.defaults;
    db.insert(settings)
      .values({
        key: 'roomPolicy',
        // As stored by earlier versions: no `format`.
        value: { defaults: { rules, turnSeconds: 60, allowSpectators }, locked: ['turnSeconds'] },
      })
      .run();

    expect(getGameSettings(db).roomPolicy).toEqual({
      defaults: { ...DEFAULT_ROOM_POLICY.defaults, turnSeconds: 60, format: 'until-winner' },
      locked: ['turnSeconds'],
    });
  });

  it('ignore a corrupted stored value instead of breaking the app', () => {
    const db = createTestDatabase();
    db.insert(settings)
      .values({ key: 'deckRules', value: { starCaps: 'garbage' } })
      .run();

    expect(getGameSettings(db).deckRules).toEqual(DEFAULT_DECK_RULES);
  });

  it('change how cards are ranked and decks are checked straight away', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    const base = fromScoringConfig(DEFAULT_SCORING);
    // Double every stat score: most cards gain stars.
    const doubled = Object.fromEntries(
      Object.entries(base.statScores).map(([key, value]) => [key, value * 2]),
    );
    updateSetting(db, 'scoring', { ...base, statScores: doubled });
    updateSetting(db, 'deckRules', {
      starCaps: { ...fromDeckRules(DEFAULT_DECK_RULES).starCaps, '5': 0 },
    });

    const lizard = listTrunk(db, user.id).find((entry) => entry.card.name === 'Sand Lizard');
    expect(lizard?.card.stars).toBe(2); // 108 × 2 = 216 → 2 stars (was 1)
    expect(listDecks(db, user.id)[0]?.violations.some((v) => v.code === 'STAR_CAP_EXCEEDED')).toBe(
      true,
    );
  });
});

describe('applyRoomPolicy', () => {
  it('forces locked options to their default and leaves the rest alone', () => {
    const policy = { ...DEFAULT_ROOM_POLICY, locked: ['same', 'turnSeconds', 'format'] as const };
    const requested = {
      rules: {
        open: true,
        same: false,
        plus: false,
        combo: false,
        sameWall: true,
        elemental: 'all' as const,
      },
      turnSeconds: null,
      allowSpectators: false,
      format: 'single' as const,
      carryHand: false,
    };

    expect(applyRoomPolicy(requested, { ...policy, locked: [...policy.locked] })).toEqual({
      rules: { ...requested.rules, same: true },
      turnSeconds: 30,
      allowSpectators: false,
      format: 'until-winner',
      carryHand: false,
    });
  });
});
