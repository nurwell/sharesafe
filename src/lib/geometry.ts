import type { Rect } from '../types';
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export function constrain(r: Rect, width: number, height: number): Rect {
  const x = clamp(Math.min(r.x, r.x + r.width), 0, width);
  const y = clamp(Math.min(r.y, r.y + r.height), 0, height);
  return { x, y, width: clamp(Math.max(r.x, r.x + r.width), x, width) - x, height: clamp(Math.max(r.y, r.y + r.height), y, height) - y };
}
export function contains(r: Rect, x: number, y: number) { return x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height; }
export function imagePoint(clientX: number, clientY: number, bounds: { left: number; top: number; width: number; height: number }, width: number, height: number) {
  return { x: (clientX - bounds.left) * width / bounds.width, y: (clientY - bounds.top) * height / bounds.height };
}
export function covers(outer: Rect, inner: Rect) {
  return outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;
}
export function padded(r: Rect, width: number, height: number) { return constrain({ x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 }, width, height); }
