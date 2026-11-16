import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Hand, ImagePlus, Minus, MousePointer2, Plus, Redo2, ScanText, ShieldCheck, Square, Trash2, Undo2, X } from 'lucide-react';
import type { Mode, Rect, Redaction, Source, Style, Word } from '../types';
import { useEditor } from '../store';
import { clamp, constrain, contains, covers, imagePoint, padded } from '../lib/geometry';
import { detect, matches } from '../lib/detection';
import { recognize } from '../lib/ocr';
import ExportReview from './ExportReview';

type Props = { source: Source; sampleWords: Word[]; initialMode?: Mode; onClose: () => void; onOpen: () => void };
type Tool = 'draw' | 'select' | 'pan';
type Drag = { kind: 'draw' | 'move' | 'resize' | 'pan'; start: { x: number; y: number }; original?: Redaction; scroll?: { x: number; y: number } };
const checklist = ['Terminal history', 'Browser tabs and URLs', 'Repository names', 'Local file paths', 'Internal addresses', 'Notifications and background windows'];

export default function Editor({ source, sampleWords, initialMode = 'quick', onClose, onOpen }: Props) {
  const { items, past, future, commit, undo, redo } = useEditor();
  const [tool, setTool] = useState<Tool>('draw'); const [style, setStyle] = useState<Style>('black'); const [mode, setMode] = useState<Mode>(initialMode);
  const [words, setWords] = useState<Word[]>(sampleWords); const [ocrStatus, setOcrStatus] = useState(sampleWords.length ? 'done' : 'idle'); const [progress, setProgress] = useState(0); const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null); const [pickedWord, setPickedWord] = useState<Word | null>(null); const [draft, setDraft] = useState<Redaction | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]); const [findingsOpen, setFindingsOpen] = useState(true); const [review, setReview] = useState(false); const [shortcuts, setShortcuts] = useState(false);
  const [zoom, setZoom] = useState(1); const [fitScale, setFitScale] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null); const imageWrap = useRef<HTMLDivElement>(null); const viewport = useRef<HTMLDivElement>(null); const drag = useRef<Drag | null>(null);
  const points = useRef(new Map<number, { x: number; y: number }>()); const gesture = useRef<{ distance: number; zoom: number; center: { x: number; y: number }; scroll: { x: number; y: number } } | null>(null);
  const findings = useMemo(() => detect(words, mode), [words, mode]);
  const remaining = findings.filter(f => !ignored.includes(f.id) && !items.some(r => covers(r, f.rect)));
  const ignoredCount = findings.filter(f => ignored.includes(f.id) && !items.some(r => covers(r, f.rect))).length;
  const active = items.find(r => r.id === selected);
  useEffect(() => {
    let alive = true; const abort = new AbortController();
    if (sampleWords.length) { setWords(sampleWords); setOcrStatus('done'); return; }
    setOcrStatus('loading'); setProgress(0);
    void recognize(source.canvas, p => { if (alive) setProgress(p); }, abort.signal).then(result => { if (alive) { setWords(result); setOcrStatus('done'); } }).catch(() => { if (alive) setOcrStatus('error'); });
    return () => { alive = false; abort.abort(); };
  }, [source, sampleWords, attempt]);
  useEffect(() => {
    const container = viewport.current!;
    const resize = () => setFitScale(Math.max(.01, Math.min(1, (container.clientWidth - 48) / source.width, (container.clientHeight - 145) / source.height)));
    const observer = new ResizeObserver(resize); observer.observe(container); resize(); return () => observer.disconnect();
  }, [source]);
  const displayed = draft ? [...items.filter(r => r.id !== draft.id), draft] : items;
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    el.width = source.width; el.height = source.height; const c = el.getContext('2d')!; c.clearRect(0, 0, el.width, el.height); c.drawImage(source.canvas, 0, 0);
    for (const r of displayed) { c.fillStyle = r.style === 'black' ? '#171914' : '#d9ddd1'; c.fillRect(Math.floor(r.x), Math.floor(r.y), Math.ceil(r.width), Math.ceil(r.height));
      if (r.style === 'label') { c.save(); c.beginPath(); c.rect(r.x, r.y, r.width, r.height); c.clip(); c.fillStyle = '#171914'; c.font = `600 ${Math.max(8, Math.min(18, r.height * .5))}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('[REDACTED]', r.x + r.width / 2, r.y + r.height / 2, Math.max(1, r.width - 4)); c.restore(); }
    }
  }, [source, displayed]);
  const addRects = (rects: Rect[]) => { const additions = rects.map(rect => ({ ...padded(rect, source.width, source.height), style, id: crypto.randomUUID() })); commit([...items, ...additions]); setPickedWord(null); setSelected(additions[0]?.id ?? null); };
  const addBlock = () => {
    const r = { id: crypto.randomUUID(), x: source.width * .35, y: source.height * .4, width: source.width * .3, height: source.height * .12, style };
    commit([...items, r]); setSelected(r.id); setPickedWord(null); setTool('select');
    requestAnimationFrame(() => imageWrap.current?.querySelectorAll<HTMLButtonElement>('.redaction-region')[items.length]?.focus());
  };
  const deleteSelected = useCallback(() => { if (selected) { commit(items.filter(r => r.id !== selected)); setSelected(null); } }, [items, selected, commit]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (review || (e.target as HTMLElement).matches('input, textarea, select')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); setSelected(null); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      else if (e.key === 'Escape') { setSelected(null); setPickedWord(null); setShortcuts(false); }
      else if (e.key === '?') setShortcuts(v => !v);
      else if (e.key === 'r') setTool('draw'); else if (e.key === 'v') setTool('select'); else if (e.key === 'h') setTool('pan');
      else if (e.key === '0') { setZoom(1); viewport.current?.scrollTo(0, 0); }
      else if (e.key === '+' || e.key === '=') setZoom(z => clamp(z * 1.2, .25, 8)); else if (e.key === '-') setZoom(z => clamp(z / 1.2, .25, 8));
      else if (active && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); const delta = e.shiftKey ? 10 : 1; const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0; const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;
        const r = e.altKey ? { ...active, width: clamp(active.width + dx, 2, source.width - active.x), height: clamp(active.height + dy, 2, source.height - active.y) } : { ...active, x: clamp(active.x + dx, 0, source.width - active.width), y: clamp(active.y + dy, 0, source.height - active.height) };
        commit(items.map(item => item.id === r.id ? r : item));
      }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [active, commit, deleteSelected, items, redo, review, source, undo]);
  const point = (e: { clientX: number; clientY: number }) => imagePoint(e.clientX, e.clientY, imageWrap.current!.getBoundingClientRect(), source.width, source.height);
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.currentTarget.setPointerCapture(e.pointerId);
    if (points.current.size === 2) {
      const [a, b] = [...points.current.values()]; gesture.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom, center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, scroll: { x: viewport.current!.scrollLeft, y: viewport.current!.scrollTop } }; drag.current = null; setDraft(null); return;
    }
    const p = point(e); const handle = (e.target as HTMLElement).closest('.resize-handle');
    const hit = handle ? items.find(r => r.id === selected) : [...items].reverse().find(r => contains(r, p.x, p.y)); setPickedWord(null);
    if (tool === 'pan' || e.button === 1) { drag.current = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, scroll: { x: viewport.current!.scrollLeft, y: viewport.current!.scrollTop } }; return; }
    if (hit) { setSelected(hit.id); drag.current = { kind: handle ? 'resize' : 'move', start: p, original: hit }; return; }
    setSelected(null);
    const word = words.find(w => contains(padded(w, source.width, source.height), p.x, p.y));
    if (word) { setPickedWord(word); if (tool !== 'draw') return; }
    if (tool === 'draw') { const r = { id: crypto.randomUUID(), x: p.x, y: p.y, width: 0, height: 0, style }; setDraft(r); drag.current = { kind: 'draw', start: p, original: r }; }
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!points.current.has(e.pointerId)) return;
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.current && points.current.size >= 2) { const [a, b] = [...points.current.values()]; const g = gesture.current; setZoom(clamp(g.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.distance), .25, 8)); viewport.current!.scrollLeft = g.scroll.x - ((a.x + b.x) / 2 - g.center.x); viewport.current!.scrollTop = g.scroll.y - ((a.y + b.y) / 2 - g.center.y); return; }
    const d = drag.current; if (!d) return;
    if (d.kind === 'pan') { viewport.current!.scrollLeft = d.scroll!.x - (e.clientX - d.start.x); viewport.current!.scrollTop = d.scroll!.y - (e.clientY - d.start.y); return; }
    const p = point(e); const r = d.original!; const dx = p.x - d.start.x; const dy = p.y - d.start.y;
    if (Math.hypot(dx, dy) * fitScale * zoom < 3) return;
    setPickedWord(null);
    if (d.kind === 'draw') setDraft({ ...r, ...constrain({ x: d.start.x, y: d.start.y, width: dx, height: dy }, source.width, source.height) });
    else if (d.kind === 'move') setDraft({ ...r, x: clamp(r.x + dx, 0, source.width - r.width), y: clamp(r.y + dy, 0, source.height - r.height) });
    else setDraft({ ...r, width: clamp(r.width + dx, 2, source.width - r.x), height: clamp(r.height + dy, 2, source.height - r.y) });
  };
  const up = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    points.current.delete(e.pointerId); if (points.current.size < 2) gesture.current = null;
    if (!cancelled && draft && draft.width >= 2 && draft.height >= 2 && drag.current) { commit([...items.filter(r => r.id !== draft.id), draft]); setSelected(draft.id); }
    setDraft(null); drag.current = null;
  };
  const changeStyle = (next: Style) => { setStyle(next); if (active) commit(items.map(r => r.id === active.id ? { ...r, style: next } : r)); };
  const scale = Math.max(.01, fitScale * zoom);
  return <div className="editor-app">
    <header className="editor-header"><div className="editor-brand"><button className="icon-button" onClick={onClose} aria-label="Close screenshot and return home"><ArrowLeft size={19}/></button><span className="wordmark"><ShieldCheck size={21}/>ShareSafe.</span><span className="editor-filename">{source.name}</span></div><div className="editor-header-actions"><button className="icon-button" onClick={onOpen} aria-label="Open another screenshot"><ImagePlus size={20}/></button><button className="button primary" onClick={() => setReview(true)}>Review & export <ArrowLeft className="arrow-forward" size={17}/></button></div></header>
    <div className="editor-options"><fieldset className="segmented"><legend className="sr-only">Detection mode</legend><button className={mode === 'quick' ? 'active' : ''} onClick={() => setMode('quick')}>Quick Clean</button><button className={mode === 'developer' ? 'active' : ''} onClick={() => setMode('developer')}>Developer Mode</button></fieldset><span className="local-note"><span className="status-dot"/> Everything stays on your device</span><button className="text-button findings-toggle" onClick={() => setFindingsOpen(v => !v)} aria-expanded={findingsOpen}><ScanText size={17}/>Findings <span className="count-badge">{remaining.length}</span><ChevronDown size={15}/></button></div>
    <main className="editor-main">
      <div className="canvas-area"><div className="canvas-instructions"><span>{tool === 'draw' ? 'Draw to hide. Click text to find every match.' : tool === 'select' ? 'Select a block to move or resize it.' : 'Drag to pan. Use two fingers to zoom.'}</span><div className="canvas-quick-actions"><button className="text-button" onClick={addBlock} aria-label="Add redaction block with keyboard"><Plus size={13}/>Add block</button><button className="text-button" onClick={() => setShortcuts(v => !v)} aria-expanded={shortcuts}>Shortcuts <kbd>?</kbd></button></div></div>
        {shortcuts && <div className="shortcut-help" role="status">R draw · V select · H pan · + / − zoom · 0 fit · Delete remove · Ctrl/⌘ Z undo · Shift Ctrl/⌘ Z redo. Focus a redaction, then use arrows to move; Shift for 10px; Alt + arrows to resize.</div>}
        <div ref={viewport} className={`canvas-viewport tool-${tool}`} data-testid="canvas-viewport"><div className="canvas-layout"><div ref={imageWrap} className="image-stage" style={{ width: source.width * scale, height: source.height * scale }} onPointerDown={down} onPointerMove={move} onPointerUp={e => up(e)} onPointerCancel={e => up(e, true)}>
          <canvas ref={canvas} aria-label="Screenshot editing canvas. Draw a rectangle to redact. Use recognized text buttons or redaction list for keyboard editing." role="img"/>
          {words.map(w => !items.some(r => covers(r, w)) && <button key={w.id} className={`word-region ${pickedWord?.id === w.id ? 'picked' : ''}`} style={{ left: `${w.x / source.width * 100}%`, top: `${w.y / source.height * 100}%`, width: `${w.width / source.width * 100}%`, height: `${w.height / source.height * 100}%` }} aria-label={`Recognized text: ${w.text}. Hide or find matches.`} onClick={e => { e.stopPropagation(); if (e.detail === 0) { setSelected(null); setPickedWord(w); } }}/>) }
          {displayed.map((r, i) => <button key={r.id} aria-label={`Redaction ${i + 1}. Arrow keys move, Alt arrow keys resize.`} className={`redaction-region ${selected === r.id ? 'selected' : ''}`} style={{ left: `${r.x / source.width * 100}%`, top: `${r.y / source.height * 100}%`, width: `${r.width / source.width * 100}%`, height: `${r.height / source.height * 100}%` }} onFocus={() => setSelected(r.id)} onClick={() => setSelected(r.id)}>{selected === r.id && <span className="resize-handle"/>}</button>)}
        </div></div></div>
        {pickedWord && <div className="context-toolbar" role="region" aria-label="Recognized text actions"><span className="picked-text">{pickedWord.text}</span><button className="button secondary compact" onClick={() => addRects([pickedWord])}>Hide this</button><button className="button primary compact" onClick={() => addRects(matches(words, pickedWord.text))}>Hide all matches ({matches(words, pickedWord.text).length})</button><button className="icon-button" aria-label="Dismiss text selection" onClick={() => setPickedWord(null)}><X size={16}/></button></div>}
        {active && !pickedWord && <div className="context-toolbar" role="region" aria-label="Selected redaction actions"><span className="small">Selected block</span><label className="small">Style <select value={active.style} onChange={e => changeStyle(e.target.value as Style)}><option value="black">Solid black</option><option value="neutral">Neutral block</option><option value="label">[REDACTED]</option></select></label><button className="icon-button danger" aria-label="Delete selected redaction" onClick={deleteSelected}><Trash2 size={17}/></button></div>}
        <div className="floating-tools" role="toolbar" aria-label="Editing tools">{([{ key: 'draw', label: 'Draw rectangle (R)', Icon: Square }, { key: 'select', label: 'Select redaction (V)', Icon: MousePointer2 }, { key: 'pan', label: 'Pan (H)', Icon: Hand }] as const).map(({ key, label, Icon }) => <button key={key} className={`icon-button ${tool === key ? 'tool-active' : ''}`} aria-label={label} aria-pressed={tool === key} onClick={() => { setTool(key); setPickedWord(null); }}><Icon size={19}/></button>)}<span className="tool-divider"/><button className="icon-button" aria-label="Undo (Ctrl Z)" disabled={!past.length} onClick={() => { undo(); setSelected(null); }}><Undo2 size={19}/></button><button className="icon-button" aria-label="Redo (Ctrl Shift Z)" disabled={!future.length} onClick={() => { redo(); setSelected(null); }}><Redo2 size={19}/></button><span className="tool-divider"/><button className="icon-button" aria-label="Zoom out" onClick={() => setZoom(z => clamp(z / 1.25, .25, 8))}><Minus size={17}/></button><button className="zoom-label" onClick={() => { setZoom(1); viewport.current?.scrollTo(0, 0); }} aria-label="Fit image to screen">{Math.round(scale * 100)}%</button><button className="icon-button" aria-label="Zoom in" onClick={() => setZoom(z => clamp(z * 1.25, .25, 8))}><Plus size={17}/></button></div>
      </div>
      {findingsOpen && <aside className="findings-panel" aria-label="Privacy findings"><div className="findings-heading"><h2>A little privacy check.</h2><button className="icon-button" onClick={() => setFindingsOpen(false)} aria-label="Close findings"><X size={17}/></button></div><p className="small muted">Suggestions, never a guarantee. Review the entire screenshot.</p>
        <div className="ocr-status" role="status"><ScanText size={16}/>{ocrStatus === 'loading' ? `Reading locally… ${Math.round(progress * 100)}%` : ocrStatus === 'error' ? 'Text recognition unavailable' : `${words.length} text regions recognized`}{ocrStatus === 'error' && <button className="text-button" onClick={() => setAttempt(n => n + 1)}>Retry</button>}</div>
        {ocrStatus === 'error' && <p className="notice">Manual redaction still works. Check your local OCR assets and try again.</p>}
        <div className="finding-count"><span>AUTOMATED FINDINGS</span><span>{remaining.length} to review</span></div>
        <div className="finding-list">{remaining.map(f => <article className="finding" key={f.id}><span className="finding-kind">{f.kind}</span><button className="finding-value" onClick={() => { const w = words.find(w => w.id === f.id); if (w) setPickedWord(w); }}>{f.text}</button><div><button className="text-button" onClick={() => addRects([f.rect])}><Square size={13}/>Hide</button><button className="text-button muted" onClick={() => setIgnored(ids => [...ids, f.id])}>Ignore</button></div></article>)}{ocrStatus === 'done' && !remaining.length && <p className="empty-findings"><Check size={20}/>{findings.length ? 'All suggestions reviewed.' : 'No suggestions found.'}<span>Still give the whole image a careful look.</span></p>}</div>
        {ignoredCount > 0 && <button className="text-button" onClick={() => setIgnored([])}>Restore {ignoredCount} ignored finding{ignoredCount === 1 ? '' : 's'}</button>}
        <label className="default-style">Redaction style<select value={style} onChange={e => changeStyle(e.target.value as Style)}><option value="black">Solid black</option><option value="neutral">Neutral opaque block</option><option value="label">[REDACTED] label</option></select></label>
        {mode === 'developer' && <div className="developer-checklist"><span className="eyebrow">MANUAL REVIEW CHECKLIST</span><p className="small muted">These are reminders, not automated findings.</p>{checklist.map(item => <label key={item}><input type="checkbox"/>{item}</label>)}<p className="small muted">OCR may cover a whole assignment when character positions are uncertain. Adjust blocks as needed.</p></div>}
        {!!items.length && <details className="redaction-list"><summary>{items.length} redaction{items.length === 1 ? '' : 's'} · manage blocks</summary>{items.map((r, i) => <div key={r.id}><button className="text-button" onClick={() => { setSelected(r.id); setPickedWord(null); canvas.current?.parentElement?.querySelectorAll<HTMLButtonElement>('.redaction-region')[i]?.focus(); }}>Select block {i + 1}</button><button className="icon-button" aria-label={`Delete block ${i + 1}`} onClick={() => { commit(items.filter(item => item.id !== r.id)); if (selected === r.id) setSelected(null); }}><Trash2 size={14}/></button></div>)}</details>}
      </aside>}
    </main><footer className="editor-status"><span>{source.width} × {source.height} px<span className="status-separator">/</span>{items.length} redactions</span><span>{source.sample ? 'Fictional demo · ' : ''}Original image stays on this device</span></footer>
    {review && <ExportReview source={source} items={items} unresolved={remaining.length} ignored={ignoredCount} ocrStatus={ocrStatus} onClose={() => setReview(false)}/>}
  </div>;
}
