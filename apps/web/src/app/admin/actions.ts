'use server';

/**
 * Admin server actions. Each one checks the caller is an admin: actions are public endpoints and
 * must not rely on the page that renders them having checked.
 */
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import type { CardFormState } from '@/components/cards/card-form';
import type { ActionResult } from '@/components/ui/action-button';
import type { SaveDeckResult } from '@/components/decks/deck-editor';
import { deckContentsSchema, deckNameSchema } from '@/lib/validation/deck';
import { removeCustomCard } from '@/server/admin/moderation';
import { resetPassword, setBanned, setRole, type UserAdminError } from '@/server/admin/users';
import { cardErrorMessage, readCardForm } from '@/server/cards/card-form-data';
import { deleteGenericCard, saveGenericCard } from '@/server/cards/generic-cards';
import {
  createStarterDeck,
  deleteStarterDeck,
  saveStarterDeck,
  setDefaultStarterDeck,
} from '@/server/catalog/starter-decks';
import { getDatabase } from '@/server/db';
import { DEFAULT_PACK_OWNER, resetPack } from '@/server/packs/asset-packs';
import { handlePackReset, handlePackUpload, type PackFormResult } from '@/server/packs/pack-form';
import { updateSetting, type SettingUpdate } from '@/server/settings/settings';
import { getStorage } from '@/server/storage';
import { requireAdmin } from '@/server/web/current-user';

type AdminActionResult = ActionResult;

// ---- Users ---------------------------------------------------------------------------------

const USER_ERRORS: Record<UserAdminError, string> = {
  USER_NOT_FOUND: 'That user no longer exists.',
  CANNOT_CHANGE_SELF: 'You cannot do that to your own account.',
  ADMIN_CANNOT_BE_BANNED: 'Demote this admin before banning them.',
  LAST_ADMIN: 'There must always be at least one admin.',
};

export type UserCommand = 'ban' | 'unban' | 'promote' | 'demote' | 'reset-password';

export async function userAction(userId: unknown, command: unknown): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (typeof userId !== 'string') return { ok: false, error: 'Invalid request.' };
  const db = getDatabase();

  let result;
  switch (command) {
    case 'ban':
    case 'unban':
      result = setBanned(db, admin.id, userId, command === 'ban');
      break;
    case 'promote':
    case 'demote':
      result = setRole(db, admin.id, userId, command === 'promote' ? 'admin' : 'player');
      break;
    case 'reset-password': {
      const reset = await resetPassword(db, admin.id, userId);
      if (!reset.ok) return { ok: false, error: USER_ERRORS[reset.error] };
      refresh();
      return { ok: true, message: `New password: ${reset.data.password}` };
    }
    default:
      return { ok: false, error: 'Invalid request.' };
  }
  if (!result.ok) return { ok: false, error: USER_ERRORS[result.error] };
  refresh();
  return { ok: true };
}

// ---- Generic cards -------------------------------------------------------------------------

export async function saveGenericCardAction(
  _previous: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  await requireAdmin();
  const form = await readCardForm(formData);
  if (!form.ok) return { error: form.error };

  const cardId = formData.get('cardId');
  const result = await saveGenericCard(
    getDatabase(),
    getStorage(),
    typeof cardId === 'string' && cardId !== '' ? cardId : null,
    form.input,
    form.art,
  );
  if (!result.ok) {
    return {
      error:
        result.error === 'CARD_NOT_FOUND' || result.error === 'IN_STARTER_DECK'
          ? 'That card no longer exists.'
          : cardErrorMessage(result.error),
    };
  }
  redirect('/admin/cards');
}

export async function deleteGenericCardAction(cardId: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (typeof cardId !== 'string') return { ok: false, error: 'Invalid request.' };
  const result = await deleteGenericCard(getDatabase(), getStorage(), cardId);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === 'IN_STARTER_DECK'
          ? 'Remove this card from every starter deck before deleting it.'
          : 'That card no longer exists.',
    };
  }
  redirect('/admin/cards');
}

// ---- Starter decks -------------------------------------------------------------------------

export interface NewStarterDeckState {
  readonly error: string | null;
}

export async function createStarterDeckAction(
  _previous: NewStarterDeckState,
  formData: FormData,
): Promise<NewStarterDeckState> {
  await requireAdmin();
  const name = deckNameSchema.safeParse(formData.get('name'));
  if (!name.success) return { error: name.error.issues[0]?.message ?? 'Invalid name.' };
  const result = createStarterDeck(getDatabase(), name.data);
  if (!result.ok) return { error: 'Could not create the deck.' };
  redirect(`/admin/starter-decks/${result.data.deckId}`);
}

export async function saveStarterDeckAction(
  deckId: unknown,
  contents: unknown,
): Promise<SaveDeckResult> {
  await requireAdmin();
  if (typeof deckId !== 'string') return { ok: false, error: 'Invalid deck.' };
  const parsed = deckContentsSchema.safeParse(contents);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid deck.' };
  }
  const result = saveStarterDeck(getDatabase(), deckId, parsed.data);
  if (result.ok) return { ok: true };
  return {
    ok: false,
    error:
      result.error === 'TOO_MANY_CARDS'
        ? 'A deck can hold at most 20 cards.'
        : result.error === 'NOT_A_GENERIC_CARD'
          ? 'Starter decks may only contain generic cards.'
          : 'That deck no longer exists.',
  };
}

export async function starterDeckAction(
  deckId: unknown,
  command: unknown,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (typeof deckId !== 'string') return { ok: false, error: 'Invalid request.' };
  const db = getDatabase();
  const result =
    command === 'make-default'
      ? setDefaultStarterDeck(db, deckId)
      : command === 'delete'
        ? deleteStarterDeck(db, deckId)
        : null;
  if (!result) return { ok: false, error: 'Invalid request.' };
  if (!result.ok) return { ok: false, error: 'That deck no longer exists.' };
  refresh();
  return { ok: true };
}

// ---- Settings ------------------------------------------------------------------------------

export async function updateSettingAction(key: unknown, value: unknown): Promise<SettingUpdate> {
  await requireAdmin();
  if (key !== 'scoring' && key !== 'deckRules' && key !== 'roomPolicy') {
    return { ok: false, error: 'Unknown setting.' };
  }
  const result = updateSetting(getDatabase(), key, value);
  if (result.ok) refresh();
  return result;
}

// ---- Moderation ----------------------------------------------------------------------------

export async function removeCustomCardAction(cardId: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (typeof cardId !== 'string') return { ok: false, error: 'Invalid request.' };
  if (!(await removeCustomCard(getDatabase(), getStorage(), cardId))) {
    return { ok: false, error: 'That card no longer exists.' };
  }
  refresh();
  return { ok: true };
}

// ---- Asset packs ---------------------------------------------------------------------------

/** Replaces part of the default pack, which every player's pack builds on. */
export async function uploadDefaultPackPart(formData: FormData): Promise<PackFormResult> {
  await requireAdmin();
  const result = await handlePackUpload(getDatabase(), getStorage(), DEFAULT_PACK_OWNER, formData);
  if (result.ok) refresh();
  return result;
}

export async function resetDefaultPackPart(part: unknown): Promise<PackFormResult> {
  await requireAdmin();
  const result = await handlePackReset(getDatabase(), getStorage(), DEFAULT_PACK_OWNER, part);
  if (result.ok) refresh();
  return result;
}

/** Moderation: removes everything a player uploaded to their pack. */
export async function resetPlayerPackAction(userId: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (typeof userId !== 'string' || userId === DEFAULT_PACK_OWNER) {
    return { ok: false, error: 'Invalid request.' };
  }
  await resetPack(getDatabase(), getStorage(), userId);
  refresh();
  return { ok: true };
}
