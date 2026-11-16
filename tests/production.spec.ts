import { test, expect } from '@playwright/test';
test('production import, local OCR, redaction, reviewed PNG and download', async ({ page }) => {
  const failures: string[] = []; page.on('pageerror', e => failures.push(e.message));
  await page.goto('/'); await expect(page.getByRole('heading', { level: 1 })).toContainText('Hide it once.');
  const image = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 240; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000'; x.font = '36px Arial'; x.fillText('Contact hello@example.com', 30, 100); return c.toDataURL().split(',')[1]; });
  await page.locator('input[type=file]').setInputFiles({ name: 'production-check.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await expect(page.getByText('Email address', { exact: true })).toBeVisible({ timeout: 60000 });
  await page.locator('.finding').getByRole('button', { name: 'Hide', exact: true }).click();
  await page.getByRole('button', { name: 'Review & export' }).click(); await expect(page.getByRole('img', { name: /Final sanitized PNG/ })).toBeVisible();
  await expect(page.getByText('0 unresolved', { exact: true })).toBeVisible(); await page.getByRole('checkbox', { name: /visually reviewed/ }).check();
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PNG' }).click(); expect((await downloading).suggestedFilename()).toBe('production-check-sharesafe.png');
  expect(failures).toEqual([]);
});
