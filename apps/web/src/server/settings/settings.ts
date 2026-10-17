/**
 * Game settings stored in the database. Read on every use (cheap with SQLite), so changes made
 * in the admin panel apply at once in both the web app and the game server.
 */
import { DEFAULT_DECK_RULES, DEFAULT_SCORING } from '@triple-triad/engine';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import {
  DEFAULT_ROOM_POLICY,
  deckRulesSchema,
  fromDeckRules,
  fromScoringConfig,
  roomPolicySchema,
  scoringSchema,
  toDeckRules,
  toScoringConfig,
  type DeckRuleSettings,
  type GameSettings,
  type RoomPolicy,
  type ScoringSettings,
} from '@/lib/validation/settings';
import type { DbExecutor } from '../db/client';
import { settings } from '../db/schema';

interface SettingDefinitions {
  scoring: ScoringSettings;
  deckRules: DeckRuleSettings;
  roomPolicy: RoomPolicy;
}
type SettingKey = keyof SettingDefinitions;

const DEFINITIONS: {
  [K in SettingKey]: { schema: z.ZodType<SettingDefinitions[K]>; fallback: SettingDefinitions[K] };
} = {
  scoring: { schema: scoringSchema, fallback: fromScoringConfig(DEFAULT_SCORING) },
  deckRules: { schema: deckRulesSchema, fallback: fromDeckRules(DEFAULT_DECK_RULES) },
  roomPolicy: { schema: roomPolicySchema, fallback: DEFAULT_ROOM_POLICY },
};

function readSetting<K extends SettingKey>(db: DbExecutor, key: K): SettingDefinitions[K] {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  const definition = DEFINITIONS[key];
  if (!row) return definition.fallback;
  // Stored values are validated again on read: a bad row falls back to defaults instead of
  // breaking every page.
  const parsed = definition.schema.safeParse(row.value);
  return parsed.success ? parsed.data : definition.fallback;
}

export function getGameSettings(db: DbExecutor): GameSettings {
  return {
    scoring: toScoringConfig(readSetting(db, 'scoring')),
    deckRules: toDeckRules(readSetting(db, 'deckRules')),
    roomPolicy: readSetting(db, 'roomPolicy'),
  };
}

/** The editable form of every setting, for the admin panel. */
export function getEditableSettings(db: DbExecutor): SettingDefinitions {
  return {
    scoring: readSetting(db, 'scoring'),
    deckRules: readSetting(db, 'deckRules'),
    roomPolicy: readSetting(db, 'roomPolicy'),
  };
}

export type SettingUpdate = { readonly ok: true } | { readonly ok: false; readonly error: string };

/** Validates and stores a setting. */
export function updateSetting(db: DbExecutor, key: SettingKey, value: unknown): SettingUpdate {
  const parsed = DEFINITIONS[key].schema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid value.' };
  }

  db.insert(settings)
    .values({ key, value: parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: parsed.data, updatedAt: new Date() },
    })
    .run();
  return { ok: true };
}
