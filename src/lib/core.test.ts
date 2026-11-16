import { beforeEach, describe, expect, it } from 'vitest';
import { constrain, contains, covers, imagePoint, padded } from './geometry';
import { detect, matches, normalize } from './detection';
import { useEditor } from '../store';
import type { Word, Redaction } from '../types';
const word = (text: string, id = text, x = 10): Word => ({ text, id, x, y: 10, width: 100, height: 20, confidence: 99 });
describe('original-image geometry', () => {
  it('maps a scaled and offset screenshot back to original coordinates', () => expect(imagePoint(150, 90, { left: 50, top: 40, width: 200, height: 100 }, 1000, 500)).toEqual({ x: 500, y: 250 }));
  it('normalizes a backwards drag and clips to image bounds', () => expect(constrain({ x: 50, y: 40, width: -80, height: -70 }, 100, 100)).toEqual({ x: 0, y: 0, width: 50, height: 40 }));
  it('pads near the edge without extending outside the image', () => expect(padded({ x: 0, y: 0, width: 10, height: 10 }, 20, 20)).toEqual({ x: 0, y: 0, width: 13, height: 13 }));
  it('requires complete coverage when resolving a finding', () => { expect(covers({ x: 1, y: 1, width: 5, height: 5 }, { x: 1, y: 1, width: 6, height: 5 })).toBe(false); expect(contains({ x: 1, y: 1, width: 5, height: 5 }, 3, 3)).toBe(true); });
});
describe('text matching', () => {
  it('normalizes case and surrounding punctuation without substring matches', () => { const words = [word('Maya@example.com'), word('maya@example.com,'), word('notmaya@example.com')]; expect(matches(words, 'maya@example.com')).toHaveLength(2); });
  it('does not remove meaningful token characters', () => { expect(normalize('sk_abc-123')).toBe('sk_abc-123'); expect(matches([word('user-123'), word('user_123')], 'user-123')).toHaveLength(1); });
  it('never matches an empty search', () => expect(matches([word('')], '')).toEqual([]));
});
describe('conservative findings', () => {
  it('finds email, phone, IP and username', () => expect(detect([word('a@example.com'), word('+48123456789'), word('10.2.3.4'), word('@nurseyt')], 'quick').map(f => f.kind)).toEqual(['Email address', 'Possible phone number', 'IP address', 'Username']));
  it('rejects invalid IP addresses and short numbers', () => expect(detect([word('999.2.3.4'), word('1234'), word('hello')], 'quick')).toEqual([]));
  it('detects developer secrets only in developer mode', () => { const words = [word('API_KEY=sk_example_secret'), word('postgres://user:pw@db.internal/app'), word('https://example.com?token=secret'), word('service.corp')]; expect(detect(words, 'quick')).toEqual([]); expect(detect(words, 'developer')).toHaveLength(4); });
  it('covers an entire assignment when character bounds are uncertain', () => { const w = word('API_KEY=sk_example_secret'); expect(detect([w], 'developer')[0].rect).toEqual({ x: w.x, y: w.y, width: w.width, height: w.height }); });
  it('preserves the variable name when symbol positions are reliable', () => {
    const text = 'API_KEY=private'; const w = { ...word(text), width: text.length * 10, symbols: [...text].map((text, i) => ({ text, confidence: 99, x: 10 + i * 10, y: 10, width: 10, height: 20 })) };
    expect(detect([w], 'developer')[0].rect).toEqual({ x: 90, y: 10, width: 70, height: 20 });
    w.symbols[9].confidence = 40; expect(detect([w], 'developer')[0].rect.width).toBe(w.width);
  });
  it('redacts the query value even when it also appears in the parameter name', () => {
    const text = 'https://host/?token=token'; const w = { ...word(text), width: text.length * 10, symbols: [...text].map((text, i) => ({ text, confidence: 99, x: 10 + i * 10, y: 10, width: 10, height: 20 })) };
    expect(detect([w], 'developer')[0].rect).toEqual({ x: 210, y: 10, width: 50, height: 20 });
  });
  it('covers all sensitive parameters when a URL contains more than one', () => {
    const text = 'https://host/?token=alpha&password=beta'; const w = { ...word(text), width: text.length * 10, symbols: [...text].map((text, i) => ({ text, confidence: 99, x: 10 + i * 10, y: 10, width: 10, height: 20 })) };
    expect(detect([w], 'developer')[0].rect).toEqual(w);
  });
  it('finds bearer values and separate password assignments', () => expect(detect([word('Bearer'), word('some-token-value'), word('PASSWORD='), word('very-private')], 'developer').map(f => f.kind)).toEqual(['Bearer token', 'Secret value']));
});
describe('undo and redo', () => {
  beforeEach(() => useEditor.getState().reset());
  const r: Redaction = { id: 'a', x: 1, y: 2, width: 3, height: 4, style: 'black' };
  it('undoes and redoes a batch in one operation', () => { useEditor.getState().commit([r, { ...r, id: 'b' }]); useEditor.getState().undo(); expect(useEditor.getState().items).toEqual([]); useEditor.getState().redo(); expect(useEditor.getState().items).toHaveLength(2); });
  it('clears future history after a new edit', () => { useEditor.getState().commit([r]); useEditor.getState().undo(); useEditor.getState().commit([{ ...r, id: 'c' }]); useEditor.getState().redo(); expect(useEditor.getState().items[0].id).toBe('c'); });
  it('resets all screenshot history on close', () => { useEditor.getState().commit([r]); useEditor.getState().reset(); expect(useEditor.getState().past).toEqual([]); expect(useEditor.getState().items).toEqual([]); });
});
