import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { ADMIN, formError, logIn, logInAsAdmin, signUp, uniqueUsername } from './helpers';

test('an admin downloads a backup and restores it, replacing everything since', async ({
  page,
  browser,
}, testInfo) => {
  await logInAsAdmin(page);
  await page.goto('/admin/backup');

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download backup' }).click();
  const backup = await download;
  expect(backup.suggestedFilename()).toMatch(/^triple-triad-backup-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/);
  const backupPath = testInfo.outputPath('backup.zip');
  await backup.saveAs(backupPath);
  const entries = unzipSync(await readFile(backupPath));
  expect(JSON.parse(strFromU8(entries['manifest.json'] ?? new Uint8Array()))).toMatchObject({
    format: 'triple-triad-backup',
  });

  // Someone signs up after the backup was made.
  const latecomer = uniqueUsername();
  const other = await (await browser.newContext()).newPage();
  await signUp(other, latecomer);

  const restore = page.getByRole('region', { name: 'Import' });
  await restore.getByLabel('Backup file').setInputFiles(backupPath);
  const button = restore.getByRole('button', { name: 'Restore backup' });
  await expect(button).toBeDisabled();
  await restore.getByText('I understand').click();
  page.once('dialog', (dialog) => void dialog.accept());
  await button.click();

  await expect(restore.getByRole('status')).toContainText('Backup restored.');
  await expect(restore.getByRole('status')).toContainText('Everyone has been logged out');

  // The latecomer's account did not exist when the backup was made; the admin's did.
  await logIn(other, latecomer);
  await expect(formError(other)).toHaveText('Wrong username or password.');
  await restore.getByRole('link', { name: 'Log in' }).click();
  await logIn(page, ADMIN.username, ADMIN.password);
  await expect(page.getByText(`Welcome back, ${ADMIN.username}`)).toBeVisible();
});

test('a file that is not a backup is refused', async ({ page }) => {
  await logInAsAdmin(page);
  await page.goto('/admin/backup');
  const restore = page.getByRole('region', { name: 'Import' });

  await restore.getByLabel('Backup file').setInputFiles({
    name: 'holiday.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not really a zip'),
  });
  await restore.getByText('I understand').click();
  page.once('dialog', (dialog) => void dialog.accept());
  await restore.getByRole('button', { name: 'Restore backup' }).click();

  await expect(restore.getByRole('alert')).toHaveText('That file is not a Triple Triad backup.');
});

test('players cannot download or restore backups', async ({ page }) => {
  await signUp(page, uniqueUsername());

  expect((await page.request.get('/admin/backup/download')).status()).toBe(404);
  expect(
    (await page.request.post('/admin/backup/restore', { data: Buffer.from('x') })).status(),
  ).toBe(404);
});
