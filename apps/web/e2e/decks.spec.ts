import { expect, test, type Page } from '@playwright/test';
import { signUp, uniqueUsername } from './helpers';

const deckList = (page: Page) => page.getByRole('list', { name: 'Decks' });
const deckNames = (page: Page) => deckList(page).getByRole('heading').allTextContents();
const filters = (page: Page) => page.getByRole('search', { name: 'Filter decks' });

test('the deck list shows each deck’s stats, with the active deck first', async ({ page }) => {
  await signUp(page, uniqueUsername());
  await page.goto('/decks');

  await expect(filters(page)).toContainText('3 decks');
  // The active deck comes first; the others follow by most recent change.
  await expect.poll(async () => (await deckNames(page))[0]).toBe('Wanderer');
  expect((await deckNames(page)).toSorted()).toEqual(['Elementalist', 'Vanguard', 'Wanderer']);
  const wanderer = deckList(page).getByRole('listitem', { name: 'Wanderer' });
  await expect(wanderer.getByText('Active', { exact: true })).toBeVisible();
  await expect(wanderer.getByText('Ready', { exact: true })).toBeVisible();
  await expect(wanderer).toContainText('Cards20 / 20');
  await expect(wanderer).toContainText(/Average\d\.\d★/);
  // The active deck can't be made active again.
  await expect(wanderer.getByRole('button', { name: 'Make active' })).toHaveCount(0);

  // A long list scrolls inside its own area rather than stretching the page.
  await expect(deckList(page)).toHaveCSS('overflow-y', 'auto');
});

test('decks can be searched and filtered, and the filters stay in the URL', async ({ page }) => {
  await signUp(page, uniqueUsername());
  await page.goto('/decks');
  await expect(filters(page)).toContainText('3 decks');

  await filters(page).getByLabel('Search').fill('GUARD');
  await expect(page).toHaveURL(/\/decks\?q=GUARD$/);
  await expect.poll(() => deckNames(page)).toEqual(['Vanguard']);
  await expect(filters(page)).toContainText('Showing 1 of 3 decks');

  await page.reload();
  await expect.poll(() => deckNames(page)).toEqual(['Vanguard']);

  await filters(page).getByRole('button', { name: 'Clear filters' }).click();
  await filters(page).getByLabel('Status').selectOption('needs-fixing');
  // Every starter deck follows the rules.
  await expect(page.getByText('No decks match these filters.')).toBeVisible();

  await filters(page).getByLabel('Status').selectOption('');
  await filters(page).getByLabel('Sort').selectOption('name');
  await expect.poll(() => deckNames(page)).toEqual(['Elementalist', 'Vanguard', 'Wanderer']);
});

test('each deck can be edited on its own page, or deleted', async ({ page }) => {
  await signUp(page, uniqueUsername());
  await page.goto('/decks');

  await deckList(page)
    .getByRole('listitem', { name: 'Vanguard' })
    .getByRole('link', { name: 'Edit' })
    .click();
  await expect(page).toHaveURL(/\/decks\/[\w-]+$/);
  await expect(page.getByRole('heading', { name: 'Edit deck' })).toBeVisible();
  await expect(page.getByLabel('Deck name', { exact: true })).toHaveValue('Vanguard');

  await page.goto('/decks');
  page.once('dialog', (dialog) => void dialog.accept());
  await deckList(page)
    .getByRole('listitem', { name: 'Elementalist' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect.poll(() => deckNames(page)).toEqual(['Wanderer', 'Vanguard']);
  await expect(filters(page)).toContainText('2 decks');
});
