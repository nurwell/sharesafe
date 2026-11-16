import { test, expect } from '@playwright/test';
test('redesigned landing controls, responsive layouts and console', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  for (const name of ['The workflow', 'Privacy & export']) { await page.getByRole('link', { name, exact: true }).click(); await expect(page.locator(page.url().split('#')[1] === 'privacy' ? '#privacy' : '#how-it-works')).toBeInViewport(); }
  for (const summary of await page.locator('.new-faq summary').all()) { await summary.click(); await expect(summary.locator('..')).toHaveAttribute('open', ''); await summary.click(); }
  await page.getByRole('button', { name: 'Open Developer Mode demo' }).click(); await expect(page.getByText('Secret assignment', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Close screenshot and return home' }).click();
  await page.getByRole('button', { name: 'Open Quick Clean demo' }).click(); await expect(page.getByRole('button', { name: 'Quick Clean', exact: true })).toHaveClass('active'); await page.getByRole('button', { name: 'Close screenshot and return home' }).click();
  const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Open a screenshot', exact: true }).click(); await chooser;
  for (const width of [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `artifacts/redesign-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Try the interactive demo' }).focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('button', { name: 'Review & export' })).toBeVisible(); expect(errors).toEqual([]);
});
