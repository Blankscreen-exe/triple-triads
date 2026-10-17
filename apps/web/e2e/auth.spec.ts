import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'correct horse battery';

/** A username no other test (or retry) will use. */
function uniqueUsername(): string {
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.slice(0, 20);
}

async function submitSignUp(page: Page, username: string, password = PASSWORD) {
  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();
}

/** Signs up and waits until the session is established (the app redirects home). */
async function signUp(page: Page, username: string) {
  await submitSignUp(page, username);
  await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
}

/** The form's error message (Next.js renders its own, empty, route-announcer alert too). */
const formError = (page: Page) => page.locator('form').getByRole('alert');

async function logIn(page: Page, username: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test('a new player signs up and gets the starter decks', async ({ page }) => {
  const username = uniqueUsername();

  await signUp(page, username);

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Your active deck is Wanderer')).toBeVisible();

  await page.getByRole('link', { name: 'Your decks' }).click();
  for (const deck of ['Wanderer', 'Elementalist', 'Vanguard']) {
    await expect(page.getByRole('heading', { name: deck })).toBeVisible();
  }
});

test('a player switches their active deck', async ({ page }) => {
  await signUp(page, uniqueUsername());
  await page.goto('/decks');

  const vanguard = page.locator('section', {
    has: page.getByRole('heading', { name: 'Vanguard' }),
  });
  await vanguard.getByRole('button', { name: 'Make active' }).click();

  await expect(vanguard.getByText('Active', { exact: true })).toBeVisible();
  await page.goto('/');
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
