import { test, expect, type Page } from '@playwright/test';
async function screenshot(page: Page, text: string) {
  return page.evaluate(t => { const c = document.createElement('canvas'); c.width = 900; c.height = 200; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 200); x.fillStyle = '#000'; x.font = '32px Arial'; x.fillText(t, 30, 90); return c.toDataURL().split(',')[1]; }, text);
}
test('same filename imports reset ignored findings and manual blocks', async ({ page }) => {
  await page.goto('/'); const first = await screenshot(page, 'old@example.com');
  const input = page.locator('input[type=file]');
  await input.setInputFiles({ name: 'same.png', mimeType: 'image/png', buffer: Buffer.from(first, 'base64') });
  await expect(page.locator('.finding-value')).toContainText('old@example.com', { timeout: 60000 });
  await page.getByRole('button', { name: 'Ignore', exact: true }).click(); await page.getByRole('button', { name: 'Add redaction block with keyboard' }).click();
  const second = await screenshot(page, 'new@example.com'); await input.setInputFiles({ name: 'same.png', mimeType: 'image/png', buffer: Buffer.from(second, 'base64') });
  await expect(page.locator('.finding-value')).toContainText('new@example.com', { timeout: 60000 });
  await expect(page.locator('.word-region')).toHaveCount(1); await expect(page.locator('.redaction-region')).toHaveCount(0); await expect(page.locator('.editor-status')).toContainText('0 redactions');
});
test('failed language asset recovers and keyboard can create first block', async ({ page }) => {
  await page.route('**/ocr/eng.traineddata.gz', r => r.abort()); await page.goto('/'); const image = await screenshot(page, 'Private example');
  await page.locator('input[type=file]').setInputFiles({ name: 'failed-language.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await expect(page.locator('.ocr-status')).toContainText('Text recognition unavailable', { timeout: 30000 });
  await page.getByRole('button', { name: 'Add redaction block with keyboard' }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.redaction-region')).toHaveCount(1); await expect(page.locator('.redaction-region')).toBeFocused();
  const before = await page.locator('.redaction-region').getAttribute('style'); await page.keyboard.press('Alt+ArrowRight'); expect(await page.locator('.redaction-region').getAttribute('style')).not.toBe(before);
  await page.unroute('**/ocr/eng.traineddata.gz'); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(page.locator('.ocr-status')).toContainText('text regions recognized', { timeout: 60000 });
});
test('paste and drop imports work, but cannot replace a screenshot during export', async ({ page }) => {
  await page.goto('/'); const image = await screenshot(page, 'Sample screenshot');
  const paste = (name: string) => page.evaluate(async ({ image, name }) => {
    const bytes = Uint8Array.from(atob(image), c => c.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([bytes], name, { type: 'image/png' })); window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { image, name });
  await paste('pasted.png'); await expect(page.locator('.editor-filename')).toContainText('pasted.png');
  await page.getByRole('button', { name: 'Review & export' }).click(); await expect(page.getByRole('img', { name: /Final sanitized PNG/ })).toBeVisible();
  await paste('should-not-open.png'); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.locator('.editor-filename')).toContainText('pasted.png');
  await page.getByRole('button', { name: 'Close export preview' }).click();
  await page.evaluate((image) => { const bytes = Uint8Array.from(atob(image), c => c.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([bytes], 'dropped.png', { type: 'image/png' })); window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, image);
  await expect(page.locator('.editor-filename')).toContainText('dropped.png');
});
test('drawing can start over recognized text and pan does not create blocks', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Try the interactive demo' }).click(); await page.getByRole('button', { name: 'Close findings' }).click();
  const box = (await page.locator('.word-region').first().boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + 2); await page.mouse.down(); await page.mouse.move(box.x + 90, box.y + 30); await page.mouse.up();
  await expect(page.locator('.redaction-region')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pan (H)', exact: true }).click(); const other = (await page.locator('.word-region').last().boundingBox())!;
  await page.mouse.move(other.x + 2, other.y + 2); await page.mouse.down(); await page.mouse.move(other.x + 30, other.y + 20); await page.mouse.up(); await expect(page.locator('.redaction-region')).toHaveCount(1);
});
test('mobile pinch zoom and two-finger pan preserve original-coordinate geometry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await page.getByRole('button', { name: 'Try the interactive demo' }).click(); await page.getByRole('button', { name: 'Close findings' }).click();
  await page.getByRole('button', { name: 'Add redaction block with keyboard' }).click();
  const geometry = await page.locator('.redaction-region').getAttribute('style');
  const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const box = (await page.locator('.image-stage').boundingBox())!; const x = box.x + box.width / 2; const y = box.y + box.height / 2;
  const before = await page.locator('.zoom-label').textContent();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 25, y, id: 0 }, { x: x + 25, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 65, y, id: 0 }, { x: x + 65, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.zoom-label')).not.toHaveText(before!);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 130, y, id: 0 }, { x: 220, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y, id: 0 }, { x: 170, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.locator('.canvas-viewport').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await expect(page.locator('.redaction-region')).toHaveAttribute('style', geometry!); await expect(page.locator('.redaction-region')).toHaveCount(1); await cdp.detach();
});
test('small redactions can be moved and resized using separate pointer targets', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Try the interactive demo' }).click(); await page.getByRole('button', { name: 'Close findings' }).click();
  const box = (await page.locator('.image-stage').boundingBox())!;
  const x = box.x + 30, y = box.y + 30;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 10, y + 10); await page.mouse.up();
  const initial = await page.locator('.redaction-region').getAttribute('style');
  await page.mouse.move(x + 3, y + 3); await page.mouse.down(); await page.mouse.move(x + 23, y + 13); await page.mouse.up();
  const moved = await page.locator('.redaction-region').getAttribute('style'); expect(moved).not.toBe(initial);
  expect(moved!.match(/width:[^;]+/)![0]).toBe(initial!.match(/width:[^;]+/)![0]);
  const handle = (await page.locator('.resize-handle').boundingBox())!;
  await page.mouse.move(handle.x + 4, handle.y + 4); await page.mouse.down(); await page.mouse.move(handle.x + 24, handle.y + 14); await page.mouse.up();
  expect((await page.locator('.redaction-region').getAttribute('style'))!.match(/width:[^;]+/)![0]).not.toBe(moved!.match(/width:[^;]+/)![0]);
});
