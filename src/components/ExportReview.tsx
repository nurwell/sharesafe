import { useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Download, X } from 'lucide-react';
import type { Redaction, Source } from '../types';
import { exportPng, validatePng, type Presentation } from '../lib/export';
type Props = { source: Source; items: Redaction[]; unresolved: number; ignored: number; ocrStatus: string; onClose: () => void };
export default function ExportReview({ source, items, unresolved, ignored, ocrStatus, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null); const [presentation, setPresentation] = useState<Presentation>('plain');
  const [url, setUrl] = useState(''); const [blob, setBlob] = useState<Blob | null>(null); const [checked, setChecked] = useState(false);
  const [error, setError] = useState(''); const [dimensions, setDimensions] = useState(''); const [copied, setCopied] = useState(false);
  useEffect(() => { const el = dialog.current!; const previous = document.activeElement as HTMLElement; el.showModal(); return () => { el.close(); previous?.focus(); }; }, []);
  useEffect(() => {
    let active = true; let created = ''; setBlob(null); setUrl(''); setChecked(false); setError(''); setCopied(false);
    void (async () => { try {
      const result = await exportPng(source, items, presentation); const size = await validatePng(result);
      created = URL.createObjectURL(result); const img = new Image(); img.src = created; await img.decode();
      if (active) { setBlob(result); setUrl(created); setDimensions(`${size.width} × ${size.height}`); } else URL.revokeObjectURL(created);
    } catch { if (active) setError('Could not generate the PNG. Close this preview and try again.'); } })();
    return () => { active = false; if (created) URL.revokeObjectURL(created); };
  }, [source, items, presentation]);
  const download = () => { if (!blob || !checked) return; const link = document.createElement('a'); link.href = url; link.download = `${source.name.replace(/\.[^.]+$/, '')}-sharesafe.png`; link.click(); };
  const copy = async () => { if (!blob || !checked) return; try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setCopied(true); } catch { setError('Clipboard access is unavailable. Use Download PNG instead.'); } };
  return <dialog ref={dialog} className="export-dialog" aria-labelledby="export-title" onCancel={onClose}>
    <div className="dialog-heading"><div><span className="eyebrow">ONE LAST LOOK</span><h2 id="export-title">Ready to share?</h2></div><button className="icon-button" onClick={onClose} aria-label="Close export preview"><X/></button></div>
    <p className="muted">Review the actual sanitized PNG. Detection can miss sensitive details.</p>
    <fieldset className="segmented export-styles"><legend className="sr-only">Export presentation</legend>{(['plain', 'share', 'github'] as const).map(p => <button key={p} className={presentation === p ? 'active' : ''} onClick={() => setPresentation(p)}>{p === 'plain' ? 'Plain PNG' : p === 'share' ? 'Share-ready' : 'GitHub-ready'}</button>)}</fieldset>
    <div className="export-preview">{url ? <img src={url} alt="Final sanitized PNG. Carefully review all visible details before exporting."/> : <span role="status">Generating your clean PNG…</span>}</div>
    <div className="export-stats"><span>{items.length} redaction{items.length === 1 ? '' : 's'}</span><span className={unresolved ? 'warning-text' : ''}>{unresolved} unresolved</span><span>{ignored} ignored</span><span>{dimensions}</span></div>
    {ocrStatus !== 'done' && <p className="notice">Text recognition {ocrStatus === 'error' ? 'failed' : 'has not completed'}. The finding count is incomplete. Review the entire image.</p>}
    <label className="review-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} disabled={!blob}/><span>I’ve visually reviewed this image, including unresolved and ignored findings.</span></label>
    {error && <p role="alert" className="error-text">{error}</p>}
    <div className="export-actions">{'ClipboardItem' in window && <button className="button secondary" disabled={!checked || !blob} onClick={() => void copy()}>{copied ? <Check size={17}/> : <Clipboard size={17}/>} {copied ? 'Copied' : 'Copy image'}</button>}<button className="button primary" disabled={!checked || !blob} onClick={download}><Download size={17}/>Download PNG</button></div>
    <p className="small muted">Opaque replacement pixels · Fresh PNG · Original metadata excluded</p>
  </dialog>;
}
