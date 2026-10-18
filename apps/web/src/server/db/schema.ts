/**
 * Database schema (SQLite via Drizzle ORM).
 *
 * Changing this file requires a migration: run `pnpm --filter @triple-triad/web db:generate`
 * and commit the generated SQL in `apps/web/drizzle/`.
 */
import { ELEMENTS } from '@triple-triad/engine';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

export const USER_ROLES = ['player', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CARD_KINDS = ['generic', 'custom'] as const;
export type CardKind = (typeof CARD_KINDS)[number];

/** SQL list literal for a CHECK constraint, e.g. `('a', 'b')`. */
const sqlList = (values: readonly string[]) =>
  sql.raw(`(${values.map((value) => `'${value}'`).join(', ')})`);

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    /** Display name, as typed at sign-up. */
    username: text('username').notNull(),
    /** Lower-cased username; unique, so names differing only in case cannot coexist. */
    usernameKey: text('username_key').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: USER_ROLES }).notNull().default('player'),
    activeDeckId: text('active_deck_id').references((): AnySQLiteColumn => decks.id, {
      onDelete: 'set null',
    }),
    /** Elo rating (design/SPEC.md, section 10). */
    rating: integer('rating').notNull().default(1000),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    /** Positive for consecutive wins, negative for consecutive losses. Draws leave it unchanged. */
    streak: integer('streak').notNull().default(0),
    /** Set while the account is banned: it cannot log in and has no sessions. */
    bannedAt: integer('banned_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (table) => [
    check('users_role_valid', sql`${table.role} in ${sqlList(USER_ROLES)}`),
    index('users_rating_idx').on(table.rating),
  ],
);

export const MATCH_WINNERS = ['red', 'blue'] as const;

/** One finished game, with the ratings before and after for each player. */
export const matches = sqliteTable(
  'matches',
  {
    id: text('id').primaryKey(),
    /** Players are kept as null if their account is later deleted, so history survives. */
    redUserId: text('red_user_id').references((): AnySQLiteColumn => users.id, {
      onDelete: 'set null',
    }),
    blueUserId: text('blue_user_id').references((): AnySQLiteColumn => users.id, {
      onDelete: 'set null',
    }),
    /** Null for a draw. */
    winner: text('winner', { enum: MATCH_WINNERS }),
    redScore: integer('red_score').notNull(),
    blueScore: integer('blue_score').notNull(),
    forfeit: integer('forfeit', { mode: 'boolean' }).notNull(),
    /** Rounds played: more than 1 when drawn rounds were replayed (design/SPEC.md, 9.7). */
    rounds: integer('rounds').notNull().default(1),
    redRatingBefore: integer('red_rating_before').notNull(),
    redRatingAfter: integer('red_rating_after').notNull(),
    blueRatingBefore: integer('blue_rating_before').notNull(),
    blueRatingAfter: integer('blue_rating_after').notNull(),
    playedAt: integer('played_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    check(
      'matches_winner_valid',
      sql`${table.winner} is null or ${table.winner} in ${sqlList(MATCH_WINNERS)}`,
    ),
    index('matches_red_user_idx').on(table.redUserId, table.playedAt),
    index('matches_blue_user_idx').on(table.blueUserId, table.playedAt),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 of the session token. The token itself is only ever stored in the cookie. */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Storage key of the card art; null until art is uploaded. */
    artKey: text('art_key'),
    top: integer('top').notNull(),
    right: integer('right').notNull(),
    bottom: integer('bottom').notNull(),
    left: integer('left').notNull(),
    element: text('element', { enum: ELEMENTS }),
    kind: text('kind', { enum: CARD_KINDS }).notNull(),
    /** Player who made a custom card; null for generic cards. */
    creatorId: text('creator_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [
    check('cards_kind_valid', sql`${table.kind} in ${sqlList(CARD_KINDS)}`),
    check(
      'cards_element_valid',
      sql`${table.element} is null or ${table.element} in ${sqlList(ELEMENTS)}`,
    ),
    check('cards_top_range', sql`${table.top} between 1 and 10`),
    check('cards_right_range', sql`${table.right} between 1 and 10`),
    check('cards_bottom_range', sql`${table.bottom} between 1 and 10`),
    check('cards_left_range', sql`${table.left} between 1 and 10`),
    check(
      'cards_creator_matches_kind',
      sql`(${table.kind} = 'generic' and ${table.creatorId} is null) or (${table.kind} = 'custom' and ${table.creatorId} is not null)`,
    ),
    index('cards_creator_id_idx').on(table.creatorId),
  ],
);

/**
 * Generic cards a player owns, with the number of copies. A player's own custom cards are not
 * listed here: their creator has unlimited copies.
 */
export const trunkCards = sqliteTable(
  'trunk_cards',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cardId] }),
    check('trunk_cards_quantity_positive', sql`${table.quantity} > 0`),
  ],
);

export const decks = sqliteTable(
  'decks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: createdAt(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('decks_user_id_idx').on(table.userId)],
);

export const deckCards = sqliteTable(
  'deck_cards',
  {
    deckId: text('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.deckId, table.cardId] }),
    check('deck_cards_quantity_positive', sql`${table.quantity} > 0`),
  ],
);

/** Decks every new player receives. Managed by admins. */
export const starterDecks = sqliteTable(
  'starter_decks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** The deck pre-selected as a new player's active deck. At most one. */
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('starter_decks_single_default_idx')
      .on(table.isDefault)
      .where(sql`${table.isDefault} = 1`),
  ],
);

export const starterDeckCards = sqliteTable(
  'starter_deck_cards',
  {
    starterDeckId: text('starter_deck_id')
      .notNull()
      .references(() => starterDecks.id, { onDelete: 'cascade' }),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.starterDeckId, table.cardId] }),
    check('starter_deck_cards_quantity_positive', sql`${table.quantity} > 0`),
  ],
);

/** Admin-editable game settings, one JSON value per key (validated by the settings service). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Uploaded asset-pack parts: one row per owner (a user id, or "default" for the admin's changes to
 * the default pack). `files` maps each replaced part to its storage key; missing parts fall back
 * to the default pack.
 */
export const assetPacks = sqliteTable('asset_packs', {
  owner: text('owner').primaryKey(),
  files: text('files', { mode: 'json' }).notNull().$type<Record<string, string>>(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
