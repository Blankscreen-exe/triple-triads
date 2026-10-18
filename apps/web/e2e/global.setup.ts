import { expect, test as setup } from '@playwright/test';
import { ADMIN, submitSignUp } from './helpers';

setup('create the admin account', async ({ page }) => {
  await submitSignUp(page, ADMIN.username, ADMIN.password);
  await expect(page.getByText(`Welcome back, ${ADMIN.username}`)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toBeVisible();
});
