import type { Redaction, Source } from '../types';
import { constrain } from './geometry';
export type Presentation = 'plain' | 'share' | 'github';
export function sanitizedCanvas(source: Source, redactions: Redaction[]) {
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable.');
  ctx.drawImage(source.canvas, 0, 0);
  for (const r of redactions) {
    const bounded = constrain(r, source.width, source.height);
    const x = Math.floor(bounded.x), y = Math.floor(bounded.y);
    const width = Math.ceil(bounded.x + bounded.width) - x, height = Math.ceil(bounded.y + bounded.height) - y;
    if (!width || !height) continue;
    // Clear first: replacement is opaque even over transparent source pixels.
    ctx.clearRect(x, y, width, height); ctx.fillStyle = r.style === 'black' ? '#171914' : '#d9ddd1'; ctx.fillRect(x, y, width, height);
    if (r.style === 'label') {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
      ctx.fillStyle = '#171914'; ctx.font = `600 ${Math.max(8, Math.min(18, height * .5))}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('[REDACTED]', x + width / 2, y + height / 2, Math.max(1, width - 4)); ctx.restore();
    }
  }
  return canvas;
}
export async function exportPng(source: Source, redactions: Redaction[], presentation: Presentation): Promise<Blob> {
  const clean = sanitizedCanvas(source, redactions);
  let output = clean;
  if (presentation !== 'plain') {
    const pad = Math.round(Math.min(source.width, source.height) * .075) + 16;
    output = document.createElement('canvas'); output.width = clean.width + pad * 2; output.height = clean.height + pad * 2 + (presentation === 'github' ? 40 : 0);
    const ctx = output.getContext('2d')!; ctx.fillStyle = presentation === 'github' ? '#f6f8fa' : '#e7eddf'; ctx.fillRect(0, 0, output.width, output.height);
    const top = pad + (presentation === 'github' ? 40 : 0);
    if (presentation === 'github') { ctx.fillStyle = '#565b50'; ctx.font = '14px monospace'; ctx.fillText('Screenshot · ShareSafe', pad, pad + 17); }
    ctx.save(); ctx.beginPath(); ctx.roundRect(pad, top, clean.width, clean.height, Math.min(16, clean.width / 10)); ctx.clip(); ctx.drawImage(clean, pad, top); ctx.restore();
  }
  try { return await new Promise<Blob>((resolve, reject) => output.toBlob(b => b ? resolve(b) : reject(new Error('PNG encoding failed.')), 'image/png')); }
  finally { clean.width = 0; clean.height = 0; if (output !== clean) { output.width = 0; output.height = 0; } }
}
export async function validatePng(blob: Blob) {
  const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (signature.join() !== '137,80,78,71,13,10,26,10') throw new Error('The export is not a valid PNG.');
  const bitmap = await createImageBitmap(blob); const dimensions = { width: bitmap.width, height: bitmap.height }; bitmap.close(); return dimensions;
}
