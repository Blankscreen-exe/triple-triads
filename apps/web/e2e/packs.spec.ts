import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { signUp, uniqueUsername } from './helpers';

async function pngFile(width: number, height: number) {
  const buffer = await sharp({
    create: { width, height, channels: 4, background: { r: 230, g: 40, b: 160, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return { name: 'part.png', mimeType: 'image/png', buffer };
}

test('a player replaces part of their card style and their cards use it', async ({ page }) => {
  await signUp(page, uniqueUsername());
  await page.goto('/packs');
  const stars = page.getByRole('region', { name: 'Stars' });
  await expect(stars.getByText('Default', { exact: true })).toBeVisible();

  await stars.getByLabel('Upload Stars').setInputFiles(await pngFile(120, 60));

  await expect(stars.getByText('Custom', { exact: true })).toBeVisible();
  await page.goto('/trunk');
  const anyCard = page.getByRole('img', { name: /^Sky Wyrm,/ });
  await expect(anyCard.locator('[style*="/media/packs/"]').first()).toBeAttached();

  await page.goto('/packs');
  await page
    .getByRole('region', { name: 'Stars' })
    .getByRole('button', { name: 'Use default' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Stars' }).getByText('Default', { exact: true }),
  ).toBeVisible();
});

test('an image of the wrong size is refused with the size it needs', async ({ page }) => {
  await signUp(page, uniqueUsername());
  await page.goto('/packs');
  const frame = page.getByRole('region', { name: 'Frame' });

  await frame.getByLabel('Upload Frame').setInputFiles(await pngFile(500, 700));

  await expect(frame.getByRole('alert')).toContainText('must be exactly 1024 × 1434');
  await expect(frame.getByText('Default', { exact: true })).toBeVisible();
});

test('the art templates can be downloaded', async ({ page, request }) => {
  await page.goto('/templates');
  const links = page.getByRole('link', { name: /\.png$/ });
  await expect(links).toHaveCount(11);

  for (const href of await links.evaluateAll((anchors) =>
    anchors.map((a) => a.getAttribute('href')),
  )) {
    const response = await request.get(href ?? '');
    expect(response.status(), href ?? '').toBe(200);
  }
});

test('every card style part offers templates and its current image to download', async ({
  page,
}) => {
  await signUp(page, uniqueUsername());
  await page.goto('/packs');

  const frame = page.getByRole('region', { name: 'Frame' });
  const download = page.waitForEvent('download');
  await frame.getByRole('link', { name: 'Download guide lines for Frame' }).click();
  expect((await download).suggestedFilename()).toBe('frame-template-lines.png');
  await expect(
    frame.getByRole('link', { name: 'Download current image for Frame' }),
  ).toHaveAttribute('download', 'frame.png');

  const links = page.getByRole('link', { name: /^Download / });
  // Seven image parts, each with its templates and its current image (no custom font yet).
  expect(await links.count()).toBeGreaterThanOrEqual(14);
  for (const href of await links.evaluateAll((anchors) =>
    anchors.map((a) => a.getAttribute('href') ?? ''),
  )) {
    const response = await page.request.get(href);
    expect(response.status(), href).toBe(200);
    expect(response.headers()['content-type'], href).toBe('image/png');
  }
});
