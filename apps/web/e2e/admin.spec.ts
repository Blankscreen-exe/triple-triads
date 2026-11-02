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
  // The grid is paged, weakest cards last: search for it.
  await page
    .getByRole('search', { name: 'Filter cards' })
    .getByLabel('Search')
    .fill('Garden Chocobo');
  await expect(page.getByRole('link', { name: 'Edit Garden Chocobo' })).toBeVisible();
});

test('starter decks are previewed, and each has a page with its cards and stats', async ({
  page,
}) => {
  await logInAsAdmin(page);
  await page.goto('/admin/starter-decks');

  // Each deck shows a few of its cards and its numbers; the whole panel opens the deck.
  const wanderer = page.getByRole('region', { name: 'Wanderer' });
  await expect(wanderer.getByText('Default', { exact: true })).toBeVisible();
  await expect(wanderer).toContainText('Cards20 / 20');
  await expect(wanderer.getByRole('list', { name: 'Elements' })).toContainText('Holy');
  await wanderer.getByRole('link', { name: 'Wanderer' }).click();

  await expect(page).toHaveURL(/\/admin\/starter-decks\/starter-wanderer$/);
  await expect(page.getByRole('heading', { name: 'Wanderer', level: 1 })).toBeVisible();
  const cards = page.getByRole('list', { name: 'Deck contents' }).getByRole('listitem');
  await expect(cards).toHaveCount(10);
  await expect(cards.first().getByRole('img', { name: /^Seraph,/ })).toBeVisible();
  await expect(cards.filter({ hasText: '×3' })).toHaveCount(2);
  const stats = page.getByRole('region', { name: 'Deck stats' });
  await expect(stats.getByRole('list', { name: 'Elements' })).toContainText('No element ×14');

  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit starter deck' })).toBeVisible();
});

test('an admin gives a new starter deck to players who signed up before it', async ({
  page,
  browser,
}) => {
  const player = await (await browser.newContext()).newPage();
  await signUp(player, uniqueUsername());
  const deckName = `Gift ${uniqueUsername()}`;

  await logInAsAdmin(page);
  await page.goto('/admin/starter-decks');
  await page.getByLabel('New starter deck name').fill(deckName);
  await page.getByRole('button', { name: 'New starter deck' }).click();
  await expect(page.getByRole('heading', { name: 'Edit starter deck' })).toBeVisible();
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: deckName, level: 1 })).toBeVisible();

  page.on('dialog', (dialog) => void dialog.accept());
  const give = page.getByRole('button', { name: 'Give to every player' });
  await give.click();
  await expect(page.getByRole('status')).toHaveText(/^Given to \d+ players\.$/);

  await player.goto('/decks');
  await expect(player.getByRole('heading', { name: deckName })).toBeVisible();

  await page.reload();
  await give.click();
  await expect(page.getByRole('status')).toHaveText('Every player already has it.');

  // New players in the other tests get the default starter decks only.
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL('/admin/starter-decks');
  await expect(page.getByRole('region', { name: deckName })).toHaveCount(0);
});

test('an admin bans and unbans a player', async ({ page, browser }) => {
  const playerName = uniqueUsername();
  const player = await (await browser.newContext()).newPage();
  await signUp(player, playerName);

  await logInAsAdmin(page);
  await page.goto('/admin/users');
  // Every test signs players up, so find this one by name.
  await page.getByRole('search', { name: 'Find users' }).getByLabel('Username').fill(playerName);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(`/admin/users?q=${playerName}`);
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
