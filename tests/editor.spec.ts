import { test, expect, type Page } from '@playwright/test';
async function sample(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'Try the interactive demo' }).click(); await expect(page.getByRole('button', { name: 'Review & export' })).toBeVisible(); }
test('sample, repeated matches, undo/redo, developer mode and reviewed export', async ({ page }) => {
  await sample(page);
  await page.getByRole('button', { name: 'Close findings' }).click();
  await page.getByRole('button', { name: 'Recognized text: maya@example.com. Hide or find matches.', exact: true }).first().click();
  await page.getByRole('button', { name: 'Hide all matches (2)' }).click();
  await expect(page.locator('.editor-status')).toContainText('2 redactions');
  await page.getByRole('button', { name: 'Undo (Ctrl Z)', exact: true }).click(); await expect(page.locator('.editor-status')).toContainText('0 redactions');
  await page.getByRole('button', { name: 'Redo (Ctrl Shift Z)', exact: true }).click(); await expect(page.locator('.editor-status')).toContainText('2 redactions');
  await page.getByRole('button', { name: 'Developer Mode', exact: true }).click();
  await page.getByRole('button', { name: /Findings/ }).click();
  await expect(page.getByText('Secret assignment', { exact: true })).toBeVisible();
  await page.locator('.finding').filter({ hasText: 'API_KEY=' }).getByRole('button', { name: 'Hide', exact: true }).click();
  await page.getByRole('button', { name: 'Review & export' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('img', { name: /Final sanitized PNG/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /visually reviewed/ }).check();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PNG' }).click(); expect((await download).suggestedFilename()).toContain('-sharesafe.png');
});
test('manual geometry and keyboard movement survive zoom and undo', async ({ page }) => {
  await sample(page); await page.getByRole('button', { name: 'Close findings' }).click();
  const box = (await page.locator('.image-stage').boundingBox())!;
  await page.mouse.move(box.x + box.width * .05, box.y + box.height * .08); await page.mouse.down(); await page.mouse.move(box.x + box.width * .3, box.y + box.height * .18); await page.mouse.up();
  await expect(page.locator('.redaction-region')).toHaveCount(1);
  const before = await page.locator('.redaction-region').getAttribute('style');
  await page.locator('.redaction-region').focus(); await page.keyboard.press('ArrowRight');
  expect(await page.locator('.redaction-region').getAttribute('style')).not.toBe(before);
  await page.keyboard.press('Control+z'); expect(await page.locator('.redaction-region').getAttribute('style')).toBe(before);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click(); await expect(page.locator('.redaction-region')).toHaveAttribute('style', before!);
  await page.locator('.redaction-region').focus(); await page.keyboard.press('Delete'); await expect(page.locator('.redaction-region')).toHaveCount(0);
});
test('fresh PNG replaces hidden pixels, retains transparency, strips metadata, and decorates dimensions', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const { exportPng, validatePng } = await import('/src/lib/export.ts');
    const canvas = document.createElement('canvas'); canvas.width = 50; canvas.height = 40; const c = canvas.getContext('2d')!; c.fillStyle = '#ff0000'; c.fillRect(5, 5, 20, 15);
    const source = { canvas, width: 50, height: 40, name: 'secret.png' };
    const result = [];
    for (const style of ['black', 'neutral', 'label'] as const) {
      const blob = await exportPng(source, [{ id: 'a', x: 4.4, y: 4.4, width: 21.2, height: 16.2, style }], 'plain');
      const bitmap = await createImageBitmap(blob); const output = document.createElement('canvas'); output.width = bitmap.width; output.height = bitmap.height; const ctx = output.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const data = ctx.getImageData(5, 5, 20, 15).data; let redPixels = 0; let transparent = 0;
      for (let i = 0; i < data.length; i += 4) { if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) redPixels++; if (data[i + 3] !== 255) transparent++; }
      const buffer = new DataView(await blob.arrayBuffer()); let offset = 8; const chunks = [];
      while (offset < buffer.byteLength) { const n = buffer.getUint32(offset); chunks.push(String.fromCharCode(...new Uint8Array(buffer.buffer, offset + 4, 4))); offset += n + 12; }
      result.push({ style, redPixels, transparent, outsideAlpha: ctx.getImageData(0, 0, 1, 1).data[3], size: await validatePng(blob), chunks });
    }
    const share = await validatePng(await exportPng(source, [], 'share')); const github = await validatePng(await exportPng(source, [], 'github'));
    return { result, share, github };
  });
  for (const r of results.result) { expect(r.redPixels).toBe(0); expect(r.transparent).toBe(0); expect(r.outsideAlpha).toBe(0); expect(r.size).toEqual({ width: 50, height: 40 }); expect(r.chunks.some(c => ['eXIf', 'tEXt', 'iTXt', 'zTXt'].includes(c))).toBe(false); }
  expect(results.share).toEqual({ width: 88, height: 78 }); expect(results.github).toEqual({ width: 88, height: 118 });
});
test('OCR failure leaves manual editing and retry available', async ({ page }) => {
  await page.route('**/ocr/**', route => route.abort()); await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64') });
  await expect(page.locator('.ocr-status')).toContainText('Text recognition unavailable', { timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled(); await expect(page.getByRole('button', { name: 'Draw rectangle (R)', exact: true })).toBeEnabled();
});
test('local OCR recognizes an imported screenshot without external requests', async ({ page }) => {
  const remote: string[] = []; page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5173') && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) remote.push(request.url()); });
  await page.goto('/');
  const base64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1000; c.height = 200; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, 1000, 200); x.fillStyle = '#000'; x.font = '36px Arial'; x.fillText('Contact maya@example.com', 40, 90); return c.toDataURL().split(',')[1]; });
  await page.locator('input[type=file]').setInputFiles({ name: 'ocr-check.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
  await expect(page.locator('.ocr-status')).toContainText('text regions recognized', { timeout: 60000 });
  await expect(page.getByText('Email address', { exact: true })).toBeVisible(); expect(remote).toEqual([]);
});
test('mobile 320px workflow, toolbar, findings sheet and fullscreen export', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await sample(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('.finding').first().getByRole('button', { name: 'Hide', exact: true }).click();
  await page.getByRole('button', { name: 'Close findings' }).click();
  await expect(page.getByRole('toolbar', { name: 'Editing tools' })).toBeVisible();
  await page.getByRole('button', { name: 'Review & export' }).click();
  expect((await page.getByRole('dialog').boundingBox())!.width).toBe(320);
  await expect(page.getByRole('img', { name: /Final sanitized PNG/ })).toBeVisible(); await page.getByRole('checkbox', { name: /visually reviewed/ }).check(); await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/mobile-export.png', fullPage: true });
});
test('landing and editor visual capture', async ({ page }) => {
  await page.goto('/'); await page.screenshot({ path: 'test-results/landing.png', fullPage: true }); await sample(page); await page.screenshot({ path: 'test-results/editor.png', fullPage: true });
  await page.getByRole('button', { name: 'Close screenshot and return home' }).click(); await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: 'test-results/mobile-landing.png', fullPage: true });
});
