import { expect, test } from '@playwright/test';
import { formError, logIn, logInAsAdmin, signUp, uniqueUsername } from './helpers';

test('the admin area is invisible to players', async ({ page }) => {
  await signUp(page, uniqueUsername());

  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
});

test('an admin creates a generic card', async ({ page }) => {
  await logInAsAdmin(page);
  await page.goto('/admin/cards/new');

  await page.getByLabel('Name', { exact: true }).fill('Garden Chocobo');
  await page.getByLabel('Top', { exact: true }).selectOption('6');
  await page.getByLabel('Element', { exact: true }).selectOption('wind');
  await page.getByRole('button', { name: 'Save card' }).click();

  await expect(page).toHaveURL('/admin/cards');
  await expect(page.getByRole('link', { name: 'Edit Garden Chocobo' })).toBeVisible();
});

test('an admin bans and unbans a player', async ({ page, browser }) => {
  const playerName = uniqueUsername();
  const player = await (await browser.newContext()).newPage();
  await signUp(player, playerName);

  await logInAsAdmin(page);
  await page.goto('/admin/users');
  const row = page.getByRole('row', { name: playerName });
  page.once('dialog', (dialog) => void dialog.accept());
  await row.getByRole('button', { name: 'Ban' }).click();
  await expect(row.getByText('Banned')).toBeVisible();

  // The player's session ended; logging in again is refused.
  await player.goto('/decks');
  await expect(player).toHaveURL('/login');
  await logIn(player, playerName);
  await expect(formError(player)).toHaveText('This account has been suspended.');

  await row.getByRole('button', { name: 'Unban' }).click();
  await expect(row.getByText('Banned')).toHaveCount(0);
  await logIn(player, playerName);
  await expect(player.getByText(`Welcome back, ${playerName}`)).toBeVisible();
});

test('settings changes reach players straight away', async ({ page, browser }) => {
  await logInAsAdmin(page);
  await page.goto('/admin/settings');
  const ranking = page.getByRole('region', { name: 'Card ranking' });
  const rooms = page.getByRole('region', { name: 'Room options' });

  await ranking.getByLabel('Element bonus').fill('25');
  await ranking.getByRole('button', { name: 'Save' }).click();
  await expect(ranking.getByText('Saved.')).toBeVisible();
  await rooms.getByLabel('Lock Turn timer').check();
  await rooms.getByRole('button', { name: 'Save' }).click();
  await expect(rooms.getByText('Saved.')).toBeVisible();

  try {
    const player = await (await browser.newContext()).newPage();
    await signUp(player, uniqueUsername());
    await player.goto('/cards/new');
    await expect(player.getByRole('option', { name: 'Fire (+25 score)' })).toBeAttached();
    await player.goto('/play');
    await expect(player.getByLabel('Turn timer')).toBeDisabled();
  } finally {
    // Other tests rely on the default settings.
    await ranking.getByLabel('Element bonus').fill('10');
    await ranking.getByRole('button', { name: 'Save' }).click();
    await expect(ranking.getByText('Saved.')).toBeVisible();
    await rooms.getByLabel('Lock Turn timer').uncheck();
    await rooms.getByRole('button', { name: 'Save' }).click();
    await expect(rooms.getByText('Saved.')).toBeVisible();
  }
});
