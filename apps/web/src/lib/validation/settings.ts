/**
 * Admin-editable game settings (design/SPEC.md, section 11), validated on the server and used by
 * the admin forms.
 */
import {
  DEFAULT_DECK_RULES,
  DEFAULT_SCORING,
  type DeckRules,
  type ScoringConfig,
  type StatValue,
} from '@triple-triad/engine';
import { z } from 'zod';
import { roomOptionsSchema, type RoomOptions } from '../realtime/protocol';

const STAT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
const STAR_KEYS = ['1', '2', '3', '4', '5'] as const;

const statScore = z.number().int().min(0).max(1000);

export const scoringSchema = z
  .object({
    statScores: z.object(
      Object.fromEntries(STAT_KEYS.map((key) => [key, statScore])) as Record<
        (typeof STAT_KEYS)[number],
        typeof statScore
      >,
    ),
    elementBonus: z.number().int().min(0).max(500),
  })
  .refine(
    ({ statScores }) =>
      STAT_KEYS.slice(1).every(
        (key, index) => statScores[key] > statScores[STAT_KEYS[index] ?? '1'],
      ),
    { message: 'Each stat value must score more than the one below it.', path: ['statScores'] },
  );
export type ScoringSettings = z.infer<typeof scoringSchema>;

/** Maximum cards per star rank in a deck; null means unlimited. */
export const deckRulesSchema = z.object({
  starCaps: z.object(
    Object.fromEntries(
      STAR_KEYS.map((key) => [key, z.number().int().min(0).max(20).nullable()]),
    ) as Record<(typeof STAR_KEYS)[number], z.ZodNullable<z.ZodNumber>>,
  ),
});
export type DeckRuleSettings = z.infer<typeof deckRulesSchema>;

/** Room options an admin can lock to their default value. */
export const LOCKABLE_OPTIONS = [
  'open',
  'same',
  'plus',
  'combo',
  'sameWall',
  'elemental',
  'turnSeconds',
  'allowSpectators',
] as const;
export type LockableOption = (typeof LOCKABLE_OPTIONS)[number];

export const roomPolicySchema = z.object({
  defaults: roomOptionsSchema,
  locked: z.array(z.enum(LOCKABLE_OPTIONS)).refine((keys) => new Set(keys).size === keys.length),
});
export type RoomPolicy = z.infer<typeof roomPolicySchema>;

export interface GameSettings {
  readonly scoring: ScoringConfig;
  readonly deckRules: DeckRules;
  readonly roomPolicy: RoomPolicy;
}

export const DEFAULT_ROOM_POLICY: RoomPolicy = {
  defaults: {
    rules: { open: false, same: true, plus: true, combo: true, sameWall: false, elemental: 'off' },
    turnSeconds: 30,
    allowSpectators: true,
  },
  locked: [],
};

export function toScoringConfig(settings: ScoringSettings): ScoringConfig {
  const statScores = Object.fromEntries(
    STAT_KEYS.map((key) => [Number(key), settings.statScores[key]]),
  ) as Record<StatValue, number>;
  return { statScores, elementBonus: settings.elementBonus, maxStars: DEFAULT_SCORING.maxStars };
}

export function fromScoringConfig(config: ScoringConfig): ScoringSettings {
  return {
    statScores: Object.fromEntries(
      STAT_KEYS.map((key) => [key, config.statScores[Number(key) as StatValue]]),
    ) as ScoringSettings['statScores'],
    elementBonus: config.elementBonus,
  };
}

export function toDeckRules(settings: DeckRuleSettings): DeckRules {
  const starCaps: Partial<Record<number, number>> = {};
  for (const key of STAR_KEYS) {
    const cap = settings.starCaps[key];
    if (cap !== null) starCaps[Number(key)] = cap;
  }
  return { ...DEFAULT_DECK_RULES, starCaps };
}

export function fromDeckRules(rules: DeckRules): DeckRuleSettings {
  return {
    starCaps: Object.fromEntries(
      STAR_KEYS.map((key) => [key, rules.starCaps[Number(key)] ?? null]),
    ) as DeckRuleSettings['starCaps'],
  };
}

/** Room options after applying the admin's locks: locked options always use their default. */
export function applyRoomPolicy(requested: RoomOptions, policy: RoomPolicy): RoomOptions {
  const locked = new Set(policy.locked);
  const pick = <T>(key: LockableOption, wanted: T, fallback: T): T =>
    locked.has(key) ? fallback : wanted;
  const { defaults } = policy;
  return {
    rules: {
      open: pick('open', requested.rules.open, defaults.rules.open),
      same: pick('same', requested.rules.same, defaults.rules.same),
      plus: pick('plus', requested.rules.plus, defaults.rules.plus),
      combo: pick('combo', requested.rules.combo, defaults.rules.combo),
      sameWall: pick('sameWall', requested.rules.sameWall, defaults.rules.sameWall),
      elemental: pick('elemental', requested.rules.elemental, defaults.rules.elemental),
    },
    turnSeconds: pick('turnSeconds', requested.turnSeconds, defaults.turnSeconds),
    allowSpectators: pick('allowSpectators', requested.allowSpectators, defaults.allowSpectators),
  };
}
