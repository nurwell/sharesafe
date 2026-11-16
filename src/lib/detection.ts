import type { Finding, Mode, Rect, Word } from '../types';
import { covers } from './geometry';
function valueRect(word: Word, start: number, end: number): Rect {
  const symbols = word.symbols;
  if (!symbols?.length || word.confidence < 80 || symbols.map(s => s.text).join('') !== word.text || symbols.some((s, i) => s.confidence < 80 || !covers(word, s) || (i > 0 && s.x < symbols[i - 1].x))) return { x: word.x, y: word.y, width: word.width, height: word.height };
  let index = 0;
  const selected = symbols.filter(s => { const from = index; index += s.text.length; return from < end && index > start; });
  if (!selected.length) return word;
  const x = Math.min(...selected.map(s => s.x)), y = Math.min(...selected.map(s => s.y));
  return { x, y, width: Math.max(...selected.map(s => s.x + s.width)) - x, height: Math.max(...selected.map(s => s.y + s.height)) - y };
}
export function normalize(text: string) { return text.normalize('NFKC').trim().replace(/^["'`([{]+|["'`),;\]}]+$/g, '').toLocaleLowerCase('en-US'); }
export function matches(words: Word[], text: string) { const n = normalize(text); return n ? words.filter(w => normalize(w.text) === n) : []; }
export function detect(words: Word[], mode: Mode): Finding[] {
  const result: Finding[] = [];
  const counts = new Map<string, number>();
  words.forEach(w => counts.set(normalize(w.text), (counts.get(normalize(w.text)) ?? 0) + 1));
  for (const w of words) {
    const t = w.text; let kind = ''; let start = 0; let end = t.length;
    if (/^["'(]?[\w.+-]+@[\w.-]+\.[a-z]{2,}["'),;.]?$/i.test(t)) kind = 'Email address';
    else if (/^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(t) && t.split(':')[0].split('.').every(p => +p <= 255)) kind = 'IP address';
    else if (/^\+?[\d().-]{7,}$/.test(t) && t.replace(/\D/g, '').length >= 7) kind = 'Possible phone number';
    else if (/^@[\w.-]{3,}$/.test(t)) kind = 'Username';
    if (mode === 'developer') {
      const assignment = /^(?:[A-Z_][A-Z\d_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL)[A-Z\d_]*|PASSWORD|TOKEN|SECRET|API_KEY)\s*[=:]\s*["']?(.+?)["']?$/i.exec(t);
      const env = /^[A-Z][A-Z\d_]{2,}=["']?(.+?)["']?$/.exec(t);
      const query = /[?&](?:token|key|api_key|password|secret|auth)=([^&#]+)/i.exec(t);
      if (assignment || env) { const m = assignment ?? env!; kind = assignment ? 'Secret assignment' : 'Environment value (review)'; start = t.indexOf(m[1], t.indexOf('=') >= 0 ? t.indexOf('=') + 1 : t.indexOf(':') + 1); end = start + m[1].length; }
      else if (/^(?:sk[_-]|gh[pousr]_|github_pat_|AKIA|xox[baprs]-|eyJ)[\w.-]{8,}/.test(t)) kind = 'Possible API key or token';
      else if (/^(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\//i.test(t)) kind = 'Database connection string';
      else if (query) {
        kind = 'Sensitive URL parameter';
        const occurrences = [...t.matchAll(/[?&](?:token|key|api_key|password|secret|auth)=([^&#]+)/gi)];
        // Cover the full URL if it contains several secrets, so resolving one
        // finding can never leave another sensitive parameter exposed.
        if (occurrences.length === 1) { start = query.index + query[0].indexOf('=') + 1; end = start + query[1].length; }
      }
      else if (/\.(?:internal|local|corp|lan)(?::\d+)?(?:\/|$)/i.test(t) || /^localhost(?::\d+)?/.test(t)) kind = 'Internal hostname';
      else if ((counts.get(normalize(t)) ?? 0) > 1 && /^(?=[\w.-]{8,}$)(?=.*\d)(?=.*[a-z])[\w.-]+$/i.test(t)) kind = 'Repeated identifier (review)';
      const prev = words[words.indexOf(w) - 1];
      if (prev && /^Bearer$/i.test(prev.text) && Math.abs(prev.y - w.y) < w.height) kind = 'Bearer token';
      if (prev && /(?:password|token|secret|api[_-]?key)["']?\s*[=:]$/i.test(prev.text) && Math.abs(prev.y - w.y) < w.height) kind = 'Secret value';
    }
    if (kind) {
      // Preserve variable names only when character boxes agree with the word.
      // Uncertain positions deliberately fall back to covering the whole word.
      const rect = start > 0 || end < t.length ? valueRect(w, start, end) : w;
      result.push({ id: w.id, text: t, kind, rect });
    }
  }
  return result;
}
