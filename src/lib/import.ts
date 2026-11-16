import type { Source } from '../types';
export async function importImage(file: File): Promise<Source> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > 30 * 1024 * 1024) throw new Error('Choose an image smaller than 30 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 24_000_000) throw new Error('This image is too large. Please resize to under 24 megapixels.');
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable in this browser.');
    ctx.drawImage(image, 0, 0); image.src = '';
    return { canvas, width: canvas.width, height: canvas.height, name: file.name };
  } finally { URL.revokeObjectURL(url); }
}
