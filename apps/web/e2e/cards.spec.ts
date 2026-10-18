import { expect, test } from '@playwright/test';
import { signUp, uniqueUsername } from './helpers';

test('the trunk shows every owned card drawn with the default pack', async ({ page }) => {
  await signUp(page, uniqueUsername());

  await page.goto('/trunk');

  await expect(page.getByText('21 cards', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Sky Wyrm, 5 stars, top A, right 4, bottom 6, left 9, Wind element',
    }),
  ).toBeVisible();
  // Sand Lizard is in two starter decks: 3 + 2 copies.
  const sandLizard = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('img', { name: /^Sand Lizard,/ }) });
  await expect(sandLizard.getByLabel('5 copies')).toBeVisible();
});

test('the default asset pack is served', async ({ request }) => {
  for (const file of ['bg-blue', 'bg-red', 'frame', 'card-back', 'digits', 'elements', 'stars']) {
    const response = await request.get(`/packs/default/${file}.png`);
    expect(response.status(), file).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
  }
});
