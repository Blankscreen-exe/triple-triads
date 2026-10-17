import { expect, type Page } from '@playwright/test';

const PASSWORD = 'correct horse battery';

/** A username no other test (or retry) will use. */
export function uniqueUsername(): string {
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.slice(0, 20);
}

export async function submitSignUp(page: Page, username: string, password = PASSWORD) {
  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();
}

/** Signs up and waits until the session is established (the app redirects home). */
export async function signUp(page: Page, username: string) {
  await submitSignUp(page, username);
  await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
}

/** The form's error message (Next.js renders its own, empty, route-announcer alert too). */
export const formError = (page: Page) => page.locator('form').getByRole('alert');

export async function logIn(page: Page, username: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

/** Created by global.setup.ts before any other test, so it is the admin. */
export const ADMIN = { username: 'e2e-admin', password: 'admin password 123' } as const;

export async function logInAsAdmin(page: Page) {
  await logIn(page, ADMIN.username, ADMIN.password);
  await expect(page.getByText(`Welcome back, ${ADMIN.username}`)).toBeVisible();
}
