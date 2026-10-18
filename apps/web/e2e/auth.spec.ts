import { expect, test } from '@playwright/test';
import { formError, logIn, signUp, submitSignUp, uniqueUsername } from './helpers';

test('a new player signs up and gets the starter decks', async ({ page }) => {
  const username = uniqueUsername();

  await signUp(page, username);

  await expect(page).toHaveURL('/profile');
  await expect(page.getByText('Your active deck is Wanderer')).toBeVisible();

  await page.getByRole('link', { name: 'Your decks' }).click();
  for (const deck of ['Wanderer', 'Elementalist', 'Vanguard']) {
    await expect(page.getByRole('heading', { name: deck })).toBeVisible();
  }
});

test('a player switches their active deck', async ({ page }) => {
  await signUp(page, uniqueUsername());
  await page.goto('/decks');

  const vanguard = page.getByRole('listitem', { name: 'Vanguard' });
  await vanguard.getByRole('button', { name: 'Make active' }).click();

  await expect(vanguard.getByText('Active', { exact: true })).toBeVisible();
  await page.goto('/profile');
  await expect(page.getByText('Your active deck is Vanguard')).toBeVisible();
});

test('a player logs out and back in', async ({ page }) => {
  const username = uniqueUsername();
  await signUp(page, username);

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();

  await logIn(page, username.toUpperCase());
  await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
});

test('a wrong password is rejected without saying which field was wrong', async ({ page }) => {
  const username = uniqueUsername();
  await signUp(page, username);
  await page.getByRole('button', { name: 'Log out' }).click();

  await logIn(page, username, 'not the password');

  await expect(formError(page)).toHaveText('Wrong username or password.');
  await expect(page.getByLabel('Username')).toHaveValue(username);
});

test('a taken username cannot be registered again', async ({ page, browser }) => {
  const username = uniqueUsername();
  await signUp(page, username);

  const other = await browser.newPage();
  await submitSignUp(other, username.toUpperCase());

  await expect(formError(other)).toHaveText('That username is already taken.');
  await other.close();
});

test('signed-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/decks');

  await expect(page).toHaveURL('/login');
});

test('the profile tab shows the player’s deck and record; home links to it', async ({ page }) => {
  const username = uniqueUsername();
  await signUp(page, username);

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Your profile' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Profile' })
    .click();

  await expect(page).toHaveURL('/profile');
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
  await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
  await expect(page.getByText('Your active deck is Wanderer')).toBeVisible();

  // The username in the header leads to the same page.
  await page.goto('/rules');
  await page.getByRole('link', { name: username, exact: true }).click();
  await expect(page).toHaveURL('/profile');
});

test('signed-out visitors are sent from the profile to the login page', async ({ page }) => {
  await page.goto('/profile');

  await expect(page).toHaveURL('/login');
});
